/**
 * 行为埋点模块
 * 负责收集和发送用户行为事件
 */

const Tracking = {
    /**
     * 记录事件（异步，不阻塞主流程）
     * @param {string} eventType - 事件类型
     * @param {object} eventValue - 事件值（可选）
     * @param {number} sessionId - 会话ID（可选）
     */
    async trackEvent(eventType, eventValue = null, sessionId = null) {
        try {
            // 检查是否有Token和用户信息
            if (typeof API === 'undefined' || !API.getToken()) {
                // 未登录，不记录事件
                return;
            }

            if (!AppState || !AppState.userInfo) {
                // 用户信息未加载，不记录事件
                return;
            }

            // 异步发送，不阻塞主流程
            fetch(`${CONFIG.API_BASE_URL}/events/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API.getToken()}`
                },
                body: JSON.stringify({
                    event_type: eventType,
                    event_value: eventValue,
                    session_id: sessionId
                })
            }).catch(error => {
                // 静默失败，不影响用户体验
                console.warn('[埋点] 发送事件失败:', error);
            });
        } catch (error) {
            // 静默失败，不影响用户体验
            console.warn('[埋点] 记录事件失败:', error);
        }
    },

    /**
     * 记录登录事件
     */
    trackLogin() {
        this.trackEvent('login', {
            group: AppState?.userInfo?.group,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * 记录发送消息事件
     * @param {string} message - 消息内容
     * @param {string} templateId - 使用的模板ID（可选）
     * @param {boolean} isEdited - 是否编辑过（可选）
     */
    trackSendMessage(message, templateId = null, isEdited = false) {
        this.trackEvent('send_message', {
            message_length: message.length,
            template_id: templateId,
            is_edited: isEdited,
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录验证消息事件
     * @param {number} turnIndex - 轮次索引
     */
    trackVerifyMessage(turnIndex) {
        this.trackEvent('verify_message', {
            turn_index: turnIndex,
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录复制消息事件
     */
    trackCopyMessage() {
        this.trackEvent('copy_message', {
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录刷新消息事件
     */
    trackRefreshMessage() {
        this.trackEvent('refresh_message', {
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录选择提示模板事件
     * @param {string} templateType - 模板类型（start 或 options）
     * @param {string} templateId - 模板ID
     */
    trackSelectTemplate(templateType, templateId) {
        this.trackEvent('select_template', {
            template_type: templateType,
            template_id: templateId,
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录查看消息事件（查看锁定机制）
     * @param {number} viewDuration - 查看时长（毫秒）
     */
    trackViewMessage(viewDuration) {
        this.trackEvent('view_message', {
            view_duration_ms: viewDuration,
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录完成目标事件
     */
    trackCompleteTarget() {
        this.trackEvent('complete_target', {
            turn_count: AppState?.turnCount || 0,
            group: AppState?.currentGroup
        });
    },

    /**
     * 记录高亮任务事件
     * @param {string} action - 动作（show, select, cancel）
     * @param {string} selectedKeyword - 选中的关键词（可选）
     */
    trackHighlightTask(action, selectedKeyword = null) {
        this.trackEvent('highlight_task', {
            action: action,
            selected_keyword: selectedKeyword,
            turn_count: AppState?.turnCount || 0
        });
    },

    /**
     * 记录页面访问事件
     */
    trackPageView() {
        this.trackEvent('page_view', {
            url: window.location.href,
            timestamp: new Date().toISOString()
        });
    }
};

