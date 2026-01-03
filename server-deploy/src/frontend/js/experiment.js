/**
 * 实验管理模块
 * 负责实验重置和初始化
 */

const Experiment = {
    /**
     * 重置实验
     */
    async reset() {
        try {
            // 保存当前组别（确保重置后不会改变用户的组别）
            const savedGroup = AppState.currentGroup;
            
            // 保存当前进度（重置前，不等待完成，避免阻塞）
            AppState.saveProgress().catch(e => {
                console.warn('重置前保存进度失败:', e.message);
            });
            
            // 保存当前turnCount（重置前，用于容错）
            const savedTurnCount = AppState.turnCount;
            
            // 只重置非进度相关的状态，保留turnCount
            // 确保清理所有可能卡住的状态
            AppState.isAiTyping = false;
            AppState.isInputLocked = false;
            AppState.showHighlightTask = false;
            AppState.conversationHistory = [];
            AppState.currentAiMessageElement = null;
            AppState.waitingForView = false;
            AppState._clearViewTimer();
            
            // 确保移除打字指示器
            if (typeof Messages !== 'undefined' && Messages.removeTypingIndicator) {
                Messages.removeTypingIndicator();
            }
            
            // 恢复用户的组别
            if (AppState.userInfo && AppState.userInfo.group) {
                AppState.currentGroup = AppState.userInfo.group;
            } else {
                AppState.currentGroup = savedGroup;
            }
            
            // 重新加载进度（这会恢复turnCount）
            try {
                await AppState.loadProgress();
            } catch (error) {
                console.warn('重置时加载进度失败，使用保存的值:', error.message);
                // 如果加载失败，使用保存的turnCount（容错处理）
                if (savedTurnCount > 0) {
                    AppState.turnCount = savedTurnCount;
                }
            }
            
            // 如果加载失败或没有进度，使用保存的turnCount（容错处理）
            if (AppState.turnCount === 0 && savedTurnCount > 0) {
                AppState.turnCount = savedTurnCount;
                // 如果加载失败，重新保存进度（不等待完成，避免阻塞）
                AppState.saveProgress().catch(error => {
                    console.warn('保存进度失败:', error.message);
                });
            }
        } catch (error) {
            console.error('重置实验时发生错误:', error);
            // 即使出错，也确保基本状态被清理
            AppState.isAiTyping = false;
            AppState.isInputLocked = false;
            if (typeof Messages !== 'undefined' && Messages.removeTypingIndicator) {
                Messages.removeTypingIndicator();
            }
        }

        // 无论是否出错，都要清空聊天框并显示欢迎消息
        // 注意：只有在没有历史消息时才清空（避免覆盖已加载的历史消息）
        const chatBox = Utils.getElement('chat-messages');
        if (chatBox && chatBox.children.length === 0) {
            // 聊天框为空时才清空（实际上已经是空的）
            chatBox.innerHTML = '';
        } else if (chatBox && chatBox.children.length > 0) {
            // 如果有历史消息，不清空，只显示欢迎消息（如果还没有）
            const hasWelcomeMessage = Array.from(chatBox.children).some(child => {
                const text = child.textContent || '';
                return text.includes('欢迎来到实验系统');
            });
            if (!hasWelcomeMessage) {
                // 如果没有欢迎消息，在顶部添加
                const groupLabel = AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME
                    ? GROUP_CONFIG.GROUP1.LABEL
                    : GROUP_CONFIG.GROUP2.LABEL;
                if (typeof Messages !== 'undefined' && Messages.append) {
                    const welcomeDiv = document.createElement('div');
                    welcomeDiv.className = 'mb-4';
                    chatBox.insertBefore(welcomeDiv, chatBox.firstChild);
                    Messages.append('ai', 
                        `欢迎来到实验系统。\n组别: ${groupLabel}。\n\n请从左侧选择一个提示开始。`, 
                        true, welcomeDiv);
                }
            }
            return; // 有历史消息时不继续执行重置逻辑
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

        // 确保组别信息已初始化
        if (!AppState.currentGroup) {
            if (AppState.userInfo && AppState.userInfo.group) {
                AppState.currentGroup = AppState.userInfo.group;
            } else {
                AppState.currentGroup = GROUP_CONFIG.GROUP2.NAME; // 默认组别
            }
        }

        const groupLabel = AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME
            ? GROUP_CONFIG.GROUP1.LABEL
            : GROUP_CONFIG.GROUP2.LABEL;

        // 确保欢迎消息被添加（即使之前出错）
        if (typeof Messages !== 'undefined' && Messages.append) {
            Messages.append('ai', 
                `欢迎来到实验系统。\n组别: ${groupLabel}。\n\n请从左侧选择一个提示开始。`, 
                true); // 标记为初始消息，不需要验证
        }

        // 更新UI
        if (typeof UI !== 'undefined' && UI.update) {
            UI.update();
        }
    }
};

