/**
 * 工具函数模块
 * 提供可复用的通用方法
 */

const Utils = {
    /**
     * 获取DOM元素
     * @param {string} id - 元素ID
     * @returns {HTMLElement|null}
     */
    getElement(id) {
        return document.getElementById(id);
    },

    /**
     * 滚动到底部
     * @param {HTMLElement} element - 要滚动的元素
     */
    scrollToBottom(element) {
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    },

    /**
     * 创建DOM元素
     * @param {string} tag - 标签名
     * @param {string} className - 类名
     * @param {string} innerHTML - 内容
     * @returns {HTMLElement}
     */
    createElement(tag, className, innerHTML) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (innerHTML) {
            element.innerHTML = innerHTML;
        }
        return element;
    },

    /**
     * 验证占位符是否已修改
     * @param {string} text - 要验证的文本
     * @returns {boolean} - 是否包含未修改的占位符（空括号）
     */
    hasUnmodifiedPlaceholder(text) {
        if (!text.includes('[') || !text.includes(']')) {
            return false;
        }

        // 检查是否包含空的占位符 []
        const emptyPlaceholderPattern = /\[\s*\]/g;
        return emptyPlaceholderPattern.test(text);
    },

    /**
     * 转义HTML特殊字符
     * @param {string} text - 要转义的文本
     * @returns {string} - 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 将Markdown转换为HTML
     * @param {string} markdown - Markdown文本
     * @returns {string} - HTML字符串
     */
    markdownToHtml(markdown) {
        // 检查marked库是否加载
        if (typeof marked === 'undefined') {
            return this.escapeHtml(markdown);
        }

        try {
            let html;
            
            // marked@11 使用新的API，需要先配置选项
            if (typeof marked.setOptions === 'function') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false,
                    mangle: false
                });
            }
            
            // 尝试使用parse方法（marked@11+）
            if (typeof marked.parse === 'function') {
                html = marked.parse(markdown);
            } else if (typeof marked === 'function') {
                // 旧版本API
                html = marked(markdown);
            } else {
                return this.escapeHtml(markdown);
            }
            
            return html;
        } catch (e) {
            return this.escapeHtml(markdown);
        }
    },

    /**
     * 高亮代码块
     * @param {HTMLElement} element - 包含代码的元素
     */
    highlightCode(element) {
        if (typeof hljs !== 'undefined' && element) {
            const codeBlocks = element.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                hljs.highlightElement(block);
            });
        }
    },

    /**
     * 检测元素是否在视口中
     * @param {HTMLElement} element - 要检测的元素
     * @returns {boolean} - 是否在视口中
     */
    isElementInViewport(element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= windowHeight &&
            rect.right <= windowWidth
        );
    },

    /**
     * 检测元素是否部分在视口中（更宽松的检测）
     * @param {HTMLElement} element - 要检测的元素
     * @returns {boolean} - 是否部分在视口中
     */
    isElementPartiallyInViewport(element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

        return (
            rect.top < windowHeight &&
            rect.bottom > 0 &&
            rect.left < windowWidth &&
            rect.right > 0
        );
    }
};

