/**
 * 关键词划词模块
 * 实现类似知乎/番茄小说的划词功能
 */

const KeywordHighlighter = {
    // 当前选中的文本范围
    currentSelection: null,
    // 当前显示的任务栏
    currentToolbar: null,
    // 已标记的关键词（用于快速查找）
    markedKeywords: new Map(), // key: messageId_keywordText, value: {element, keywordId}

    /**
     * 初始化划词功能（为所有AI消息启用）
     */
    init() {
        // 监听全局文本选择事件（使用捕获阶段，确保优先处理）
        document.addEventListener('mouseup', this.handleTextSelection.bind(this), true);
        document.addEventListener('click', this.handleClick.bind(this), true);
        
        // 禁用浏览器默认的文本选择上下文菜单
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this), true);
        
        // 监听消息容器变化，为新消息添加禁用默认菜单
        this.observeMessageContainer();
        
        // 加载已标记的关键词
        this.loadMarkedKeywords();
    },

    /**
     * 处理右键菜单事件，禁用浏览器默认的文本选择菜单
     */
    handleContextMenu(event) {
        // 检查是否在AI消息内容区域
        const target = event.target;
        const messageContent = target.closest('.ai-message-content');
        
        if (messageContent) {
            // 阻止浏览器默认的上下文菜单
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    },

    /**
     * 监听消息容器变化，为新消息禁用默认选择菜单
     */
    observeMessageContainer() {
        const chatBox = Utils.getElement('chat-messages');
        if (!chatBox) {
            return;
        }

        // 为现有的AI消息内容区域禁用默认菜单
        this.disableDefaultSelectionMenu(chatBox);

        // 监听新消息添加
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.disableDefaultSelectionMenu(node);
                    }
                });
            });
        });

        observer.observe(chatBox, {
            childList: true,
            subtree: true
        });
    },

    /**
     * 为元素及其子元素禁用默认选择菜单
     */
    disableDefaultSelectionMenu(element) {
        // 查找所有AI消息内容区域
        const messageContents = element.querySelectorAll ? 
            element.querySelectorAll('.ai-message-content') : 
            (element.classList && element.classList.contains('ai-message-content') ? [element] : []);

        messageContents.forEach(messageContent => {
            // 添加CSS类来禁用某些默认行为
            messageContent.style.userSelect = 'text';
            
            // 阻止右键菜单
            messageContent.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);

            // 阻止某些浏览器的默认选择行为（如Chrome的选择工具栏）
            messageContent.addEventListener('selectstart', (e) => {
                // 允许选择，但阻止某些默认行为
            }, true);
        });
    },

    /**
     * 处理文本选择
     */
    handleTextSelection(event) {
        // 忽略输入框中的选择（避免干扰输入）
        const target = event.target;
        if (target && (target.id === 'user-input' || target.closest('#user-input'))) {
            return;
        }
        
        // 延迟处理，确保选择已经完成
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            // 检查选择是否在输入框中
            if (selection.rangeCount > 0) {
                try {
                    const range = selection.getRangeAt(0);
                    const inputElement = document.getElementById('user-input');
                    if (inputElement && range.intersectsNode && range.intersectsNode(inputElement)) {
                        // 如果选择在输入框中，不处理（避免干扰输入）
                        return;
                    }
                } catch (e) {
                    // 忽略检查错误
                }
            }
            
            // 如果没有选中文本，隐藏任务栏
            if (!selectedText || selectedText.length === 0) {
                // 只有当没有选中文本且不是点击任务栏时才隐藏
                if (!this.currentToolbar || !this.currentToolbar.contains(event.target)) {
                    this.hideToolbar();
                }
                return;
            }

            // 检查选中的文本是否在AI消息中
            try {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const messageElement = container.nodeType === Node.TEXT_NODE 
                    ? container.parentElement.closest('.flex.justify-start')
                    : container.closest('.flex.justify-start');
                
                if (!messageElement) {
                    // 如果不在消息中，但任务栏存在且包含点击目标，不隐藏
                    if (!this.currentToolbar || !this.currentToolbar.contains(event.target)) {
                        this.hideToolbar();
                    }
                    return;
                }

                // 检查是否在AI消息内容区域
                const messageContent = messageElement.querySelector('.ai-message-content');
                if (!messageContent || !messageContent.contains(container.nodeType === Node.TEXT_NODE ? container.parentElement : container)) {
                    if (!this.currentToolbar || !this.currentToolbar.contains(event.target)) {
                        this.hideToolbar();
                    }
                    return;
                }

                // 保存当前选择（克隆范围，避免被清除）
                this.currentSelection = {
                    range: range.cloneRange(),
                    text: selectedText,
                    messageElement: messageElement,
                    messageId: messageElement.dataset.messageId || null
                };

                // 显示任务栏
                this.showToolbar(event);
            } catch (e) {
                // 如果获取范围失败，忽略
                console.warn('获取选择范围失败:', e);
            }
        }, 10);
    },

    /**
     * 显示任务栏
     */
    showToolbar(event) {
        // 移除旧的任务栏（但不清除选择）
        if (this.currentToolbar) {
            this.currentToolbar.remove();
            this.currentToolbar = null;
        }

        if (!this.currentSelection) {
            return;
        }

        // 确保选择仍然存在（但不要影响输入框）
        const selection = window.getSelection();
        if (selection.rangeCount === 0 && this.currentSelection.range) {
            // 检查选择范围是否在输入框中
            const range = this.currentSelection.range;
            const inputElement = document.getElementById('user-input');
            if (inputElement && range.intersectsNode && range.intersectsNode(inputElement)) {
                // 如果选择在输入框中，不恢复选择（避免干扰输入）
                return;
            }
            
            // 如果选择被清除了，尝试恢复
            try {
                selection.addRange(this.currentSelection.range.cloneRange());
            } catch (e) {
                console.warn('恢复选择失败:', e);
            }
        }

        const range = this.currentSelection.range;
        let rect;
        try {
            rect = range.getBoundingClientRect();
        } catch (e) {
            // 如果获取位置失败，使用默认位置
            rect = { left: event.clientX || 0, top: (event.clientY || 0) - 40, width: 0, height: 0 };
        }

        // 创建任务栏
        const toolbar = document.createElement('div');
        toolbar.className = 'keyword-toolbar fixed bg-white border border-gray-300 rounded-lg shadow-lg p-1 flex items-center gap-1 z-50';
        toolbar.style.left = `${rect.left + window.scrollX}px`;
        toolbar.style.top = `${rect.top + window.scrollY - 40}px`;

        // 检查是否已标记
        const isMarked = this.isKeywordMarked(this.currentSelection.messageId, this.currentSelection.text);

        toolbar.innerHTML = `
            <button class="keyword-toolbar-btn px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
                    data-action="${isMarked ? 'unmark' : 'mark'}">
                <i data-lucide="${isMarked ? 'x' : 'underline'}" width="14" height="14"></i>
                <span>${isMarked ? '取消标记' : '划词'}</span>
            </button>
        `;

        document.body.appendChild(toolbar);
        this.currentToolbar = toolbar;

        // 初始化图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // 绑定点击事件
        const btn = toolbar.querySelector('.keyword-toolbar-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                const action = btn.dataset.action;
                if (action === 'mark') {
                    this.markKeyword();
                } else if (action === 'unmark') {
                    this.unmarkKeyword();
                }
            };
        }

        // 点击其他地方隐藏任务栏（延迟绑定，避免立即触发）
        setTimeout(() => {
            const hideHandler = (e) => {
                // 如果点击的不是任务栏，隐藏任务栏
                if (this.currentToolbar && !this.currentToolbar.contains(e.target)) {
                    // 检查是否点击的是已标记的关键词
                    const markedElement = e.target.closest('.keyword-marked');
                    if (!markedElement) {
                        this.hideToolbar();
                    }
                }
            };
            document.addEventListener('click', hideHandler, { once: true, capture: true });
        }, 200);
    },


    /**
     * 处理点击事件（用于取消标记）
     */
    handleClick(event) {
        // 忽略输入框中的点击（避免干扰输入）
        const target = event.target;
        if (target && (target.id === 'user-input' || target.closest('#user-input'))) {
            return;
        }
        
        // 如果点击的是任务栏，不处理
        if (this.currentToolbar && this.currentToolbar.contains(target)) {
            return;
        }

        // 如果点击的是已标记的关键词，显示取消任务栏
        const markedElement = target.closest('.keyword-marked');
        
        if (markedElement) {
            event.stopPropagation();
            const keywordText = markedElement.dataset.keywordText;
            const messageId = markedElement.dataset.messageId;
            
            // 创建选择范围（用于定位任务栏）
            const range = document.createRange();
            range.selectNodeContents(markedElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.currentSelection = {
                range: range,
                text: keywordText,
                messageElement: markedElement.closest('.flex.justify-start'),
                messageId: messageId
            };
            
            this.showToolbar(event);
        } else {
            // 如果点击的不是已标记的关键词，且没有选中文本，延迟检查是否需要隐藏任务栏
            setTimeout(() => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                // 如果没有选中文本，且点击的不是任务栏，隐藏任务栏
                if (!selectedText && (!this.currentToolbar || !this.currentToolbar.contains(event.target))) {
                    this.hideToolbar();
                }
            }, 100);
        }
    },

    /**
     * 隐藏任务栏
     */
    hideToolbar(clearSelection = true) {
        if (this.currentToolbar) {
            this.currentToolbar.remove();
            this.currentToolbar = null;
        }
        this.currentSelection = null;
        // 只有在明确要求时才清除选择
        if (clearSelection) {
            window.getSelection().removeAllRanges();
        }
    },

    /**
     * 标记关键词
     */
    async markKeyword() {
        if (!this.currentSelection) {
            return;
        }

        const { range, text, messageElement, messageId } = this.currentSelection;
        
        // 检查是否已标记
        if (this.isKeywordMarked(messageId, text)) {
            this.hideToolbar();
            return;
        }

        try {
            // 获取session_id（从消息元素或AppState）
            let sessionId = null;
            if (messageElement.dataset.sessionId) {
                sessionId = parseInt(messageElement.dataset.sessionId);
            } else if (AppState && AppState.currentSessionId) {
                sessionId = AppState.currentSessionId;
            }

            // 保存到数据库
            if (typeof API !== 'undefined' && API.saveKeyword) {
                await API.saveKeyword(text, sessionId, messageId);
            }

            // 在文本下方添加下划线
            this.addUnderline(range, text, messageId, messageElement);

            // 更新左侧关键词列表
            if (typeof Mechanisms !== 'undefined' && Mechanisms.addSelectedKeyword) {
                Mechanisms.addSelectedKeyword(text);
            }

            // 记录埋点
            if (typeof Tracking !== 'undefined' && Tracking.trackHighlightTask) {
                Tracking.trackHighlightTask('mark', text);
            }

            this.hideToolbar();
        } catch (error) {
            console.error('标记关键词失败:', error);
            alert('标记关键词失败，请重试');
        }
    },

    /**
     * 取消标记关键词
     */
    async unmarkKeyword() {
        if (!this.currentSelection) {
            return;
        }

        const { text, messageId } = this.currentSelection;

        try {
            // 从数据库删除
            if (typeof API !== 'undefined' && API.deleteKeyword) {
                await API.deleteKeyword(text, messageId);
            }

            // 移除下划线
            this.removeUnderline(messageId, text);

            // 从左侧关键词列表移除
            this.removeKeywordFromList(text);

            // 记录埋点
            if (typeof Tracking !== 'undefined' && Tracking.trackHighlightTask) {
                Tracking.trackHighlightTask('unmark', text);
            }

            this.hideToolbar();
        } catch (error) {
            console.error('取消标记关键词失败:', error);
            alert('取消标记失败，请重试');
        }
    },

    /**
     * 添加下划线标记
     */
    addUnderline(range, keywordText, messageId, messageElement) {
        // 创建标记元素
        const markElement = document.createElement('span');
        markElement.className = 'keyword-marked inline underline decoration-2 decoration-blue-500 cursor-pointer';
        markElement.dataset.keywordText = keywordText;
        markElement.dataset.messageId = messageId || '';
        markElement.style.textDecorationColor = '#3b82f6';
        markElement.style.textDecorationThickness = '2px';
        markElement.style.textUnderlineOffset = '2px';

        try {
            // 用标记元素包裹选中的文本
            range.surroundContents(markElement);
        } catch (e) {
            // 如果surroundContents失败（可能是因为范围跨越多个节点），使用另一种方法
            const contents = range.extractContents();
            markElement.appendChild(contents);
            range.insertNode(markElement);
        }

        // 保存到已标记关键词Map
        const key = `${messageId || 'no_msg'}_${keywordText}`;
        this.markedKeywords.set(key, {
            element: markElement,
            keywordText: keywordText,
            messageId: messageId
        });
    },

    /**
     * 移除下划线标记
     */
    removeUnderline(messageId, keywordText) {
        const key = `${messageId || 'no_msg'}_${keywordText}`;
        const marked = this.markedKeywords.get(key);
        
        if (marked && marked.element) {
            // 用文本节点替换标记元素
            const parent = marked.element.parentNode;
            const textNode = document.createTextNode(marked.element.textContent);
            parent.replaceChild(textNode, marked.element);
            this.markedKeywords.delete(key);
        }
    },

    /**
     * 检查关键词是否已标记
     */
    isKeywordMarked(messageId, keywordText) {
        const key = `${messageId || 'no_msg'}_${keywordText}`;
        return this.markedKeywords.has(key);
    },

    /**
     * 从左侧关键词列表移除
     */
    removeKeywordFromList(keywordText) {
        const container = Utils.getElement('selected-keywords-list');
        if (!container) {
            return;
        }

        const keywords = container.querySelectorAll('.keyword-tag');
        keywords.forEach(tag => {
            const text = tag.textContent.trim();
            if (text === keywordText) {
                tag.remove();
            }
        });
    },

    /**
     * 加载已标记的关键词（从数据库）
     */
    async loadMarkedKeywords() {
        try {
            if (typeof API !== 'undefined' && API.getKeywords) {
                const response = await API.getKeywords();
                if (response && response.keywords) {
                    // 为每个关键词添加下划线标记
                    response.keywords.forEach(keyword => {
                        // 这里需要根据message_id找到对应的消息元素并添加下划线
                        // 由于消息是动态加载的，这个功能可以在消息加载后调用
                        this.markKeywordInMessage(keyword);
                    });
                }
            }
        } catch (error) {
            console.warn('加载已标记关键词失败:', error);
        }
    },

    /**
     * 在消息中标记关键词（用于加载时恢复标记）
     */
    markKeywordInMessage(keyword) {
        // 这个方法需要在消息加载后调用
        // 暂时先保存到Map，等消息加载后再标记
        const key = `${keyword.message_id || 'no_msg'}_${keyword.keyword_text}`;
        this.markedKeywords.set(key, {
            keywordText: keyword.keyword_text,
            messageId: keyword.message_id,
            keywordId: keyword.keyword_id
        });
    },

    /**
     * 恢复已标记的关键词（在消息加载后调用）
     */
    restoreMarkedKeywords() {
        // 遍历所有AI消息，查找并标记关键词
        const chatBox = Utils.getElement('chat-messages');
        if (!chatBox) {
            return;
        }

        const aiMessages = chatBox.querySelectorAll('.flex.justify-start');
        aiMessages.forEach(messageElement => {
            const messageId = messageElement.dataset.messageId || null;
            const messageContent = messageElement.querySelector('.ai-message-content');
            
            if (!messageContent) {
                return;
            }

            // 查找该消息的所有关键词
            this.markedKeywords.forEach((marked, key) => {
                if (marked.messageId === messageId || (!messageId && key.startsWith('no_msg_'))) {
                    // 在消息内容中查找关键词文本
                    const text = messageContent.textContent || messageContent.innerText;
                    const keywordText = marked.keywordText;
                    
                    if (text.includes(keywordText)) {
                        // 使用正则表达式查找并标记
                        this.markKeywordInText(messageContent, keywordText, messageId);
                    }
                }
            });
        });
    },

    /**
     * 在文本中标记关键词
     */
    markKeywordInText(element, keywordText, messageId) {
        // 使用TreeWalker遍历文本节点
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const index = text.indexOf(keywordText);
            
            if (index !== -1) {
                // 创建范围
                const range = document.createRange();
                range.setStart(textNode, index);
                range.setEnd(textNode, index + keywordText.length);
                
                // 检查是否已标记
                const key = `${messageId || 'no_msg'}_${keywordText}`;
                if (!this.markedKeywords.has(key)) {
                    // 添加下划线标记
                    this.addUnderline(range, keywordText, messageId, textNode.parentElement.closest('.flex.justify-start'));
                }
            }
        });
    }
};

