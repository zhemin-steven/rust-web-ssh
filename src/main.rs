/**
 * Web SSH Server
 * Author: steven
 * A simple web-based SSH server using Rust, warp, and ssh2
 */

mod api;

use std::net::SocketAddr;
use warp::Filter;
use log::info;

#[tokio::main]
async fn main() {
    // 初始化日志
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .init();

    // 监听地址
    let socket_address: SocketAddr = "0.0.0.0:18022".parse().unwrap();

    // 路由
    let ws_ssh = api::ssh_websocket::route_ssh_websocket();
    let files = api::files::route_files();
    let not_found = api::not_found::route_404();

    let routes = ws_ssh.or(files).or(not_found);

    info!("服务器启动在 http://0.0.0.0:18022");
    println!("Web SSH 服务器运行在 http://127.0.0.1:18022");

    // 启动 web 服务器
    warp::serve(routes).run(socket_address).await;
}

