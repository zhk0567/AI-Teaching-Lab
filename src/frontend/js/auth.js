/**
 * 认证相关功能模块
 * 处理登录、登出、Token验证等
 */

// 登录弹窗管理
const LoginModal = {
    modal: null,
    form: null,
    errorMessage: null,
    loginBtn: null,
    loginBtnText: null,
    loginBtnLoading: null,

    init() {
        this.modal = document.getElementById('login-modal');
        this.form = document.getElementById('login-form');
        this.errorMessage = document.getElementById('login-error-message');
        this.loginBtn = document.getElementById('login-btn');
        this.loginBtnText = document.getElementById('login-btn-text');
        this.loginBtnLoading = document.getElementById('login-btn-loading');

        // 绑定表单提交事件
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // 点击遮罩关闭（可选，登录弹窗通常不允许关闭）
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    // 不允许通过点击遮罩关闭登录弹窗
                }
            });
        }
    },

    show() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
            // 初始化图标（确保密码显示/隐藏按钮的图标正确显示）
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            // 确保密码输入框类型正确
            const passwordInput = document.getElementById('login-password');
            const eyeIcon = document.getElementById('password-eye-icon');
            if (passwordInput && eyeIcon) {
                passwordInput.type = 'password';
                eyeIcon.setAttribute('data-lucide', 'eye');
                lucide.createIcons();
            }
            // 添加动画效果
            setTimeout(() => {
                const dialog = this.modal.querySelector('.bg-white');
                if (dialog) {
                    dialog.style.transform = 'scale(1)';
                }
            }, 10);
            // 聚焦到用户名输入框
            const usernameInput = document.getElementById('login-username');
            if (usernameInput) {
                setTimeout(() => usernameInput.focus(), 100);
            }
        }
    },

    hide() {
        if (this.modal) {
            const dialog = this.modal.querySelector('.bg-white');
            if (dialog) {
                dialog.style.transform = 'scale(0.95)';
            }
            setTimeout(() => {
                this.modal.classList.add('hidden');
                // 清空表单
                if (this.form) {
                    this.form.reset();
                }
                if (this.errorMessage) {
                    this.errorMessage.classList.add('hidden');
                }
            }, 300);
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        // 隐藏错误信息
        if (this.errorMessage) {
            this.errorMessage.classList.add('hidden');
        }

        // 显示加载状态
        if (this.loginBtn) {
            this.loginBtn.disabled = true;
        }
        if (this.loginBtnText) {
            this.loginBtnText.classList.add('hidden');
        }
        if (this.loginBtnLoading) {
            this.loginBtnLoading.classList.remove('hidden');
        }

        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('登录请求超时(1秒)')), 1000)
            );

            const response = await Promise.race([
                fetch('http://localhost:3000/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                }),
                timeoutPromise
            ]);

            const data = await response.json();

            if (response.ok && data.success) {
                // 登录成功，保存token和用户信息（使用sessionStorage，支持多窗口独立登录）
                if (typeof Storage !== 'undefined') {
                    Storage.setAuthToken(data.token);
                    Storage.setUserInfo({
                        username: data.username,
                        group: data.group,
                        isAdmin: data.isAdmin || false
                    });
                } else {
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('user_info', JSON.stringify({
                        username: data.username,
                        group: data.group,
                        isAdmin: data.isAdmin || false
                    }));
                }

                // 隐藏登录弹窗
                this.hide();
                
                if (typeof AppState !== 'undefined') {
                    AppState.initUserInfo();
                }
                
                // 检查是否是管理员
                if (data.isAdmin) {
                    // 管理员跳转到管理页面
                    window.location.href = 'admin.html';
                    return;
                }
            
                // 启用主内容区
                const mainContainer = document.getElementById('main-container');
                if (mainContainer) {
                    mainContainer.style.pointerEvents = 'auto';
                    mainContainer.style.opacity = '1';
                }
                // 初始化应用（添加错误处理）
                if (typeof Main !== 'undefined' && Main.init) {
                    Main.init().catch(error => {
                        console.error('登录后初始化失败:', error);
                        // 即使初始化失败，也更新用户信息显示
                        if (typeof Main !== 'undefined' && Main._updateUserInfoDisplay) {
                            Main._updateUserInfoDisplay();
                        }
                    });
                } else {
                    // 如果Main未定义，至少更新用户信息显示
                    if (typeof Main !== 'undefined' && Main._updateUserInfoDisplay) {
                        Main._updateUserInfoDisplay();
                    }
                }
                // 注意：不再自动刷新页面，避免无限循环
                // UI 已经通过 Main.init() 更新，不需要刷新页面
            } else {
                // 登录失败，显示错误信息
                if (this.errorMessage) {
                    this.errorMessage.textContent = data.error || '登录失败，请检查用户名和密码';
                    this.errorMessage.classList.remove('hidden');
                }
            }
        } catch (error) {
            // 记录完整错误信息到控制台
            console.error('登录失败:', error);
            console.error('错误类型:', error.constructor.name);
            console.error('错误消息:', error.message);
            console.error('错误堆栈:', error.stack);
            if (error.cause) {
                console.error('错误原因:', error.cause);
            }
            
            // 显示错误信息
            if (this.errorMessage) {
                // 显示更详细的错误信息
                const errorText = error.message || '网络错误，请检查后端服务器是否运行';
                this.errorMessage.textContent = errorText;
                this.errorMessage.classList.remove('hidden');
            }
        } finally {
            // 恢复按钮状态
            if (this.loginBtn) {
                this.loginBtn.disabled = false;
            }
            if (this.loginBtnText) {
                this.loginBtnText.classList.remove('hidden');
            }
            if (this.loginBtnLoading) {
                this.loginBtnLoading.classList.add('hidden');
            }
        }
    }
};

/**
 * 登出函数
 */
function logout() {
    if (confirm('确定要退出登录吗？')) {
        if (typeof Storage !== 'undefined' && Storage.clearAuth) {
            Storage.clearAuth();
        } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
        }
        // 禁用主内容区
        const mainContainer = document.getElementById('main-container');
        if (mainContainer) {
            mainContainer.style.pointerEvents = 'none';
            mainContainer.style.opacity = '0.3';
        }
        // 清空聊天记录
        const chatBox = document.getElementById('chat-messages');
        if (chatBox) {
            chatBox.innerHTML = '';
        }
        // 显示登录弹窗
        LoginModal.init();
        LoginModal.show();
    }
}

/**
 * 检查登录状态并验证Token
 */
// 防止重复调用checkAuth
let isCheckingAuth = false;

function checkAuth() {
    // 如果正在验证，跳过
    if (isCheckingAuth) {
        console.warn('认证检查正在进行中，跳过重复调用');
        return;
    }
    
    isCheckingAuth = true;
    
    let isAuthenticated = false;
    
    const token = (typeof Storage !== 'undefined' && Storage.getAuthToken) 
        ? Storage.getAuthToken() 
        : localStorage.getItem('auth_token');
    if (!token) {
        // 未登录，显示登录弹窗
        isCheckingAuth = false;
        setTimeout(() => {
            LoginModal.init();
            LoginModal.show();
        }, 100);
        return;
    }

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token验证超时(1秒)')), 1000)
    );

    Promise.race([
        fetch('http://localhost:3000/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        }),
        timeoutPromise
    ])
    .then(res => {
        if (!res || !res.ok) {
            throw new Error(res?.status === 401 ? 'Token无效或已过期' : '验证失败');
        }
        return res.json();
    })
    .then(data => {
        if (!data.success) {
            // Token无效，清除并显示登录弹窗
            if (typeof Storage !== 'undefined' && Storage.clearAuth) {
                Storage.clearAuth();
            } else {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
            }
            LoginModal.init();
            LoginModal.show();
        } else {
            // Token有效，更新用户信息（使用Storage模块）
            isAuthenticated = true;
            if (typeof Storage !== 'undefined') {
                Storage.setUserInfo({
                    username: data.username,
                    group: data.group,
                    isAdmin: data.isAdmin || false
                });
            } else {
                localStorage.setItem('user_info', JSON.stringify({
                    username: data.username,
                    group: data.group,
                    isAdmin: data.isAdmin || false
                }));
            }
            
            // 检查是否是管理员
            if (data.isAdmin) {
                window.location.href = 'admin.html';
                return;
            }
            
            // 启用主内容区
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.style.pointerEvents = 'auto';
                mainContainer.style.opacity = '1';
            }
            // 延迟初始化应用，确保所有脚本已加载
            // 使用requestIdleCallback或setTimeout，确保不阻塞UI
            if (window.requestIdleCallback) {
                requestIdleCallback(() => {
                    if (typeof Main !== 'undefined' && Main.init) {
                        Main.init().catch(error => {
                            console.error('Main.init失败:', error);
                            // 即使失败，也显示登录弹窗，让用户可以重试
                            LoginModal.init();
                            LoginModal.show();
                        });
                    }
                }, { timeout: 1000 });
            } else {
                setTimeout(() => {
                    if (typeof Main !== 'undefined' && Main.init) {
                        Main.init().catch(error => {
                            console.error('Main.init失败:', error);
                            LoginModal.init();
                            LoginModal.show();
                        });
                    }
                }, 100);
            }
        }
    })
    .catch((error) => {
        // 记录完整错误信息到控制台
        console.error('Token验证失败:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        if (error.cause) {
            console.error('错误原因:', error.cause);
        }
        
        // 验证失败，清除认证信息并显示登录弹窗
        if (typeof Storage !== 'undefined' && Storage.clearAuth) {
            Storage.clearAuth();
        } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
        }
        
        // 确保登录弹窗能显示，即使其他模块有问题
        try {
            LoginModal.init();
            LoginModal.show();
        } catch (e) {
            console.error('显示登录弹窗失败:', e);
            console.error('显示登录弹窗失败堆栈:', e.stack);
            // 如果连登录弹窗都显示不了，至少显示一个错误提示
            alert('页面加载失败，请刷新页面重试。\n错误信息：' + error.message);
        }
    })
    .finally(() => {
        // 无论成功还是失败，都重置标志
        isCheckingAuth = false;
    });
}

// 页面加载时检查登录状态
function initAuth() {
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }
}

// 初始化认证检查
initAuth();

