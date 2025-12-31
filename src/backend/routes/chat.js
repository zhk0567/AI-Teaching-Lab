/**
 * 聊天路由
 * 处理与AI的对话请求
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const { getUserId } = require('../utils/progress');
const Sessions = require('../models/sessions');
const Messages = require('../models/messages');
const chatService = require('../services/chatService');

/**
 * 处理聊天请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleChat(req, res) {
    // 流式响应可能需要较长时间，不设置超时限制
    // 超时由 chatService 内部处理
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
            res.end(JSON.stringify({ error: 'Token无效或已过期，请重新登录' }));
            return;
        }

        const requestData = await parseBody(req);
        const { message, conversationHistory = [], isRegenerate = false, templateId = null, isEdited = false, editDistance = null } = requestData;

        if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Message is required' }));
            return;
        }

        // 获取user_id
        const userId = getUserId(tokenData.username);
        if (!userId) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户信息错误' }));
            return;
        }

        // 获取或创建会话
        const topicId = 'cpp_pointers_memory';
        let session = await Sessions.findTodaySessionByUserId(userId, topicId);
        if (!session) {
            const sessionId = await Sessions.create({
                user_id: userId,
                topic_id: topicId
            });
            session = await Sessions.findById(sessionId);
        }

        // 计算当前轮次
        const existingMessages = await Messages.findBySessionId(session.session_id);
        const userMessages = existingMessages.filter(m => m.role === 'user');
        const turnIndex = userMessages.length + 1;

        // 记录开始时间
        const startTime = Date.now();

        // 保存用户消息到数据库
        try {
            await Messages.create({
                session_id: session.session_id,
                role: 'user',
                content: message,
                template_id_used: templateId || null,
                is_edited: isEdited ? 1 : 0,
                edit_distance: editDistance || null,
                turn_index: turnIndex
            });
        } catch (error) {
            console.error('保存用户消息失败:', error);
        }

        // 发送流式请求
        chatService.sendStreamRequest(req, res, conversationHistory, message, isRegenerate, async (fullResponse) => {
            // 计算响应时间
            const responseTime = Date.now() - startTime;
            
            try {
                // 保存AI回复到数据库
                if (fullResponse) {
                    await Messages.create({
                        session_id: session.session_id,
                        role: 'ai',
                        content: fullResponse,
                        template_id_used: null,
                        is_edited: 0,
                        edit_distance: null,
                        turn_index: turnIndex,
                        response_time_ms: responseTime
                    });

                    // 更新会话的轮次
                    const actualTurnCount = await Messages.getTurnCount(session.session_id);
                    await Sessions.update(session.session_id, {
                        turn_count: actualTurnCount
                    });
                }
            } catch (error) {
                console.error('保存AI消息失败:', error);
            }
        });
    } catch (error) {
        console.error('处理聊天请求失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器错误' }));
    }
}

module.exports = {
    handleChat
};

