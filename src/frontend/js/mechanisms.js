/**
 * 实验机制模块
 * 包含机制A（查看锁定）、机制B（高亮任务）、机制C（视觉奖励）
 */

const Mechanisms = {
    /**
     * 机制A：启动查看锁定机制
     * 要求用户查看AI消息2-3秒后才能解锁提示按钮
     */
    startViewingLock() {
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
                            Mechanisms.unlockPrompts(lastAiMessage);
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
                    Mechanisms.unlockPrompts(lastAiMessage);
                    observer.disconnect();
                    AppState._clearViewTimer();
                }
            }, 100);
        }
    },

    /**
     * 解锁Prompt按钮并显示动画
     * @param {HTMLElement} messageElement - AI消息元素
     */
    unlockPrompts(messageElement) {
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
     * 机制B：检查是否应该触发高亮任务
     * @returns {boolean}
     */
    shouldTriggerHighlightTask() {
        // 在Turn 3和Turn 5触发（turnCount从1开始，所以是turnCount === 3或5）
        return AppState.turnCount === 3 || AppState.turnCount === 5;
    },

    /**
     * 机制B：设置高亮任务
     */
    setupHighlightTask() {
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
                    Mechanisms.handleTextSelection(selectedText, lastAiMessage);
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
     * 机制B：处理文本选择
     * @param {string} selectedText - 选中的文本
     * @param {HTMLElement} messageElement - 消息元素
     */
    handleTextSelection(selectedText, messageElement) {
        // 确保不是空文本
        if (!selectedText || !selectedText.trim()) {
            return; // 不处理空文本
        }
        
        const trimmedText = selectedText.trim();
        
        // 记录选择的内容（用于数据收集）
        console.log('用户选择的内容:', trimmedText);
        
        // 添加到左侧关键词列表
        Mechanisms.addSelectedKeyword(trimmedText);
        
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
     * 机制B：添加选中的关键词到左侧面板
     * @param {string} keyword - 选中的关键词
     */
    addSelectedKeyword(keyword) {
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
     * 机制C：显示概念掌握奖励
     */
    showConceptMasteredReward() {
        console.log('机制C: 显示概念掌握奖励');
        
        // 创建全屏遮罩
        const overlay = Utils.createElement('div', 
            'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center');
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease-in';
        
        // 创建奖励卡片
        const rewardCard = Utils.createElement('div', 
            'bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4');
        rewardCard.style.transform = 'scale(0)';
        rewardCard.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
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
        
        // 初始化图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // 显示遮罩和卡片动画
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            setTimeout(() => {
                rewardCard.style.transform = 'scale(1)';
            }, 50);
        });
        
        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.opacity = '0';
                rewardCard.style.transform = 'scale(0.8)';
                setTimeout(() => overlay.remove(), 300);
            }
        });
        
        // 点击按钮关闭
        const closeBtn = rewardCard.querySelector('button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.style.opacity = '0';
                rewardCard.style.transform = 'scale(0.8)';
                setTimeout(() => overlay.remove(), 300);
            });
        }
        
        // 5秒后自动关闭
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.opacity = '0';
                rewardCard.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.remove();
                    }
                }, 300);
            }
        }, 5000);
    },

    /**
     * 机制C：点亮概念墙中的概念
     * @param {string} conceptName - 概念名称
     */
    lightUpConcept(conceptName) {
        console.log('机制C: 点亮概念', conceptName);
        
        const container = Utils.getElement('concept-wall-list');
        if (!container) {
            console.warn('机制C: 未找到概念墙容器');
            return;
        }

        // 检查概念是否已存在
        const existingConcepts = Array.from(container.querySelectorAll('.concept-brick'))
            .map(brick => brick.textContent.trim());
        
        if (existingConcepts.includes(conceptName)) {
            console.log('机制C: 概念已存在，跳过', conceptName);
            // 如果已存在，高亮它
            const existingBrick = Array.from(container.querySelectorAll('.concept-brick'))
                .find(brick => brick.textContent.trim() === conceptName);
            if (existingBrick) {
                existingBrick.classList.add('bg-green-500', 'text-white', 'border-green-600');
                existingBrick.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-300');
            }
            return;
        }

        // 创建新的概念砖块
        const conceptBrick = Utils.createElement('div', 
            'concept-brick px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-600 ' +
            'font-semibold text-sm shadow-lg animate-fade-in');
        
        conceptBrick.textContent = conceptName;
        container.appendChild(conceptBrick);
        
        console.log('机制C: 概念已添加到概念墙', conceptName);
    }
};

