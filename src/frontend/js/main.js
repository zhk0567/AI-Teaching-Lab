/**
 * 主逻辑模块
 * 负责应用初始化和核心业务逻辑
 */

const Main = {
    progressRefreshInterval: null,
    isInitializing: false,  // 初始化锁，防止重复初始化
    isInitialized: false,   // 初始化完成标志
    
    /**
     * 初始化应用（带锁机制，防止重复初始化）
     */
    async init() {
        // 如果正在初始化，直接返回
        if (this.isInitializing) {
            console.warn('初始化正在进行中，跳过重复调用');
            return;
        }
        
        // 如果已经初始化，只更新UI，不重新初始化
        if (this.isInitialized) {
            console.log('应用已初始化，仅更新UI');
            this._updateUserInfoDisplay();
            if (typeof UI !== 'undefined' && UI.update) {
                UI.update();
            }
            return;
        }
        
        this.isInitializing = true;
        
        try {
            console.log('开始初始化应用...');
            
            // 首先清理可能残留的状态，避免卡住
            AppState.isAiTyping = false;
            AppState.isInputLocked = false;
            AppState.showHighlightTask = false;
            AppState.waitingForView = false;
            AppState.currentAiMessageElement = null;
            if (typeof Messages !== 'undefined' && Messages.removeTypingIndicator) {
                Messages.removeTypingIndicator();
            }
            
            // 初始化用户信息
            AppState.initUserInfo();
            
            // 确保初始状态为0（在加载进度之前）
            AppState.turnCount = 0;
            AppState.completed = false;
            
            // 更新用户信息显示（先显示为0，不等待进度加载）
            this._updateUserInfoDisplay();
            if (typeof UI !== 'undefined' && UI.update) {
                UI.update();
            }
            
            // 初始化UI组件（同步操作，立即完成）
            try {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            } catch (e) {
                console.warn('初始化图标失败:', e.message);
            }
            
            try {
                if (typeof Resizer !== 'undefined' && Resizer.init) {
                    Resizer.init();
                }
            } catch (e) {
                console.warn('初始化Resizer失败:', e.message);
            }
            
            // 先设置输入监听器，确保用户可以立即使用
            this._setupInputListener();
            
            // 启用主内容区（确保用户可以立即看到界面）
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.style.pointerEvents = 'auto';
                mainContainer.style.opacity = '1';
            }
            
            // 标记为已初始化（即使后续异步操作失败，也认为基本初始化完成）
            this.isInitialized = true;
            
            // 异步加载用户进度，不阻塞初始化（添加超时保护）
            AppState.loadProgress().catch(error => {
                console.warn('加载进度失败，继续使用默认值:', error.message);
            }).then(() => {
                // 进度加载完成后，更新UI
                this._updateUserInfoDisplay();
                if (typeof UI !== 'undefined' && UI.update) {
                    UI.update();
                }
            });
            
            // 异步重置实验（但不会覆盖已加载的进度），不阻塞初始化
            // 确保欢迎消息被显示，即使重置失败
            Experiment.reset().catch(error => {
                console.warn('重置实验失败:', error.message);
                // 即使重置失败，也尝试显示欢迎消息
                const chatBox = Utils.getElement('chat-messages');
                if (chatBox && chatBox.children.length === 0) {
                    // 如果聊天框为空，手动添加欢迎消息
                    const groupLabel = AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME
                        ? GROUP_CONFIG.GROUP1.LABEL
                        : GROUP_CONFIG.GROUP2.LABEL;
                    if (typeof Messages !== 'undefined' && Messages.append) {
                        Messages.append('ai', 
                            `欢迎来到实验系统。\n组别: ${groupLabel}。\n\n请从左侧选择一个提示开始。`, 
                            true);
                    }
                }
            });
            
            // 启动定期刷新进度（每30秒刷新一次，确保管理员设置后能及时更新）
            this.startProgressRefresh();
            
            console.log('应用初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            // 即使出错也更新用户信息显示
            this._updateUserInfoDisplay();
            // 确保状态被清理
            AppState.isAiTyping = false;
            if (typeof Messages !== 'undefined' && Messages.removeTypingIndicator) {
                Messages.removeTypingIndicator();
            }
            // 标记为已初始化，允许后续操作
            this.isInitialized = true;
        } finally {
            this.isInitializing = false;
        }
    },
    
    /**
     * 启动定期刷新进度
     */
    startProgressRefresh() {
        // 清除之前的定时器（如果存在）
        if (this.progressRefreshInterval) {
            clearInterval(this.progressRefreshInterval);
            this.progressRefreshInterval = null;
        }
        
        // 每30秒刷新一次进度（添加防抖，避免重复调用）
        let isRefreshing = false;
        this.progressRefreshInterval = setInterval(async () => {
            // 如果正在刷新，跳过本次
            if (isRefreshing) {
                console.warn('进度刷新正在进行中，跳过本次');
                return;
            }
            
            isRefreshing = true;
            try {
                await AppState.loadProgress();
                // 更新用户信息显示（包括进度）
                this._updateUserInfoDisplay();
            } catch (error) {
                console.error('定期刷新进度失败:', error);
                // 失败不影响使用，继续运行
            } finally {
                isRefreshing = false;
            }
        }, 30000); // 30秒
    },
    
    /**
     * 停止定期刷新进度
     */
    stopProgressRefresh() {
        if (this.progressRefreshInterval) {
            clearInterval(this.progressRefreshInterval);
            this.progressRefreshInterval = null;
        }
    },

    /**
     * 更新用户信息显示
     * @private
     */
    _updateUserInfoDisplay() {
        const userInfoElement = Utils.getElement('current-user-info');
        if (userInfoElement) {
            if (AppState.userInfo && AppState.userInfo.username) {
                // 严格验证：确保 group 字段存在
                if (!AppState.userInfo.group) {
                    console.error('严重错误：AppState.userInfo 缺少 group 字段！', AppState.userInfo);
                    userInfoElement.textContent = `${AppState.userInfo.username} - 未知组别`;
                } else {
                    const groupLabel = AppState.userInfo.group === GROUP_CONFIG.GROUP1.NAME
                        ? GROUP_CONFIG.GROUP1.LABEL
                        : GROUP_CONFIG.GROUP2.LABEL;
                    userInfoElement.textContent = `${AppState.userInfo.username} - ${groupLabel}`;
                }
            } else {
                // 如果用户信息未加载，尝试从Storage获取
                let userInfo = null;
                if (typeof Storage !== 'undefined' && Storage.getUserInfo) {
                    userInfo = Storage.getUserInfo();
                }
                if (userInfo && userInfo.username) {
                    // 严格验证：确保 group 字段存在
                    if (!userInfo.group) {
                        console.error('严重错误：userInfo 缺少 group 字段！', userInfo);
                        userInfoElement.textContent = `${userInfo.username} - 未知组别`;
                    } else {
                        const groupLabel = userInfo.group === GROUP_CONFIG.GROUP1.NAME
                            ? GROUP_CONFIG.GROUP1.LABEL
                            : GROUP_CONFIG.GROUP2.LABEL;
                        userInfoElement.textContent = `${userInfo.username} - ${groupLabel}`;
                    }
                } else {
                    userInfoElement.textContent = '未登录';
                }
            }
        }
    },

    /**
     * 设置输入框监听
     * @private
     */
    _setupInputListener() {
        const input = Utils.getElement('user-input');
        if (input) {
            input.addEventListener('input', () => {
                this._updateTipVisibility();
            });
        }
    },

    /**
     * 更新提示框显示状态
     * @private
     */
    _updateTipVisibility() {
        const input = Utils.getElement('user-input');
        const tip = Utils.getElement('tip-box');
        
        if (!input || !tip) {
            return;
        }

        const text = input.value;
        // 如果输入框包含空括号 []，显示提示；否则隐藏
        if (text.includes('[') && text.includes(']') && /\[\s*\]/.test(text)) {
            tip.style.display = 'block';
        } else {
            tip.style.display = 'none';
        }
    },

    /**
     * 切换实验组别
     * @param {string} group - 组别名称
     */
    async switchGroup(group) {
        AppState.switchGroup(group);
        await Experiment.reset();
    },

    /**
     * 填充Prompt到输入框
     * @param {string} text - Prompt文本
     */
    fillPrompt(text) {
        // 检查是否已完成（优先使用管理员设置的状态）
        const isDone = AppState.completed || AppState.isGroup2TargetReached() || AppState.isGroup1LimitReached();
        if (isDone) {
            if (AppState.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
                alert('目标已达成！你已完成6轮深度探索，实验已完成。');
            } else {
                alert('今日额度已用完，请整理笔记。');
            }
            return;
        }

        const input = Utils.getElement('user-input');
        const tip = Utils.getElement('tip-box');

        if (input) {
            input.value = text;
            input.focus();
            
            // 光标自动停在第一个 [] 处
            this._setCursorToPlaceholder(input);
        }

        // 更新提示框显示状态
        this._updateTipVisibility();

        UI.updateInputState();
    },

    /**
     * 设置光标位置到占位符处
     * @private
     * @param {HTMLElement} input - 输入框元素
     */
    _setCursorToPlaceholder(input) {
        const value = input.value;
        const placeholderIndex = value.indexOf('[]');
        
        if (placeholderIndex !== -1) {
            // 设置光标位置在 [] 中间
            setTimeout(() => {
                input.setSelectionRange(placeholderIndex + 1, placeholderIndex + 1);
            }, 0);
        }
    },


    /**
     * 发送消息
     */
    async sendMessage() {
        // 检查是否已完成（优先使用管理员设置的状态）
        const isDone = AppState.completed || AppState.isGroup2TargetReached() || AppState.isGroup1LimitReached();
        if (isDone) {
            if (AppState.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
                alert('目标已达成！你已完成6轮深度探索，实验已完成。');
            } else {
                alert('今日额度已用完，请整理笔记。');
            }
            return;
        }

        // 检查最后一条AI消息是否已验证
        if (typeof Messages !== 'undefined' && Messages.isLastAiMessageVerified) {
            const isVerified = Messages.isLastAiMessageVerified();
            if (!isVerified) {
                alert('请先验证上一条AI回复，然后才能继续提问。');
                return;
            }
        }

        const input = Utils.getElement('user-input');
        if (!input) {
            return;
        }

        const text = input.value.trim();
        if (!text) {
            return;
        }

        // 验证占位符
        if (Utils.hasUnmodifiedPlaceholder(text)) {
            alert('请将 [] 替换为你关心的变量或场景。');
            return;
        }

        // 添加用户消息
        Messages.append('user', text);
        input.value = '';

        const tip = Utils.getElement('tip-box');
        if (tip) {
            tip.style.display = 'none';
        }

        // 更新对话历史
        AppState.conversationHistory.push({
            role: 'user',
            content: text
        });

        // 更新状态（不增加轮次，等AI回复完成后再增加）
        AppState.isAiTyping = true;
        UI.update();

        // 显示打字指示器
        Messages.appendTypingIndicator();

        try {
            // 创建AI消息容器
            AppState.currentAiMessageElement = Messages.createAiContainer();

            // 调用API
            const fullResponse = await API.sendMessage(text);

            // 移除打字指示器
            Messages.removeTypingIndicator();

            // 完成流式输出
            AppState.isAiTyping = false;

            // 更新对话历史
            AppState.conversationHistory.push({
                role: 'assistant',
                content: fullResponse
            });

            // 增加轮次（AI回复完成后）
            AppState.incrementTurn();
            
            // 保存进度
            await AppState.saveProgress();

            // 显示操作按钮（复制和刷新）
            if (AppState.currentAiMessageElement) {
                Messages.showActionButtons(AppState.currentAiMessageElement);
            }

            // 机制A: 启动等待查看消息的机制（打字机锁定）
            Mechanisms.startViewingLock();

            // 机制B: 在特定轮次触发高亮任务（在查看解锁后）
            if (AppState.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
                const shouldTriggerHighlight = Mechanisms.shouldTriggerHighlightTask();
                if (shouldTriggerHighlight) {
                    // 延迟触发，等待查看解锁完成
                    setTimeout(() => {
                        if (!AppState.waitingForView) {
                            AppState.showHighlightTask = true;
                            Mechanisms.setupHighlightTask();
                            UI.update();
                        }
                    }, 3500); // 3秒查看时间 + 0.5秒缓冲
                }
            }

            // 更新进度条（AI回复完成后）
            UI.update();

            // 机制C: 视觉奖励（完成6轮对话时）
            // 延迟触发，等待查看解锁完成后再显示奖励
            if (AppState.isGroup2TargetReached()) {
                console.log('机制C: 检测到完成6轮对话，准备显示奖励');
                // 延迟触发，确保用户已经查看完消息
                setTimeout(() => {
                    console.log('机制C: 触发视觉奖励');
                    // 点亮概念墙中的"Pointers"
                    Mechanisms.lightUpConcept('Pointers');
                    // 显示奖励弹窗
                    Mechanisms.showConceptMasteredReward();
                }, 4000); // 等待查看解锁完成（约3.5秒）+ 缓冲时间
            }

            AppState.currentAiMessageElement = null;

        } catch (error) {
            console.error('Error calling API:', error);
            
            // 确保状态被正确清理
            Messages.removeTypingIndicator();
            AppState.isAiTyping = false;
            AppState.currentAiMessageElement = null;
            
            // 如果已经有部分响应，显示它；否则显示错误消息
            if (AppState.currentAiMessageElement) {
                // 如果消息容器已创建，显示错误
                Messages.append('ai', 
                    '抱歉，发生了错误。请检查后端服务器是否正在运行（http://localhost:3000），或稍后重试。\n\n错误信息：' + error.message);
            } else {
                Messages.append('ai', 
                    '抱歉，发生了错误。请检查后端服务器是否正在运行（http://localhost:3000），或稍后重试。\n\n错误信息：' + error.message);
            }
            
            // 错误时也增加轮次（因为已经发送了消息）
            AppState.incrementTurn();
            // 保存进度（不等待完成，避免阻塞）
            AppState.saveProgress().catch(e => {
                console.warn('保存进度失败:', e.message);
            });
            UI.update();
        }
    }
};

// 全局函数，供HTML调用
function switchGroup(group) {
    Main.switchGroup(group);
}

function resetExperiment() {
    Experiment.reset();
}

function fillPrompt(text) {
    Main.fillPrompt(text);
}

function sendMessage() {
    Main.sendMessage();
}

// 初始化（由登录检查逻辑调用，不在这里自动初始化）
// window.onload 中的初始化已移至登录检查逻辑中

