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
            return;
        }
        
        // 如果已经初始化，只更新UI，不重新初始化
        if (this.isInitialized) {
            this._updateUserInfoDisplay();
            if (typeof UI !== 'undefined' && UI.update) {
                UI.update();
            }
            return;
        }
        
        this.isInitializing = true;
        
        try {
            // 首先清理可能残留的状态，避免卡住
            AppState.isAiTyping = false;
            AppState.isInputLocked = false;
            AppState.showHighlightTask = false;
            AppState.waitingForView = false;
            AppState.currentAiMessageElement = null;
            
            // 确保输入框在初始化时可用
            const input = Utils.getElement('user-input');
            if (input) {
                input.disabled = false;
                input.removeAttribute('readonly');
                input.style.pointerEvents = 'auto';
                input.style.userSelect = 'text';
                // 确保输入框可以接收焦点
                input.setAttribute('tabindex', '0');
            }
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
                // 静默失败
            }
            
            try {
                if (typeof Resizer !== 'undefined' && Resizer.init) {
                    Resizer.init();
                }
            } catch (e) {
                // 静默失败
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
            
            // 记录页面访问事件
            if (typeof Tracking !== 'undefined' && Tracking.trackPageView) {
                Tracking.trackPageView();
            }
            
            // 初始化划词功能
            if (typeof KeywordHighlighter !== 'undefined' && KeywordHighlighter.init) {
                KeywordHighlighter.init();
            }
            
            // 异步加载任务配置和用户进度，不阻塞初始化（添加超时保护）
            AppState.loadTopicConfig().catch(() => {
                // 静默失败，使用默认配置
            }).then(async () => {
                // 任务配置加载完成后，更新UI（包括标题和提示）
                if (typeof UI !== 'undefined' && UI.update) {
                    UI.update();
                }
                // 更新页面标题
                this._updateTopicTitle();
                
                // 加载当天的概念墙
                await this.loadTodayConcepts();
            });
            
            AppState.loadProgress().catch(() => {
                // 静默失败，使用默认值
            }).then(() => {
                // 进度加载完成后，更新UI
                this._updateUserInfoDisplay();
                if (typeof UI !== 'undefined' && UI.update) {
                    UI.update();
                }
                // 确保输入框状态正确
                if (typeof UI !== 'undefined' && UI.updateInputState) {
                    UI.updateInputState();
                }
            });
            
            // 加载消息历史（在重置之前，这样重置时不会清空历史消息）
            this.loadMessageHistory().catch(() => {
                // 如果加载失败，确保显示欢迎消息
                const chatBox = Utils.getElement('chat-messages');
                if (chatBox && chatBox.children.length === 0) {
                    this._showWelcomeMessage();
                }
            }).then(() => {
                // 消息历史加载完成后，如果没有消息，才执行重置
                const chatBox = Utils.getElement('chat-messages');
                if (chatBox && chatBox.children.length === 0) {
                    // 如果聊天框为空，显示欢迎消息
                    this._showWelcomeMessage();
                }
            });
            
            // 启动定期刷新进度（每30秒刷新一次，确保管理员设置后能及时更新）
            this.startProgressRefresh();
        } catch (error) {
            // 初始化失败，静默处理
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
     * 显示欢迎消息
     * @private
     */
    _showWelcomeMessage() {
        const groupLabel = AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME
            ? GROUP_CONFIG.GROUP1.LABEL
            : GROUP_CONFIG.GROUP2.LABEL;
        
        if (typeof Messages !== 'undefined' && Messages.append) {
            Messages.append('ai', 
                `欢迎来到实验系统。\n组别: ${groupLabel}。\n\n请从左侧选择一个提示开始。`, 
                true);
        }
    },
    
    /**
     * 加载消息历史
     */
    async loadMessageHistory() {
        try {
            if (typeof API === 'undefined' || !API.getMessages) {
                return;
            }
            
            const result = await API.getMessages();
            
            // 处理不同的响应格式
            let messages = [];
            let sessionId = null;
            
            if (result.success && result.messages) {
                messages = result.messages || [];
                sessionId = result.sessionId || null;
            } else if (Array.isArray(result.messages)) {
                messages = result.messages;
                sessionId = result.sessionId || null;
            } else if (Array.isArray(result)) {
                messages = result;
            }
            
            // 保存会话ID
            if (sessionId) {
                AppState.currentSessionId = sessionId;
            }
            
            // 如果有消息历史，显示它们
            if (messages && messages.length > 0) {
                const chatBox = Utils.getElement('chat-messages');
                if (chatBox) {
                    // 完全清空聊天框（包括欢迎消息）
                    chatBox.innerHTML = '';
                    
                    // 按顺序显示历史消息
                    let aiMessageCount = 0;
                    messages.forEach((msg, index) => {
                        
                        // 支持多种role格式：'user', 'assistant', 'ai'
                        if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'ai') {
                            const role = (msg.role === 'assistant' || msg.role === 'ai') ? 'ai' : 'user';
                            const content = msg.content || msg.text || '';
                            
                            if (!content || content.trim() === '') {
                                return;
                            }
                            
                            // 如果是用户消息，检查是否使用了左侧提示词
                            if (role === 'user') {
                                const templateId = this._extractTemplateId(content);
                                if (templateId) {
                                    AppState.hasUsedLeftPrompt = true;
                                }
                            }
                            
                            // 判断是否为初始消息（第一条AI消息）
                            const isInitialMessage = role === 'ai' && aiMessageCount === 0;
                            if (role === 'ai') {
                                aiMessageCount++;
                            }
                            
                            if (typeof Messages !== 'undefined' && Messages.append) {
                                try {
                                    Messages.append(role, content, isInitialMessage);
                                } catch (error) {
                                    // 静默失败
                                }
                                
                                // 如果是AI消息且已验证，标记为已验证
                                if (role === 'ai' && index < messages.length - 1) {
                                    // 不是最后一条消息，说明已经验证过了
                                    setTimeout(() => {
                                        const allMessages = chatBox.querySelectorAll('.flex.justify-start');
                                        const lastAiMsg = allMessages[allMessages.length - 1];
                                        if (lastAiMsg) {
                                            const verifyBtn = lastAiMsg.querySelector('.verify-btn');
                                            if (verifyBtn) {
                                                verifyBtn.dataset.verified = 'true';
                                                const verifyText = verifyBtn.querySelector('.verify-text');
                                                if (verifyText) {
                                                    verifyText.textContent = '已验证';
                                                }
                                                const icon = verifyBtn.querySelector('i');
                                                if (icon) {
                                                    icon.setAttribute('data-lucide', 'check-circle');
                                                    if (typeof lucide !== 'undefined') {
                                                        lucide.createIcons();
                                                    }
                                                }
                                                verifyBtn.classList.remove('text-amber-500', 'hover:text-amber-600', 'hover:bg-amber-50');
                                                verifyBtn.classList.add('text-green-500', 'hover:text-green-600', 'hover:bg-green-50');
                                            }
                                        }
                                    }, 100);
                                }
                            }
                        }
                    });
                    
                    // 消息历史加载完成后，更新UI（因为 hasUsedLeftPrompt 可能已改变）
                    if (typeof UI !== 'undefined' && UI.update) {
                        UI.update();
                    }
                    
                    // 滚动到底部
                    if (typeof Utils !== 'undefined' && Utils.scrollToBottom) {
                        Utils.scrollToBottom(chatBox);
                    }
                    
                    // 确保输入框可用
                    if (typeof UI !== 'undefined' && UI.updateInputState) {
                        UI.updateInputState();
                    }
                }
            } else {
                // 如果没有消息历史，显示欢迎消息
                this._showWelcomeMessage();
            }
        } catch (error) {
            // 如果加载失败，不影响正常使用，显示欢迎消息
            
            // 只有在聊天框为空时才显示欢迎消息
            const chatBox = Utils.getElement('chat-messages');
            if (chatBox && chatBox.children.length === 0) {
                this._showWelcomeMessage();
            }
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
                return;
            }
            
            isRefreshing = true;
            try {
                await AppState.loadProgress();
                // 更新用户信息显示（包括进度）
                this._updateUserInfoDisplay();
            } catch (error) {
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
    /**
     * 更新页面标题（从任务配置读取）
     * @private
     */
    _updateTopicTitle() {
        if (!AppState.topicConfig) {
            return;
        }
        
        // 更新左侧面板的标题
        const titleElement = document.querySelector('#left-panel h2');
        if (titleElement && AppState.topicConfig.topic_name) {
            titleElement.textContent = AppState.topicConfig.topic_name;
        }
    },

    _updateUserInfoDisplay() {
        const userInfoElement = Utils.getElement('current-user-info');
        if (userInfoElement) {
            if (AppState.userInfo && AppState.userInfo.username) {
                // 严格验证：确保 group 字段存在
                if (!AppState.userInfo.group) {
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
    /**
     * 从消息文本中提取模板ID（辅助函数）
     * @private
     */
    _extractTemplateId(text) {
        // 尝试匹配已知的模板文本
        if (!AppState.topicConfig || !AppState.topicConfig.available_templates) {
            return null;
        }
        
        const templates = AppState.topicConfig.available_templates;
        if (templates.start && text.includes(templates.start.text.substring(0, 20))) {
            return 'start';
        }
        
        if (templates.options) {
            for (let i = 0; i < templates.options.length; i++) {
                const opt = templates.options[i];
                if (opt.text && text.includes(opt.text.substring(0, 20))) {
                    return `option_${i}`;
                }
            }
        }
        
        return null;
    },

    fillPrompt(text) {
        // 标记用户使用了左侧提示词
        AppState.hasUsedLeftPrompt = true;
        
        // 记录选择模板事件
        if (typeof Tracking !== 'undefined' && Tracking.trackSelectTemplate) {
            const templateId = this._extractTemplateId(text);
            const templateType = templateId === 'start' ? 'start' : 'options';
            Tracking.trackSelectTemplate(templateType, templateId || 'unknown');
        }
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
        // 防止重复请求：如果正在发送消息，直接返回
        if (this._isSendingMessage) {
            return;
        }

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

        // 检查最后一条AI消息是否已验证（只有在需要验证时才检查）
        // 如果 showHighlightTask 或 waitingForView 为 true，说明需要先完成交互，但不阻止用户输入
        if (AppState.showHighlightTask || AppState.waitingForView) {
            // 允许用户输入，但在发送时提示需要先完成交互
            // 不阻止发送，让用户可以先输入内容
        }
        
        // 检查最后一条AI消息是否已验证（只有在需要验证时才检查）
        if (typeof Messages !== 'undefined' && Messages.isLastAiMessageVerified) {
            const isVerified = Messages.isLastAiMessageVerified();
            if (!isVerified && !AppState.showHighlightTask && !AppState.waitingForView) {
                // 只有在不需要交互任务时才检查验证
                // alert('请先验证上一条AI回复，然后才能继续提问。');
                // return;
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

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 标记正在发送消息
        this._isSendingMessage = true;
        this._currentRequestId = requestId;

        // 添加用户消息
        Messages.append('user', text);
        input.value = '';

        // 记录发送消息事件
        if (typeof Tracking !== 'undefined' && Tracking.trackSendMessage) {
            // 尝试从消息中提取模板ID（如果有）
            const templateId = this._extractTemplateId(text);
            const isEdited = templateId && Utils.hasUnmodifiedPlaceholder ? !Utils.hasUnmodifiedPlaceholder(text) : false;
            Tracking.trackSendMessage(text, templateId, isEdited);
        }

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

            // 注意：不再在前端增加轮次，因为后端在保存AI消息时已经自动更新了turn_count
            // 前端应该从后端重新加载进度，以保持与数据库同步
            // 从后端重新加载进度（后端会根据消息数量自动计算turn_count）
            await AppState.loadProgress();

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
                // 延迟触发，确保用户已经查看完消息
                setTimeout(() => {
                    // 获取当天的topic名称，添加到概念墙
                    const topicName = AppState.topicConfig?.topic_name || 'C++ 指针';
                    // 点亮概念墙中的当天topic
                    Mechanisms.lightUpConcept(topicName);
                    // 显示奖励弹窗
                    Mechanisms.showConceptMasteredReward();
                }, 4000); // 等待查看解锁完成（约3.5秒）+ 缓冲时间
            }
            
            // 机制C: 视觉奖励（完成组别1的轮次时）
            // 对于组别1，完成最大轮次后也添加概念
            if (AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME && AppState.isGroup1LimitReached()) {
                setTimeout(() => {
                    const topicName = AppState.topicConfig?.topic_name || 'C++ 指针';
                    Mechanisms.lightUpConcept(topicName);
                }, 4000);
            }

            AppState.currentAiMessageElement = null;

            // 清除发送标记
            this._isSendingMessage = false;
            this._currentRequestId = null;

        } catch (error) {
            // 确保状态被正确清理
            Messages.removeTypingIndicator();
            AppState.isAiTyping = false;
            AppState.currentAiMessageElement = null;
            
            // 显示错误消息
            Messages.append('ai', 
                `抱歉，发生了错误。请检查后端服务器是否正在运行（${CONFIG.API_BASE_URL}），或稍后重试。\n\n错误信息：${error.message}`);
            
            // 错误时也从后端重新加载进度（因为用户消息可能已经保存）
            AppState.loadProgress().catch(() => {
                // 静默失败
            });
            UI.update();
            
            // 清除发送标记
            this._isSendingMessage = false;
            this._currentRequestId = null;
        }
    },

    /**
     * 加载当天的概念墙
     */
    async loadTodayConcepts() {
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            if (typeof API !== 'undefined' && API.getConcepts) {
                const response = await API.getConcepts(todayStr);
                if (response && response.concepts) {
                    const container = Utils.getElement('concept-wall-list');
                    if (container) {
                        // 清空现有列表
                        container.innerHTML = '';
                        
                        // 去重（按概念名称）
                        const uniqueConcepts = new Map();
                        response.concepts.forEach(concept => {
                            if (!uniqueConcepts.has(concept.concept_name)) {
                                uniqueConcepts.set(concept.concept_name, concept);
                            }
                        });
                        
                        // 添加概念砖块
                        uniqueConcepts.forEach(concept => {
                            const conceptBrick = Utils.createElement('div', 
                                'concept-brick px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-600 font-semibold text-sm shadow-lg');
                            
                            conceptBrick.textContent = concept.concept_name;
                            container.appendChild(conceptBrick);
                        });
                    }
                }
            }
        } catch (error) {
            // 静默失败
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

