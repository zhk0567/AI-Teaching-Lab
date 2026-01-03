/**
 * 消息处理模块
 * 负责聊天消息的创建、显示和管理
 */

const Messages = {
    /**
     * 添加消息
     * @param {string} role - 角色 ('user' 或 'ai')
     * @param {string} text - 消息文本
     * @param {boolean} isInitialMessage - 是否为初始欢迎消息（不需要验证）
     */
    append(role, text, isInitialMessage = false) {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return;
        }

        // 如果是AI消息，检查是否已经有其他AI消息（排除打字指示器）
        if (role === 'ai') {
            const existingAiMessages = box.querySelectorAll('.flex.justify-start:not(.typing-indicator)');
            // 如果没有其他AI消息，自动标记为初始消息
            if (existingAiMessages.length === 0) {
                isInitialMessage = true;
            }
        }

        const div = Utils.createElement('div', 
            `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`);

        const bubbleClass = role === 'user'
            ? 'bg-blue-600 text-white rounded-tr-none'
            : 'bg-white text-slate-700 border border-gray-200 rounded-tl-none hover:shadow-md cursor-pointer group relative';

        let contentHtml;
        if (role === 'ai') {
            // AI消息使用Markdown渲染
            const markdownHtml = Utils.markdownToHtml(text);
            contentHtml = `<div class="prose prose-sm max-w-none ai-message-content">${markdownHtml}</div>`;
            contentHtml = this._wrapAiMessage(contentHtml, isInitialMessage);
            
            // 如果是初始消息，标记为不需要验证
            if (isInitialMessage) {
                div.dataset.initialMessage = 'true';
            } else {
                div.onclick = this._handleAiMessageClick.bind(this);
            }
        } else {
            // 用户消息保持纯文本
            contentHtml = `<div class="whitespace-pre-wrap text-sm">${Utils.escapeHtml(text)}</div>`;
        }

        div.innerHTML = `
            <div class="max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all ${bubbleClass}">
                ${contentHtml}
            </div>`;

        box.appendChild(div);
        
        // 高亮代码块
        if (role === 'ai') {
            const messageContent = div.querySelector('.ai-message-content');
            Utils.highlightCode(messageContent);
            
            // 为新添加的AI消息禁用浏览器默认选择菜单
            if (typeof KeywordHighlighter !== 'undefined' && KeywordHighlighter.disableDefaultSelectionMenu) {
                KeywordHighlighter.disableDefaultSelectionMenu(messageContent);
            }
            
            // 存储AI消息的原始文本（用于复制和刷新）
            const bubble = div.querySelector('.bg-white');
            if (bubble) {
                bubble.dataset.originalText = text;
                
                    // 如果不是初始消息，给整个消息气泡添加点击事件来触发验证
                if (!isInitialMessage) {
                    bubble.onclick = (e) => {
                        // 如果点击的是按钮或链接，不触发验证
                        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('code')) {
                            return;
                        }
                        // 如果有选中的文本，不触发验证（让划词功能处理）
                        const selection = window.getSelection();
                        if (selection && selection.toString().trim().length > 0) {
                            return;
                        }
                        // 触发验证
                        const verifyBtn = bubble.querySelector('.verify-btn');
                        if (verifyBtn && verifyBtn.dataset.verified !== 'true') {
                            Messages.verifyMessage({ target: verifyBtn, stopPropagation: () => {} });
                        }
                    };
                }
            }
            
            // 显示操作按钮（非流式输出时，立即显示）
            this.showActionButtons(messageContent);
        }
        
        Utils.scrollToBottom(box);
        lucide.createIcons();
    },

    /**
     * 包装AI消息
     * @private
     * @param {string} contentHtml - 消息内容HTML
     * @param {boolean} isInitialMessage - 是否为初始消息（不需要验证）
     */
    _wrapAiMessage(contentHtml, isInitialMessage = false) {
        // 如果是初始消息，不添加验证按钮
        const verifyButton = isInitialMessage ? '' : `
                <button onclick="Messages.verifyMessage(event)" 
                        class="verify-btn hidden items-center gap-1 text-amber-500 text-[10px] hover:text-amber-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-amber-50"
                        title="点击标记为已阅读">
                    <i data-lucide="mouse-pointer-2" width="10" height="10"></i> 
                    <span class="verify-text">点击验证</span>
                </button>`;
        
        return `
            <div class="mb-1 text-xs font-bold text-gray-400">
                AI 导师
            </div>
            ${contentHtml}
            <div class="ai-action-buttons mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 hidden transition-opacity">
                <div class="flex items-center gap-2">
                <button onclick="Messages.copyMessage(event)" 
                        class="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-gray-50"
                        title="复制回复">
                    <i data-lucide="copy" width="14" height="14"></i>
                    <span>复制</span>
                </button>
                <button onclick="Messages.regenerateMessage(event)" 
                        class="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors px-2 py-1 rounded hover:bg-gray-50"
                        title="重新生成">
                    <i data-lucide="refresh-cw" width="14" height="14"></i>
                    <span>刷新</span>
                    </button>
                </div>
                ${verifyButton}
            </div>`;
    },

    /**
     * 处理AI消息点击
     * @private
     */
    _handleAiMessageClick() {
        // 机制B的点击处理已移到Main._setupHighlightTask中
        // 这里保留用于其他可能的交互
    },

    /**
     * 验证消息（标记为已阅读）
     * @param {Event} event - 点击事件
     */
    verifyMessage(event) {
        event.stopPropagation();
        
        const button = event.target.closest('.verify-btn');
        if (!button) {
            return;
        }

        // 检查是否已经验证过
        if (button.dataset.verified === 'true') {
            return;
        }

        // 记录验证消息事件
        if (typeof Tracking !== 'undefined' && Tracking.trackVerifyMessage) {
            const turnIndex = AppState?.turnCount || 0;
            Tracking.trackVerifyMessage(turnIndex);
        }

        // 标记为已验证
        button.dataset.verified = 'true';
        
        // 更新按钮样式和文本
        const verifyText = button.querySelector('.verify-text');
        const icon = button.querySelector('i');
        
        if (verifyText) {
            verifyText.textContent = '已验证';
        }
        
        if (icon) {
            // 更换图标为勾选图标
            icon.setAttribute('data-lucide', 'check-circle');
            // 重新初始化图标
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
        
        // 更新按钮样式
        button.classList.remove('text-amber-500', 'hover:text-amber-600', 'hover:bg-amber-50');
        button.classList.add('text-green-500', 'hover:text-green-600', 'hover:bg-green-50');
        button.classList.remove('animate-pulse');
        
        // 添加成功反馈动画
        button.style.transform = 'scale(1.1)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
            button.style.transition = 'transform 0.2s';
        }, 200);
        
        // 验证后立即解锁提示按钮（如果正在等待查看）
        if (AppState.waitingForView) {
            const messageElement = button.closest('.flex.justify-start');
            if (messageElement && typeof Mechanisms !== 'undefined' && Mechanisms.unlockPrompts) {
                // 清除查看计时器
                AppState._clearViewTimer();
                // 立即解锁
                Mechanisms.unlockPrompts(messageElement);
            }
        }
        
        // 如果高亮任务已激活，验证后也应该解锁
        if (AppState.showHighlightTask) {
            AppState.showHighlightTask = false;
            if (typeof UI !== 'undefined' && UI.update) {
                UI.update();
            }
        }
    },

    /**
     * 检查最后一条AI消息是否已验证
     * @returns {boolean} - 如果最后一条AI消息已验证，返回true；如果没有AI消息或未验证，返回false
     */
    isLastAiMessageVerified() {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return true; // 如果没有消息框，允许发送（可能是首次发送）
        }

        // 从后往前查找最后一条AI消息
        const allMessages = Array.from(box.querySelectorAll('.flex.justify-start'));
        if (allMessages.length === 0) {
            return true; // 没有消息，允许发送
        }

        // 找到最后一条AI消息（justify-start表示AI消息）
        const lastAiMessage = allMessages[allMessages.length - 1];
        if (!lastAiMessage) {
            return true; // 没有AI消息，允许发送
        }

        // 如果是初始消息，不需要验证
        if (lastAiMessage.dataset.initialMessage === 'true') {
            return true;
        }

        // 查找验证按钮
        const verifyBtn = lastAiMessage.querySelector('.verify-btn');
        if (!verifyBtn) {
            // 如果没有验证按钮，可能是旧消息或用户消息，允许发送
            return true;
        }

        // 检查是否已验证
        return verifyBtn.dataset.verified === 'true';
    },

    /**
     * 创建AI消息容器（用于流式输出）
     * @returns {HTMLElement} - 消息内容元素
     */
    createAiContainer() {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return null;
        }

        // 检查是否已经有其他AI消息（排除打字指示器）
        const existingAiMessages = box.querySelectorAll('.flex.justify-start:not(.typing-indicator)');
        const isFirstAiMessage = existingAiMessages.length === 0;

        const div = Utils.createElement('div', 'flex justify-start');
        // 如果是第一条AI消息，标记为不需要验证
        if (isFirstAiMessage) {
            div.dataset.initialMessage = 'true';
        }
        const bubbleClass = 'bg-white text-slate-700 border border-gray-200 rounded-tl-none hover:shadow-md cursor-pointer group relative';

        // 如果是第一条AI消息，不添加验证按钮
        const verifyButton = isFirstAiMessage ? '' : `
                    <button onclick="Messages.verifyMessage(event)" 
                            class="verify-btn hidden items-center gap-1 text-amber-500 text-[10px] hover:text-amber-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-amber-50"
                            title="点击标记为已阅读">
                        <i data-lucide="mouse-pointer-2" width="10" height="10"></i> 
                        <span class="verify-text">点击验证</span>
                    </button>`;

        div.innerHTML = `
            <div class="max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all ${bubbleClass}">
                <div class="mb-1 text-xs font-bold text-gray-400">
                    AI 导师
                </div>
                <div class="prose prose-sm max-w-none ai-message-content"></div>
                <div class="ai-action-buttons mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 hidden transition-opacity">
                    <div class="flex items-center gap-2">
                    <button onclick="Messages.copyMessage(event)" 
                            class="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-gray-50"
                            title="复制回复">
                        <i data-lucide="copy" width="14" height="14"></i>
                        <span>复制</span>
                    </button>
                    <button onclick="Messages.regenerateMessage(event)" 
                            class="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors px-2 py-1 rounded hover:bg-gray-50"
                            title="重新生成">
                        <i data-lucide="refresh-cw" width="14" height="14"></i>
                        <span>刷新</span>
                        </button>
                    </div>
                    ${verifyButton}
                </div>
            </div>`;

        box.appendChild(div);
        Utils.scrollToBottom(box);
        lucide.createIcons();

        // 如果不是第一条AI消息，给整个消息气泡添加点击事件来触发验证
        if (!isFirstAiMessage) {
            const bubble = div.querySelector('.bg-white');
            if (bubble) {
                bubble.onclick = (e) => {
                    // 如果点击的是按钮或链接，不触发验证
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('code')) {
                        return;
                    }
                    // 触发验证
                    const verifyBtn = bubble.querySelector('.verify-btn');
                    if (verifyBtn && verifyBtn.dataset.verified !== 'true') {
                        Messages.verifyMessage({ target: verifyBtn, stopPropagation: () => {} });
                    }
                };
            }
        }

        div.onclick = this._handleAiMessageClick.bind(div);

        return div.querySelector('.ai-message-content');
    },

    /**
     * 更新AI消息内容（打字机效果）
     * @param {HTMLElement} element - 消息元素
     * @param {string} text - 消息文本
     */
    updateAiMessage(element, text) {
        if (element) {
            // 使用Markdown渲染
            const markdownHtml = Utils.markdownToHtml(text);
            element.innerHTML = markdownHtml;
            
            // 高亮代码块
            Utils.highlightCode(element);
            
            // 存储原始文本用于复制和刷新
            const bubble = element.closest('.bg-white');
            if (bubble) {
                bubble.dataset.originalText = text;
                
                // 确保在流式输出过程中按钮保持隐藏
                const buttonContainer = bubble.querySelector('.ai-action-buttons');
                if (buttonContainer) {
                    buttonContainer.classList.add('hidden');
                    buttonContainer.classList.remove('opacity-0', 'group-hover:opacity-100');
                }
            }
            
            const chatBox = Utils.getElement('chat-messages');
            Utils.scrollToBottom(chatBox);
        }
    },

    /**
     * 显示操作按钮（在AI回复完成后）
     * @param {HTMLElement} element - 消息内容元素
     */
    showActionButtons(element) {
        if (!element) {
            return;
        }
        
        const bubble = element.closest('.bg-white');
        if (bubble) {
            const buttonContainer = bubble.querySelector('.ai-action-buttons');
            if (buttonContainer) {
                // 移除hidden类，始终显示按钮
                buttonContainer.classList.remove('hidden', 'opacity-0', 'group-hover:opacity-100', 'group-hover:flex');
                buttonContainer.classList.add('flex');
            }
            
            // 显示验证按钮（消息生成完成后）
            const verifyBtn = bubble.querySelector('.verify-btn');
            if (verifyBtn) {
                verifyBtn.classList.remove('hidden', 'group-hover:flex');
                verifyBtn.classList.add('flex');
            }
        }
    },

    /**
     * 添加系统消息
     * @param {string} text - 消息文本
     */
    appendSystem(text) {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return;
        }

        const div = Utils.createElement('div', 'flex justify-center my-4 animate-bounce');
        div.innerHTML = `
            <div class="bg-green-100 border-2 border-green-500 text-green-800 px-6 py-2 
                        rounded-full text-sm font-bold shadow-lg">
                ${Utils.escapeHtml(text)}
            </div>`;

        box.appendChild(div);
        Utils.scrollToBottom(box);
    },

    /**
     * 添加打字指示器
     */
    appendTypingIndicator() {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return;
        }

        const div = Utils.createElement('div', 'flex justify-start');
        div.id = 'typing-indicator';
        div.innerHTML = `
            <div class="bg-white border border-gray-200 p-4 rounded-2xl rounded-tl-none 
                        shadow-sm flex gap-2 items-center">
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
            </div>`;

        box.appendChild(div);
        Utils.scrollToBottom(box);
    },

    /**
     * 移除打字指示器
     */
    removeTypingIndicator() {
        const el = Utils.getElement('typing-indicator');
        if (el) {
            el.remove();
        }
    },

    /**
     * 复制消息内容
     * @param {Event} event - 点击事件
     */
    copyMessage(event) {
        event.stopPropagation();
        
        // 记录复制消息事件
        if (typeof Tracking !== 'undefined' && Tracking.trackCopyMessage) {
            Tracking.trackCopyMessage();
        }
        
        const button = event.target.closest('button');
        const bubble = button?.closest('.bg-white');
        
        if (bubble && bubble.dataset.originalText) {
            const text = bubble.dataset.originalText;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    this._showCopyFeedback();
                }).catch(() => {
                    this._fallbackCopy(text);
                });
            } else {
                this._fallbackCopy(text);
            }
        }
    },

    /**
     * 备用复制方法
     * @private
     * @param {string} text - 要复制的文本
     */
    _fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this._showCopyFeedback();
        } catch (e) {
            alert('复制失败，请手动选择文本复制');
        }
        document.body.removeChild(textarea);
    },

    /**
     * 显示复制反馈
     * @private
     */
    _showCopyFeedback() {
        // 可以添加一个临时的提示
        const feedback = Utils.createElement('div', 
            'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity');
        feedback.textContent = '已复制到剪贴板';
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
    },

    /**
     * 重新生成消息
     * @param {Event} event - 点击事件
     */
    async regenerateMessage(event) {
        event.stopPropagation();
        
        // 记录刷新消息事件
        if (typeof Tracking !== 'undefined' && Tracking.trackRefreshMessage) {
            Tracking.trackRefreshMessage();
        }
        
        // 获取最后一条用户消息
        const lastUserMessage = AppState.conversationHistory
            .slice()
            .reverse()
            .find(msg => msg.role === 'user');

        if (!lastUserMessage) {
            alert('没有可重新生成的消息');
            return;
        }

        // 移除最后一条AI回复
        const conversationHistory = AppState.conversationHistory;
        if (conversationHistory.length > 0 && 
            conversationHistory[conversationHistory.length - 1].role === 'assistant') {
            conversationHistory.pop();
        }

        // 移除当前AI消息显示
        const button = event.target.closest('button');
        const messageDiv = button?.closest('.flex.justify-start');
        if (messageDiv) {
            messageDiv.remove();
        }

        // 重新发送消息
        AppState.isAiTyping = true;
        UI.update();

        Messages.appendTypingIndicator();

        try {
            AppState.currentAiMessageElement = Messages.createAiContainer();

            // 刷新时传递isRegenerate=true以增加随机性
            const fullResponse = await API.sendMessage(lastUserMessage.content, true);

            Messages.removeTypingIndicator();
            AppState.isAiTyping = false;

            conversationHistory.push({
                role: 'assistant',
                content: fullResponse
            });

            // 注意：刷新消息不应该增加轮次，因为这只是重新生成同一轮次的AI回复
            // 轮次应该只在用户发送新消息时增加
            console.log('[日志] 刷新消息完成，不增加轮次', {
                currentTurnCount: AppState.turnCount,
                reason: '刷新只是重新生成回复，不是新对话轮次'
            });

            // 更新流式输出的消息
            if (AppState.currentAiMessageElement) {
                const markdownHtml = Utils.markdownToHtml(fullResponse);
                AppState.currentAiMessageElement.innerHTML = markdownHtml;
                Utils.highlightCode(AppState.currentAiMessageElement);
                
                // 存储原始文本
                const bubble = AppState.currentAiMessageElement.closest('.bg-white');
                if (bubble) {
                    bubble.dataset.originalText = fullResponse;
                }
            }

            // 机制B: 在特定轮次触发高亮任务
            if (AppState.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
                // 延迟触发，等待消息渲染完成
                setTimeout(() => {
                    if (typeof Mechanisms !== 'undefined' && Mechanisms.shouldTriggerHighlightTask) {
                        const shouldTrigger = Mechanisms.shouldTriggerHighlightTask();
                        if (shouldTrigger) {
                            AppState.showHighlightTask = true;
                            Mechanisms.setupHighlightTask();
                            UI.update();
                        }
                    }
                }, 100);
            }

            // 更新进度条
            UI.update();
            AppState.currentAiMessageElement = null;

        } catch (error) {
            console.error('Error regenerating message:', error);
            Messages.removeTypingIndicator();
            AppState.isAiTyping = false;
            Messages.append('ai', 
                '抱歉，重新生成时发生错误。请稍后重试。\n\n错误信息：' + error.message);
            UI.update();
        }
    }
};

