# WebSSH 架构说明 / Architecture Documentation

## 📐 系统架构 / System Architecture

### 整体架构 / Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / 浏览器                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  index.html  │  │   app.js     │  │   i18n.js    │      │
│  │  login.html  │  │  (1066 行)   │  │  (国际化)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │   style.css    │                        │
│                    │   (847 行)     │                        │
│                    └────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend / 后端                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    main.rs                           │   │
│  │  - HTTP Server (Warp)                                │   │
│  │  - WebSocket Handler                                 │   │
│  │  - Static File Serving                               │   │
│  └──────────────────────────────────────────────────────┘   │
│         │              │              │              │       │
│    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐  │
│    │ api.rs  │   │ auth.rs │   │crypto.rs│   │audit.rs │  │
│    │ (API)   │   │ (认证)  │   │ (加密)  │   │ (日志)  │  │
│    └─────────┘   └─────────┘   └─────────┘   └─────────┘  │
│         │              │              │              │       │
│    ┌────▼────┐   ┌────▼──────────────▼────┐   ┌────▼────┐  │
│    │ssh_     │   │    host_key.rs         │   │  data/  │  │
│    │config.rs│   │  (主机密钥验证)         │   │ (JSON)  │  │
│    └─────────┘   └────────────────────────┘   └─────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                        SSH 协议
                            │
┌─────────────────────────────────────────────────────────────┐
│                    SSH Server / SSH 服务器                    │
│                    (远程 Linux/Unix 主机)                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 安全架构 / Security Architecture

### 认证流程 / Authentication Flow

```
1. 用户登录 / User Login
   ├─ 输入用户名密码 / Enter credentials
   ├─ Bcrypt 验证 (cost=12) / Bcrypt verification
   ├─ TOTP 2FA 验证 (可选) / TOTP 2FA (optional)
   └─ 生成 JWT Token (24h) / Generate JWT token

2. API 请求 / API Request
   ├─ 携带 JWT Token / Include JWT token
   ├─ Token 验证 / Token verification
   └─ 权限检查 / Permission check

3. SSH 连接 / SSH Connection
   ├─ 从加密存储读取凭证 / Read encrypted credentials
   ├─ AES-256-GCM 解密 / AES-256-GCM decryption
   ├─ 主机密钥验证 / Host key verification
   └─ 建立 SSH 连接 / Establish SSH connection
```

### 加密层次 / Encryption Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: 传输层加密 / Transport Encryption                   │
│  - HTTPS (TLS 1.2+)                                         │
│  - WebSocket Secure (WSS)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: 应用层加密 / Application Encryption                 │
│  - JWT Token (HS256)                                        │
│  - Bcrypt Password Hashing (cost=12)                        │
│  - TOTP Secret (Base32)                                     │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: 数据层加密 / Data Encryption                        │
│  - AES-256-GCM (SSH 密码)                                   │
│  - PBKDF2-HMAC-SHA256 (密钥派生, 600k 迭代)                 │
│  - Master Password Protection                               │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: SSH 协议加密 / SSH Protocol Encryption              │
│  - SSH-2 Protocol                                           │
│  - Host Key Verification                                    │
│  - Encrypted Channel                                        │
└─────────────────────────────────────────────────────────────┘
```

## 📊 数据流 / Data Flow

### SSH 连接数据流 / SSH Connection Data Flow

```
Browser                 Backend                 SSH Server
   │                       │                        │
   │  1. WebSocket 连接    │                        │
   ├──────────────────────>│                        │
   │                       │                        │
   │  2. 发送连接请求       │                        │
   │  {host, port, user}   │                        │
   ├──────────────────────>│                        │
   │                       │  3. 建立 SSH 连接      │
   │                       ├───────────────────────>│
   │                       │                        │
   │                       │  4. SSH 握手完成       │
   │                       │<───────────────────────┤
   │  5. 连接成功通知       │                        │
   │<──────────────────────┤                        │
   │                       │                        │
   │  6. 用户输入 (stdin)   │                        │
   ├──────────────────────>│  7. 转发到 SSH        │
   │                       ├───────────────────────>│
   │                       │                        │
   │                       │  8. SSH 输出 (stdout)  │
   │  9. 显示输出          │<───────────────────────┤
   │<──────────────────────┤                        │
   │                       │                        │
   │  (循环 6-9)           │  (循环 7-8)            │
   │                       │                        │
   │  10. 断开连接         │                        │
   ├──────────────────────>│  11. 关闭 SSH         │
   │                       ├───────────────────────>│
   │                       │                        │
```

## 🎨 前端架构 / Frontend Architecture

### 模块划分 / Module Division

```
static/
├── index.html (主页面)
│   ├── 连接表单 / Connection Form
│   ├── 配置列表 / Config List
│   ├── 终端容器 / Terminal Container
│   └── 模态框 / Modals (2FA, 密码, 审计日志)
│
├── login.html (登录页面)
│   ├── 登录表单 / Login Form
│   └── 2FA 验证 / 2FA Verification
│
├── app.js (主逻辑, 1066 行)
│   ├── 认证模块 / Authentication (50 行)
│   ├── 2FA 管理 / 2FA Management (180 行)
│   ├── 密码修改 / Password Change (100 行)
│   ├── 审计日志 / Audit Log (80 行)
│   ├── 配置管理 / Config Management (150 行)
│   ├── SSH 连接 / SSH Connection (200 行)
│   ├── 终端管理 / Terminal Management (200 行)
│   └── 工具函数 / Utilities (106 行)
│
├── i18n.js (国际化, 320 行)
│   ├── 翻译字典 / Translation Dictionary
│   ├── 语言切换 / Language Switching
│   └── DOM 更新 / DOM Update
│
└── style.css (样式, 847 行)
    ├── 全局样式 / Global Styles (50 行)
    ├── 表单样式 / Form Styles (200 行)
    ├── 终端样式 / Terminal Styles (100 行)
    ├── 模态框样式 / Modal Styles (200 行)
    ├── 按钮样式 / Button Styles (150 行)
    └── 响应式样式 / Responsive Styles (147 行)
```

### 关键技术点 / Key Technical Points

#### 1. 终端滚动优化 / Terminal Scroll Optimization

```javascript
// 核心滚动函数 / Core scroll function
function scrollTerminalToBottom() {
    if (!terminal || scrollPending) return;
    scrollPending = true;
    
    requestAnimationFrame(() => {
        terminal.scrollToBottom();
        const viewport = document.querySelector('.xterm-viewport');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight + 100; // 额外偏移
        }
        
        setTimeout(() => {
            // 双重确保机制
            if (terminal) terminal.scrollToBottom();
            if (viewport) viewport.scrollTop = viewport.scrollHeight + 100;
            scrollPending = false;
        }, 100);
    });
}

// 节流版本 / Throttled version
const scrollTerminalThrottled = debounce(scrollTerminalToBottom, 100);
```

**关键点：**
- 使用 `requestAnimationFrame` 确保在渲染后执行
- 额外 +100px 偏移确保光标完全可见
- 双重确保机制（立即 + 延迟 100ms）
- 节流避免频繁调用影响性能

#### 2. 移动端适配 / Mobile Adaptation

```css
/* 动态视口高度 / Dynamic viewport height */
#terminal-container {
    height: 100dvh !important;  /* 适应地址栏显示/隐藏 */
    min-height: -webkit-fill-available;  /* iOS 兼容 */
}

/* 硬件加速 / Hardware acceleration */
.xterm-viewport {
    transform: translateZ(0);
    -webkit-overflow-scrolling: touch;
}

/* 消除白边 / Remove white edges */
.xterm,
.xterm-viewport,
.xterm-screen,
.xterm-rows {
    padding: 0 !important;
    margin: 0 !important;
    background-color: #1e1e1e !important;
}
```

**关键点：**
- `100dvh` 动态视口高度
- 硬件加速提升性能
- 强制移除所有 padding/margin
- 统一背景色消除白边

#### 3. 现代 API 使用 / Modern API Usage

```javascript
// Base64 编码 / Base64 encoding
const utf8ToBase64 = (str) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...data));
};

// 剪贴板复制 / Clipboard copy
async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}
```

## 🔧 后端架构 / Backend Architecture

### 模块职责 / Module Responsibilities

```
src/
├── main.rs (主程序, 500+ 行)
│   ├── HTTP 服务器初始化
│   ├── WebSocket 处理
│   ├── 静态文件服务
│   └── 路由配置
│
├── api.rs (API 路由, 300+ 行)
│   ├── 用户管理 API
│   ├── 配置管理 API
│   ├── 审计日志 API
│   └── 2FA 管理 API
│
├── auth.rs (认证模块, 200+ 行)
│   ├── JWT 生成和验证
│   ├── 密码哈希和验证
│   ├── TOTP 验证
│   └── 权限检查
│
├── crypto.rs (加密模块, 150+ 行)
│   ├── AES-256-GCM 加密/解密
│   ├── PBKDF2 密钥派生
│   └── 随机数生成
│
├── ssh_config.rs (配置管理, 200+ 行)
│   ├── 配置 CRUD 操作
│   ├── 加密存储
│   └── 配置验证
│
├── audit.rs (审计日志, 150+ 行)
│   ├── 日志记录
│   ├── 日志查询
│   └── 日志清理
│
└── host_key.rs (主机密钥, 100+ 行)
    ├── 密钥存储
    ├── 密钥验证
    └── 密钥更新
```

## 📈 性能优化 / Performance Optimization

### 前端优化 / Frontend Optimization

1. **代码精简** - 删除冗余代码，减少 50+ 行
2. **节流滚动** - 使用 debounce 限制滚动频率
3. **硬件加速** - CSS transform 启用 GPU 加速
4. **缓存优化** - 缓存 DOM 查询结果
5. **异步操作** - 使用 async/await 避免阻塞

### 后端优化 / Backend Optimization

1. **异步 I/O** - Tokio 异步运行时
2. **连接池** - 复用 SSH 连接
3. **内存管理** - Rust 零成本抽象
4. **并发处理** - 多线程处理请求
5. **缓存策略** - 静态文件缓存

## 🎯 最佳实践 / Best Practices

### 安全最佳实践 / Security Best Practices

1. ✅ 使用强加密算法（AES-256-GCM, PBKDF2）
2. ✅ 实施多因素认证（2FA）
3. ✅ 完整的审计日志
4. ✅ 主机密钥验证
5. ✅ 最小权限原则

### 代码最佳实践 / Code Best Practices

1. ✅ 使用现代 API，避免废弃方法
2. ✅ 统一的错误处理
3. ✅ 完善的注释文档
4. ✅ 模块化设计
5. ✅ 代码复用和精简

### 用户体验最佳实践 / UX Best Practices

1. ✅ 响应式设计，支持移动端
2. ✅ 国际化支持（中英文）
3. ✅ 清晰的错误提示
4. ✅ 流畅的交互体验
5. ✅ 无障碍访问支持

---

**文档版本:** v1.0.0  
**最后更新:** 2025-10-21  
**维护者:** steven

