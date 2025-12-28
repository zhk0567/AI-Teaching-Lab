/**
 * 应用状态管理模块
 * 集中管理全局状态变量
 */

const AppState = {
    currentGroup: GROUP_CONFIG.GROUP2.NAME,
    turnCount: 0,
    isAiTyping: false,
    isInputLocked: false,
    showHighlightTask: false,
    conversationHistory: [],
    currentAiMessageElement: null,
    waitingForView: false,  // 等待用户查看消息
    viewTimer: null,        // 查看计时器
    viewStartTime: null,    // 开始查看的时间

    /**
     * 重置状态
     */
    reset() {
        this.turnCount = 0;
        this.isAiTyping = false;
        this.isInputLocked = false;
        this.showHighlightTask = false;
        this.conversationHistory = [];
        this.currentAiMessageElement = null;
        this.waitingForView = false;
        this._clearViewTimer();
    },

    /**
     * 清除查看计时器
     * @private
     */
    _clearViewTimer() {
        if (this.viewTimer) {
            clearInterval(this.viewTimer);
            this.viewTimer = null;
        }
        this.viewStartTime = null;
    },

    /**
     * 切换组别
     * @param {string} group - 组别名称
     */
    switchGroup(group) {
        this.currentGroup = group;
        this.reset();
    },

    /**
     * 增加轮次
     */
    incrementTurn() {
        // 检查是否已达到目标，防止超出
        if (this.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
            if (this.turnCount >= GROUP_CONFIG.GROUP2.TARGET_TURNS) {
                return; // 已达到目标，不再增加
            }
        } else if (this.currentGroup === GROUP_CONFIG.GROUP1.NAME) {
            if (this.turnCount >= GROUP_CONFIG.GROUP1.MAX_TURNS) {
                return; // 已达到限制，不再增加
            }
        }
        this.turnCount++;
    },

    /**
     * 检查是否达到限制
     * @returns {boolean}
     */
    isGroup1LimitReached() {
        return this.currentGroup === GROUP_CONFIG.GROUP1.NAME &&
               this.turnCount >= GROUP_CONFIG.GROUP1.MAX_TURNS;
    },

    /**
     * 检查是否达到目标
     * @returns {boolean}
     */
    isGroup2TargetReached() {
        return this.currentGroup === GROUP_CONFIG.GROUP2.NAME &&
               this.turnCount >= GROUP_CONFIG.GROUP2.TARGET_TURNS;
    }
};

