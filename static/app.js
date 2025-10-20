/**
 * Web SSH Client
 * Author: steven
 * A simple web-based SSH client using xterm.js and Rust backend
 */

// Base64 encoding/decoding utilities
const utf8ToBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
const base64ToUtf8 = (str) => decodeURIComponent(escape(atob(str)));

// Global variables
let terminal = null;
let socket = null;
let fitAddon = null;
let lastSelectionTime = 0;
let savedSelection = '';

// Copy text to clipboard using fallback method
function copyTextFallback(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        document.execCommand('copy');
        document.body.removeChild(textArea);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

// DOM elements
const connectForm = document.getElementById('connect-form');
const terminalContainer = document.getElementById('terminal-container');
const sshForm = document.getElementById('ssh-form');
const disconnectBtn = document.getElementById('disconnect-btn');
const connectionInfo = document.getElementById('connection-info');

// Authentication method toggle
const authRadios = document.querySelectorAll('input[name="auth"]');
const passwordGroup = document.getElementById('password-group');
const keyGroup = document.getElementById('key-group');
const passphraseGroup = document.getElementById('passphrase-group');

authRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'password') {
            passwordGroup.style.display = 'block';
            keyGroup.style.display = 'none';
            passphraseGroup.style.display = 'none';
        } else {
            passwordGroup.style.display = 'none';
            keyGroup.style.display = 'block';
            passphraseGroup.style.display = 'block';
        }
    });
});

// Private key file reading
const keyFileInput = document.getElementById('key-file');
const privateKeyTextarea = document.getElementById('private-key');

keyFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            privateKeyTextarea.value = event.target.result;
        };
        reader.readAsText(file);
    }
});

// Form submission
sshForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const host = document.getElementById('host').value;
    const port = document.getElementById('port').value;
    const username = document.getElementById('username').value;
    const authType = document.querySelector('input[name="auth"]:checked').value;
    
    let password = '';
    let privateKey = '';
    
    if (authType === 'password') {
        password = document.getElementById('password').value;
        if (!password) {
            alert('请输入密码');
            return;
        }
    } else {
        privateKey = privateKeyTextarea.value;
        if (!privateKey) {
            alert('请输入或选择私钥文件');
            return;
        }
        password = document.getElementById('passphrase').value;
    }
    
    connectSSH({
        host,
        port,
        username,
        authType,
        password,
        privateKey
    });
});

// Disconnect
disconnectBtn.addEventListener('click', () => {
    if (socket) {
        socket.close();
    }
    showConnectForm();
});

// Show connection form
function showConnectForm() {
    connectForm.style.display = 'flex';
    terminalContainer.style.display = 'none';
    
    if (terminal) {
        terminal.dispose();
        terminal = null;
    }
}

// Show terminal
function showTerminal() {
    connectForm.style.display = 'none';
    terminalContainer.style.display = 'flex';
}

// Connect to SSH
function connectSSH(config) {
    // Initialize terminal
    terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Courier New, monospace',
        theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#ffffff',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5'
        },
        cols: 80,
        rows: 24,
        allowTransparency: false,
        scrollback: 1000
    });

    // Load fit addon
    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);

    // Show terminal UI
    showTerminal();
    connectionInfo.textContent = `${config.username}@${config.host}:${config.port}`;

    // Open terminal
    terminal.open(document.getElementById('terminal'));

    const terminalElement = document.getElementById('terminal');

    // Handle keyboard events
    terminalElement.addEventListener('keydown', (e) => {
        // Ctrl+C / Cmd+C - Copy
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            const selection = savedSelection || terminal.getSelection();
            if (selection && selection.length > 0) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(selection).catch(() => copyTextFallback(selection));
                } else {
                    copyTextFallback(selection);
                }

                lastSelectionTime = Date.now();
                savedSelection = '';
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }

        // Ctrl+V / Cmd+V - Paste
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            navigator.clipboard.readText().then(text => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'stdin',
                        data: utf8ToBase64(text)
                    }));
                }
            }).catch(err => console.error('Failed to read clipboard:', err));
            return false;
        }
    });

    // Track selection changes
    terminal.onSelectionChange(() => {
        const selection = terminal.getSelection();
        if (selection && selection.length > 0) {
            lastSelectionTime = Date.now();
            savedSelection = selection;
        } else {
            if (Date.now() - lastSelectionTime > 500) {
                savedSelection = '';
            }
        }
    });

    // Handle right-click for copy
    terminalElement.addEventListener('contextmenu', (e) => {
        setTimeout(() => {
            const selection = terminal.getSelection();
            if (selection && selection.length > 0) {
                copyTextFallback(selection);
            }
        }, 10);
    });

    // Fit terminal to container
    setTimeout(() => fitAddon.fit(), 100);

    terminal.writeln('正在连接到服务器...');

    // Establish WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ssh`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        terminal.writeln('WebSocket 连接已建立');
        terminal.writeln(`正在连接到 ${config.username}@${config.host}:${config.port}...`);

        setTimeout(() => fitAddon.fit(), 200);

        // Send connection parameters
        socket.send(JSON.stringify({ type: 'addr', data: utf8ToBase64(`${config.host}:${config.port}`) }));
        socket.send(JSON.stringify({ type: 'login', data: utf8ToBase64(config.username) }));

        if (config.authType === 'password') {
            socket.send(JSON.stringify({ type: 'password', data: utf8ToBase64(config.password) }));
        } else {
            socket.send(JSON.stringify({ type: 'key', data: utf8ToBase64(config.privateKey) }));
            if (config.password) {
                socket.send(JSON.stringify({ type: 'password', data: utf8ToBase64(config.password) }));
            }
        }

        // Send terminal size
        socket.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
        }));

        // Send connect command
        socket.send(JSON.stringify({ type: 'connect', data: '' }));

        // Handle terminal input
        terminal.onData((data) => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const timeSinceSelection = Date.now() - lastSelectionTime;

                // Filter ^C from automatic Control key after selection
                if (data === '\x03' && timeSinceSelection < 500) {
                    return;
                }

                socket.send(JSON.stringify({
                    type: 'stdin',
                    data: utf8ToBase64(data)
                }));
            }
        });

        // Handle window resize
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 300);
    };

    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            
            switch (msg.type) {
                case 'stdout':
                    terminal.write(base64ToUtf8(msg.data));
                    break;
                case 'stderr':
                    terminal.write('\x1b[31m' + base64ToUtf8(msg.data) + '\x1b[0m');
                    break;
            }
        } catch (e) {
            console.error('解析消息失败:', e);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        terminal.writeln('\r\n\x1b[31mWebSocket 连接错误\x1b[0m');
    };

    socket.onclose = () => {
        terminal.writeln('\r\n\x1b[33m连接已关闭\x1b[0m');
        window.removeEventListener('resize', handleResize);
    };
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle window resize
const handleResize = debounce(() => {
    if (terminal && fitAddon) {
        try {
            fitAddon.fit();

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'resize',
                    cols: terminal.cols,
                    rows: terminal.rows
                }));
            }
        } catch (e) {
            console.error('调整终端大小失败:', e);
        }
    }
}, 100);

