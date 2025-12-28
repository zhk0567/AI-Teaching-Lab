/**
 * 可拖动分隔条功能模块
 * 实现左右面板大小调整
 */

const Resizer = {
    isResizing: false,
    startX: 0,
    startWidth: 0,

    /**
     * 初始化分隔条
     */
    init() {
        const savedWidth = localStorage.getItem('leftPanelWidth');
        if (savedWidth) {
            const leftPanel = document.getElementById('left-panel');
            if (leftPanel) {
                leftPanel.style.width = savedWidth;
            }
        }
    },

    /**
     * 开始拖动
     * @param {MouseEvent} e - 鼠标事件
     */
    startResize(e) {
        this.isResizing = true;
        this.startX = e.clientX;
        const leftPanel = document.getElementById('left-panel');
        this.startWidth = leftPanel.offsetWidth;

        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        e.preventDefault();
    },

    /**
     * 处理拖动
     * @param {MouseEvent} e - 鼠标事件
     */
    handleResize(e) {
        if (!this.isResizing) {
            return;
        }

        const container = document.getElementById('main-container');
        const leftPanel = document.getElementById('left-panel');
        const containerWidth = container.offsetWidth;

        const diff = e.clientX - this.startX;
        let newWidth = this.startWidth + diff;

        const minWidth = PLACEHOLDER_CONFIG.MIN_LEFT_PANEL_WIDTH;
        const maxWidth = containerWidth * PLACEHOLDER_CONFIG.MAX_LEFT_PANEL_WIDTH_RATIO;

        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        
        // 禁用过渡动画以实现即时响应
        leftPanel.style.transition = 'none';
        leftPanel.style.width = newWidth + 'px';
    },

    /**
     * 停止拖动
     */
    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;

            const leftPanel = document.getElementById('left-panel');
            localStorage.setItem('leftPanelWidth', leftPanel.style.width);
            
            // 恢复过渡动画（仅在拖动结束后）
            leftPanel.style.transition = '';

            document.removeEventListener('mousemove', this.handleResize.bind(this));
            document.removeEventListener('mouseup', this.stopResize.bind(this));

            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    }
};

// 全局函数，供HTML调用
function startResize(e) {
    Resizer.startResize(e);
}

