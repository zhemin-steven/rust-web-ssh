# Web SSH Client

Author: **steven**

一个基于 Rust 和 xterm.js 的 Web SSH 客户端应用。这是一个单体应用，可以直接用 Rust 启动和运行。

## 功能特性

- ✅ 基于 WebSocket 的实时 SSH 连接
- ✅ 支持密码认证和私钥认证
- ✅ 完整的终端模拟（基于 xterm.js）
- ✅ 自适应终端窗口大小
- ✅ 复制/粘贴支持（右键复制，Ctrl+V 粘贴）
- ✅ 美观的现代化 UI 界面
- ✅ 单体应用，无需额外依赖

## 技术栈

### 后端
- **Rust** - 系统编程语言
- **Warp** - Web 框架
- **ssh2** - SSH 客户端库
- **tokio** - 异步运行时
- **base64** - 编码/解码

### 前端
- **xterm.js** - 终端模拟器
- **xterm-addon-fit** - 终端自适应插件
- **原生 JavaScript** - 无框架依赖
- **WebSocket** - 实时通信

## 快速开始

### 前置要求

- Rust 1.75.0 或更高版本
- Cargo（Rust 包管理器）

### 安装 Rust

如果还没有安装 Rust，可以使用以下命令安装：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 运行应用

1. 克隆或下载此项目

2. 进入项目目录：
```bash
cd webssh
```

3. 运行应用：
```bash
cargo run
```

4. 打开浏览器访问：
```
http://127.0.0.1:18022
```

### 构建发布版本

```bash
cargo build --release
```

编译后的可执行文件位于 `target/release/webssh`

## 使用说明

1. 在浏览器中打开应用
2. 填写 SSH 连接信息：
   - 主机地址和端口
   - 用户名
   - 选择认证方式（密码或私钥）
   - 输入密码或私钥内容
3. 点击"连接"按钮
4. 连接成功后即可使用终端

### 复制/粘贴

- **复制**：用鼠标选择文本，然后右键点击
- **粘贴**：按 `Ctrl+V`（Mac 上使用 `Cmd+V`）

## 项目结构

```
webssh/
├── src/
│   ├── main.rs                          # 主程序入口
│   └── api/
│       ├── mod.rs                       # API 模块定义
│       ├── files.rs                     # 静态文件服务
│       ├── not_found.rs                 # 404 处理
│       └── ssh_websocket/
│           ├── mod.rs                   # WebSocket 路由
│           └── session.rs               # SSH 会话管理
├── static/
│   ├── index.html                       # 主页面
│   ├── style.css                        # 样式文件
│   ├── app.js                           # 前端逻辑
│   └── 404.html                         # 404 页面
├── Cargo.toml                           # Rust 项目配置
└── README.md                            # 项目说明
```

## WebSocket 协议

客户端和服务器通过 WebSocket 使用 JSON 消息通信：

### 客户端 → 服务器

- `addr`: SSH 服务器地址（base64 编码）
- `login`: 用户名（base64 编码）
- `password`: 密码或密钥密码（base64 编码）
- `key`: 私钥（base64 编码）
- `connect`: 发起 SSH 连接
- `stdin`: 终端输入（base64 编码）
- `resize`: 终端大小变化（`cols`, `rows`）

### 服务器 → 客户端

- `stdout`: 终端输出（base64 编码）
- `stderr`: 错误输出（base64 编码）

## 安全注意事项

⚠️ **重要提示**：

1. 此应用目前**不验证 SSH 服务器密钥**，仅用于开发和测试环境
2. 在生产环境使用前，请添加适当的安全措施：
   - 启用 HTTPS/WSS
   - 添加用户认证
   - 验证 SSH 服务器密钥
   - 添加访问控制
   - 实施日志审计


## 许可证

MIT License


