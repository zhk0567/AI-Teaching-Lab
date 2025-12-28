/**
 * 消息处理模块
 * 负责聊天消息的创建、显示和管理
 */

const Messages = {
    /**
     * 添加消息
     * @param {string} role - 角色 ('user' 或 'ai')
     * @param {string} text - 消息文本
     */
    append(role, text) {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return;
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
            contentHtml = this._wrapAiMessage(contentHtml);
            div.onclick = this._handleAiMessageClick.bind(this);
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
            
            // 存储AI消息的原始文本（用于复制和刷新）
            const bubble = div.querySelector('.bg-white');
            if (bubble) {
                bubble.dataset.originalText = text;
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
     */
    _wrapAiMessage(contentHtml) {
        return `
            <div class="mb-1 text-xs font-bold text-gray-400 flex justify-between items-center">
                AI 导师
                <span class="hidden group-hover:flex items-center gap-1 text-amber-500 text-[10px] animate-pulse">
                    <i data-lucide="mouse-pointer-2" width="10"></i> 点击验证
                </span>
            </div>
            ${contentHtml}
            <div class="ai-action-buttons mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 hidden group-hover:flex transition-opacity">
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
     * 创建AI消息容器（用于流式输出）
     * @returns {HTMLElement} - 消息内容元素
     */
    createAiContainer() {
        const box = Utils.getElement('chat-messages');
        if (!box) {
            return null;
        }

        const div = Utils.createElement('div', 'flex justify-start');
        const bubbleClass = 'bg-white text-slate-700 border border-gray-200 rounded-tl-none hover:shadow-md cursor-pointer group relative';

        div.innerHTML = `
            <div class="max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all ${bubbleClass}">
                <div class="mb-1 text-xs font-bold text-gray-400 flex justify-between items-center">
                    AI 导师
                    <span class="hidden group-hover:flex items-center gap-1 text-amber-500 text-[10px] animate-pulse">
                        <i data-lucide="mouse-pointer-2" width="10"></i> 点击验证
                    </span>
                </div>
                <div class="prose prose-sm max-w-none ai-message-content"></div>
                <div class="ai-action-buttons mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 hidden group-hover:flex transition-opacity">
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
            </div>`;

        box.appendChild(div);
        Utils.scrollToBottom(box);
        lucide.createIcons();

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
                // 移除hidden类，显示按钮（仅在hover时显示）
                buttonContainer.classList.remove('hidden');
                buttonContainer.classList.add('opacity-0', 'group-hover:opacity-100');
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

            // 增加轮次（刷新消息时，AI回复完成后）
            AppState.incrementTurn();

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
                    if (typeof Main !== 'undefined' && Main._shouldTriggerHighlightTask) {
                        const shouldTrigger = Main._shouldTriggerHighlightTask();
                        if (shouldTrigger) {
                            AppState.showHighlightTask = true;
                            Main._setupHighlightTask();
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

