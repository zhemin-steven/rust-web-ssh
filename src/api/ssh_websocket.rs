mod session;

use base64::{Engine as _, engine::general_purpose};
use serde_json::json;
use futures::{StreamExt, SinkExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use warp::ws::{Message, WebSocket};
use log::{info, error};
use warp::{Filter, Rejection, Reply};

use session::Session;

pub fn route_ssh_websocket() -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path!("api" / "ssh")
        .and(warp::ws())
        .map(|ws: warp::ws::Ws| ws.on_upgrade(|socket| ws_start(socket)))
}

async fn ws_start(ws: WebSocket) {
    info!("WebSocket 连接建立");

    // 分离 WebSocket 为发送和接收通道
    let (mut ws_tx, ws_rx) = ws.split();

    // 创建无界通道用于缓冲消息
    let (tx, rx) = mpsc::unbounded_channel();
    let mut rx = UnboundedReceiverStream::new(rx);

    // 启动异步任务将消息从通道发送到 WebSocket
    tokio::task::spawn(async move {
        while let Some(message) = rx.next().await {
            if let Err(e) = ws_tx.send(message).await {
                error!("WebSocket 发送错误: {}", e);
                break;
            }
        }
    });

    // 创建 SSH 会话
    let mut ssh = Session::new();

    if let Err(e) = ssh.run(ws_rx, &tx).await {
        error!("SSH 会话错误: {}", e);
        let msg = get_ws_stderr(e.to_string());
        let _ = tx.send(msg);
    }

    info!("WebSocket 连接关闭");
}

pub fn get_ws_stdout(s: String) -> Message {
    let s = general_purpose::STANDARD.encode(s);
    let json = json!({"type": "stdout", "data": s});
    let text = json.to_string();
    Message::text(text)
}

pub fn get_ws_stderr(s: String) -> Message {
    let s = general_purpose::STANDARD.encode(s);
    let json = json!({"type": "stderr", "data": s});
    let text = json.to_string();
    Message::text(text)
}

