/**
 * 主逻辑模块
 * 负责应用初始化和核心业务逻辑
 */

const Main = {
    /**
     * 初始化应用
     */
    init() {
        lucide.createIcons();
        Resizer.init();
        this.resetExperiment();
        this._setupInputListener();
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
    switchGroup(group) {
        AppState.switchGroup(group);
        this.resetExperiment();
    },

    /**
     * 重置实验
     */
    resetExperiment() {
        AppState.reset();

        const chatBox = Utils.getElement('chat-messages');
        if (chatBox) {
            chatBox.innerHTML = '';
        }

        // 隐藏提示框
        const tip = Utils.getElement('tip-box');
        if (tip) {
            tip.style.display = 'none';
        }

        // 清空输入框
        const input = Utils.getElement('user-input');
        if (input) {
            input.value = '';
        }

        const groupLabel = AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME
            ? GROUP_CONFIG.GROUP1.LABEL
            : GROUP_CONFIG.GROUP2.LABEL;

        Messages.append('ai', 
            `欢迎来到实验系统。\n组别: ${groupLabel}。\n\n请从左侧选择一个提示开始。`);

        UI.update();
    },

    /**
     * 填充Prompt到输入框
     * @param {string} text - Prompt文本
     */
    fillPrompt(text) {
        // 检查是否已达到目标，禁止继续提问
        if (AppState.isGroup2TargetReached()) {
            alert('目标已达成！你已完成6轮深度探索，实验已完成。');
            return;
        }
        if (AppState.isGroup1LimitReached()) {
            alert('今日额度已用完，请整理笔记。');
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
     * 启动查看锁定机制（机制A）
     * @private
     */
    _startViewingLock() {
        // 清除之前的计时器
        AppState._clearViewTimer();
        
        // 获取最后一条AI消息
        const chatBox = Utils.getElement('chat-messages');
        if (!chatBox) {
            return;
        }

        const aiMessages = chatBox.querySelectorAll('.flex.justify-start');
        const lastAiMessage = aiMessages[aiMessages.length - 1];
        
        if (!lastAiMessage) {
            return;
        }

        // 设置等待查看状态
        AppState.waitingForView = true;
        UI.update();

        // 使用 Intersection Observer 检测消息是否在视口中
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 消息进入视口，开始计时
                    if (!AppState.viewStartTime) {
                        AppState.viewStartTime = Date.now();
                    }

                    // 检查是否已经停留足够时间（2-3秒）
                    AppState.viewTimer = setInterval(() => {
                        const elapsed = Date.now() - AppState.viewStartTime;
                        const requiredTime = 2500; // 2.5秒

                        if (elapsed >= requiredTime) {
                            // 解锁按钮并显示动画
                            this._unlockPrompts(lastAiMessage);
                            observer.disconnect();
                            AppState._clearViewTimer();
                        }
                    }, 100); // 每100ms检查一次
                } else {
                    // 消息离开视口，重置计时
                    AppState.viewStartTime = null;
                    if (AppState.viewTimer) {
                        clearInterval(AppState.viewTimer);
                        AppState.viewTimer = null;
                    }
                }
            });
        }, {
            threshold: 0.3, // 至少30%在视口中
            rootMargin: '0px'
        });

        observer.observe(lastAiMessage);

        // 如果消息已经在视口中，立即开始计时
        if (Utils.isElementPartiallyInViewport(lastAiMessage)) {
            AppState.viewStartTime = Date.now();
            AppState.viewTimer = setInterval(() => {
                const elapsed = Date.now() - AppState.viewStartTime;
                const requiredTime = 2500; // 2.5秒

                if (elapsed >= requiredTime) {
                    this._unlockPrompts(lastAiMessage);
                    observer.disconnect();
                    AppState._clearViewTimer();
                }
            }, 100);
        }
    },

    /**
     * 解锁Prompt按钮并显示动画
     * @private
     * @param {HTMLElement} messageElement - AI消息元素
     */
    _unlockPrompts(messageElement) {
        // 防止重复调用
        if (!AppState.waitingForView) {
            return;
        }
        
        AppState.waitingForView = false;
        
        // 添加解锁动画到消息
        if (messageElement) {
            const bubble = messageElement.querySelector('.bg-white');
            if (bubble) {
                bubble.classList.add('animate-pulse');
                setTimeout(() => {
                    bubble.classList.remove('animate-pulse');
                }, 1000);
            }
        }

        // 先显示解锁提示，再更新UI
        const container = Utils.getElement('prompt-container');
        if (container) {
            // 检查是否已经存在解锁提示，避免重复添加
            const existingNotice = container.querySelector('.unlock-notice');
            if (existingNotice) {
                return;
            }
            
            const unlockNotice = Utils.createElement('div', 
                'unlock-notice mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm animate-fade-in');
            unlockNotice.innerHTML = `
                <div class="flex items-center gap-2">
                    <i data-lucide="unlock" width="16" height="16"></i>
                    <span>已解锁，可以继续提问</span>
                </div>`;
            container.appendChild(unlockNotice);
            lucide.createIcons();
            
            // 3秒后移除提示
            setTimeout(() => {
                if (unlockNotice.parentNode) {
                    unlockNotice.style.opacity = '0';
                    unlockNotice.style.transition = 'opacity 0.3s';
                    setTimeout(() => {
                        if (unlockNotice.parentNode) {
                            unlockNotice.remove();
                        }
                    }, 300);
                }
            }, 3000);
        }

        // 更新UI以解锁按钮（在添加提示之后）
        UI.update();
    },

        /**
         * 检查是否应该触发高亮任务
         * @private
         * @returns {boolean}
         */
        _shouldTriggerHighlightTask() {
            // 在Turn 3和Turn 5触发（turnCount从1开始，所以是turnCount === 3或5）
            return AppState.turnCount === 3 || AppState.turnCount === 5;
        },

        /**
         * 设置高亮任务
         * @private
         */
        _setupHighlightTask() {
            const chatBox = Utils.getElement('chat-messages');
            if (!chatBox) {
                return;
            }

            // 获取最后一条AI消息
            const aiMessages = chatBox.querySelectorAll('.flex.justify-start');
            const lastAiMessage = aiMessages[aiMessages.length - 1];
            
            if (!lastAiMessage) {
                return;
            }

            const messageContent = lastAiMessage.querySelector('.ai-message-content');
            if (!messageContent) {
                return;
            }

            // 启用文本选择
            messageContent.style.userSelect = 'text';
            messageContent.style.cursor = 'text';
            
            // 添加选择事件监听
            let selectionTimeout = null;
            
            messageContent.addEventListener('mouseup', () => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                if (selectedText && selectedText.length > 0) {
                    // 清除之前的定时器
                    if (selectionTimeout) {
                        clearTimeout(selectionTimeout);
                    }
                    
                    // 延迟显示反馈，避免频繁触发
                    selectionTimeout = setTimeout(() => {
                        this._handleTextSelection(selectedText, lastAiMessage);
                    }, 300);
                }
            });

            // 添加点击事件（作为备选，但需要确保有选择文本）
            // 注意：点击事件在mouseup之后触发，所以可以检查是否有选择
            lastAiMessage.addEventListener('click', (e) => {
                // 延迟检查，确保mouseup事件已经处理完
                setTimeout(() => {
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();
                    
                    // 只有在没有选择文本，且任务还未完成时，才允许通过点击解锁
                    // 但不记录空信息
                    if (!selectedText && AppState.showHighlightTask) {
                        // 仅解锁，不记录关键词
                        AppState.showHighlightTask = false;
                        const bubble = lastAiMessage.querySelector('.bg-white');
                        if (bubble) {
                            bubble.style.backgroundColor = '#ecfdf5';
                            bubble.style.borderColor = '#34d399';
                            bubble.style.transition = 'all 0.3s';
                        }
                        UI.update();
                    }
                }, 100);
            }, { once: true });
        },

        /**
         * 处理文本选择
         * @private
         * @param {string} selectedText - 选中的文本
         * @param {HTMLElement} messageElement - 消息元素
         */
        _handleTextSelection(selectedText, messageElement) {
            // 确保不是空文本
            if (!selectedText || !selectedText.trim()) {
                return; // 不处理空文本
            }
            
            const trimmedText = selectedText.trim();
            
            // 记录选择的内容（用于数据收集）
            console.log('用户选择的内容:', trimmedText);
            
            // 添加到左侧关键词列表
            this._addSelectedKeyword(trimmedText);
            
            // 高亮消息气泡（不添加反馈提示，避免上移）
            const bubble = messageElement.querySelector('.bg-white');
            if (bubble) {
                bubble.style.backgroundColor = '#ecfdf5';
                bubble.style.borderColor = '#34d399';
                bubble.style.transition = 'all 0.3s';
            }

            // 解锁按钮
            AppState.showHighlightTask = false;
            UI.update();
        },

        /**
         * 添加选中的关键词到左侧面板
         * @private
         * @param {string} keyword - 选中的关键词
         */
        _addSelectedKeyword(keyword) {
            const container = Utils.getElement('selected-keywords-list');
            if (!container) {
                return;
            }

            // 检查是否已存在（避免重复）
            const existingKeywords = Array.from(container.querySelectorAll('.keyword-tag'))
                .map(tag => tag.textContent.trim());
            
            if (existingKeywords.includes(keyword)) {
                return; // 已存在，不重复添加
            }

            // 创建关键词标签
            const keywordTag = Utils.createElement('div', 
                'keyword-tag inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200');
            
            keywordTag.innerHTML = `
                <i data-lucide="check-circle" width="12" height="12"></i>
                <span>${Utils.escapeHtml(keyword)}</span>`;
            
            container.appendChild(keywordTag);
            lucide.createIcons();
        },

        /**
         * 显示概念掌握奖励（机制C）
         * @private
         */
        _showConceptMasteredReward() {
            // 创建全屏遮罩
            const overlay = Utils.createElement('div', 
                'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center animate-fade-in');
            
            // 创建奖励卡片
            const rewardCard = Utils.createElement('div', 
                'bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 transform scale-0 animate-scale-in');
            
            rewardCard.innerHTML = `
                <div class="text-center">
                    <div class="mb-4 flex justify-center">
                        <div class="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full 
                                    flex items-center justify-center animate-bounce">
                            <i data-lucide="check-circle" width="48" height="48" class="text-white"></i>
                        </div>
                    </div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-2">Build Success</h2>
                    <div class="mb-4">
                        <span class="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full 
                                     text-sm font-semibold animate-pulse">
                            Concept Mastered
                        </span>
                    </div>
                    <p class="text-gray-600 mb-6">
                        恭喜！你已完成6轮深度探索，已掌握 C++ 指针概念！
                    </p>
                    <button onclick="this.closest('.fixed').remove()" 
                            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                   transition-colors font-semibold">
                        继续学习
                    </button>
                </div>`;
            
            overlay.appendChild(rewardCard);
            document.body.appendChild(overlay);
            lucide.createIcons();
            
            // 添加缩放动画
            setTimeout(() => {
                rewardCard.style.transform = 'scale(1)';
                rewardCard.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            }, 10);
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 300);
                }
            });
            
            // 3秒后自动关闭
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }, 3000);
        },

        /**
         * 点亮概念墙中的概念
         * @private
         * @param {string} conceptName - 概念名称
         */
        _lightUpConcept(conceptName) {
            const container = Utils.getElement('concept-wall-list');
            if (!container) {
                return;
            }

            // 检查是否已存在
            const existingConcepts = Array.from(container.querySelectorAll('.concept-badge'))
                .map(badge => badge.dataset.concept);
            
            if (existingConcepts.includes(conceptName)) {
                return; // 已存在，不重复添加
            }

            // 创建概念徽章
            const conceptBadge = Utils.createElement('div', 
                'concept-badge inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-lg text-sm font-bold shadow-md animate-pulse');
            
            conceptBadge.dataset.concept = conceptName;
            conceptBadge.innerHTML = `
                <i data-lucide="zap" width="16" height="16"></i>
                <span>${Utils.escapeHtml(conceptName)}</span>`;
            
            container.appendChild(conceptBadge);
            lucide.createIcons();
            
            // 添加点亮动画
            setTimeout(() => {
                conceptBadge.classList.remove('animate-pulse');
                conceptBadge.classList.add('animate-fade-in');
            }, 2000);
        },

    /**
     * 发送消息
     */
    async sendMessage() {
        // 检查是否已达到目标，禁止继续提问
        if (AppState.isGroup2TargetReached()) {
            alert('目标已达成！你已完成6轮深度探索，实验已完成。');
            return;
        }
        if (AppState.isGroup1LimitReached()) {
            alert('今日额度已用完，请整理笔记。');
            return;
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

            // 显示操作按钮（复制和刷新）
            if (AppState.currentAiMessageElement) {
                Messages.showActionButtons(AppState.currentAiMessageElement);
            }

            // 机制A: 启动等待查看消息的机制（打字机锁定）
            this._startViewingLock();

            // 机制B: 在特定轮次触发高亮任务（在查看解锁后）
            if (AppState.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
                const shouldTriggerHighlight = this._shouldTriggerHighlightTask();
                if (shouldTriggerHighlight) {
                    // 延迟触发，等待查看解锁完成
                    setTimeout(() => {
                        if (!AppState.waitingForView) {
                            AppState.showHighlightTask = true;
                            this._setupHighlightTask();
                            UI.update();
                        }
                    }, 3500); // 3秒查看时间 + 0.5秒缓冲
                }
            }

            // 更新进度条（AI回复完成后）
            UI.update();

            // 机制C: 视觉奖励（完成6轮对话时）
            if (AppState.isGroup2TargetReached()) {
                // 点亮概念墙中的"Pointers"
                this._lightUpConcept('Pointers');
                // 显示奖励弹窗
                this._showConceptMasteredReward();
            }

            AppState.currentAiMessageElement = null;

        } catch (error) {
            console.error('Error calling API:', error);
            Messages.removeTypingIndicator();
            AppState.isAiTyping = false;

            Messages.append('ai', 
                '抱歉，发生了错误。请检查后端服务器是否正在运行（http://localhost:3000），或稍后重试。\n\n错误信息：' + error.message);
            
            // 错误时也增加轮次（因为已经发送了消息）
            AppState.incrementTurn();
            UI.update();
        }
    }
};

// 全局函数，供HTML调用
function switchGroup(group) {
    Main.switchGroup(group);
}

function resetExperiment() {
    Main.resetExperiment();
}

function fillPrompt(text) {
    Main.fillPrompt(text);
}

function sendMessage() {
    Main.sendMessage();
}

// 初始化
window.onload = function() {
    Main.init();
};

