/**
 * 事件埋点路由
 * 处理用户行为事件记录
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const { getUserId } = require('../utils/progress');
const Events = require('../models/events');
const Sessions = require('../models/sessions');

/**
 * 处理记录事件请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleTrackEvent(req, res) {
    try {
        // 验证Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        const token = authHeader.substring(7);
        const tokenData = verifyToken(token);
        if (!tokenData) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token无效或已过期' }));
            return;
        }

        // 获取user_id
        const userId = getUserId(tokenData.username);
        if (!userId) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户信息错误' }));
            return;
        }

        // 解析请求体
        const requestData = await parseBody(req);
        const { event_type, event_value, session_id } = requestData;

        if (!event_type) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'event_type 不能为空' }));
            return;
        }

        // 如果提供了session_id，验证它是否属于当前用户
        let finalSessionId = null;
        if (session_id) {
            const session = await Sessions.findById(session_id);
            if (session && session.user_id === userId) {
                finalSessionId = session_id;
            } else {
                // session_id无效或不属于当前用户，忽略但不报错
                console.warn(`[埋点] session_id ${session_id} 无效或不属于用户 ${userId}`);
            }
        }

        // 如果没有提供session_id，尝试获取用户今天的会话
        if (!finalSessionId) {
            const { getCurrentTopicId } = require('../utils/topics');
            const topicId = await getCurrentTopicId();
            const todaySession = await Sessions.findTodaySessionByUserId(userId, topicId);
            if (todaySession) {
                finalSessionId = todaySession.session_id;
            }
        }

        // 记录事件
        const eventId = await Events.create({
            user_id: userId,
            session_id: finalSessionId,
            event_type: event_type,
            event_value: event_value ? JSON.stringify(event_value) : null
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, event_id: eventId }));
    } catch (error) {
        console.error('记录事件失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

module.exports = {
    handleTrackEvent
};

