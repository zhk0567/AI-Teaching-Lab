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
    
    // 生成请求ID用于日志追踪
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestStartTime = Date.now();
    
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
            console.error(`[错误] [${requestId}] 无法获取userId: ${tokenData.username}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户信息错误' }));
            return;
        }

        // 获取student_id（从tokenData.username获取，因为username就是student_id）
        const studentId = tokenData.username;

        // 获取或创建会话（使用当天的topic_id）
        const { getCurrentTopicId } = require('../utils/topics');
        const topicId = await getCurrentTopicId();
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

        // 保存用户消息到数据库（使用会话的日期和student_id）
        try {
            // 检查是否已存在相同内容的消息（防止重复保存）
            const recentMessages = await Messages.findBySessionId(session.session_id);
            const duplicateCheck = recentMessages.filter(m => 
                m.role === 'user' && 
                m.content === message && 
                m.turn_index === turnIndex &&
                Math.abs(new Date(m.created_at).getTime() - Date.now()) < 5000 // 5秒内的重复消息
            );
            
            if (duplicateCheck.length > 0) {
                console.warn(`[后端日志] [${requestId}] 检测到重复消息，跳过保存`, {
                    duplicateMessageId: duplicateCheck[0].message_id,
                    messagePreview: message.substring(0, 50),
                    turnIndex
                });
            } else {
                const userMessageId = await Messages.create({
                    session_id: session.session_id,
                    student_id: studentId,
                    message_date: session.session_date, // 使用会话的日期
                    role: 'user',
                    content: message,
                    template_id_used: templateId || null,
                    is_edited: isEdited ? 1 : 0,
                    edit_distance: editDistance || null,
                    turn_index: turnIndex
                });
                
                // 保存用户消息后，立即更新会话的turn_count（避免数据不一致）
                // 注意：这里只更新一次，AI回复完成后不会再更新（避免重复更新）
                const actualTurnCount = await Messages.getTurnCount(session.session_id);
                await Sessions.update(session.session_id, {
                    turn_count: actualTurnCount
                });
            }
        } catch (error) {
            console.error(`[错误] [${requestId}] 保存用户消息失败:`, error.message);
        }

        // 获取当天的任务配置（用于系统消息）
        const { getCurrentTopic } = require('../utils/topics');
        const topic = await getCurrentTopic();
        const topicName = topic?.topic_name || 'C++ 编程';

        // 发送流式请求（传递 topicName 给 chatService）
        chatService.sendStreamRequest(req, res, conversationHistory, message, isRegenerate, topicName, async (fullResponse) => {
            // 计算响应时间
            const responseTime = Date.now() - startTime;
            
            try {
                    // 保存AI回复到数据库（使用会话的日期和student_id）
                    if (fullResponse) {
                        await Messages.create({
                            session_id: session.session_id,
                            student_id: studentId,
                            message_date: session.session_date, // 使用会话的日期
                            role: 'ai',
                            content: fullResponse,
                            template_id_used: null,
                            is_edited: 0,
                            edit_distance: null,
                            turn_index: turnIndex,
                            response_time_ms: responseTime
                        });

                        // 注意：不再在这里更新turn_count，因为用户消息保存时已经更新过了
                        // 这里只验证数据一致性，不重复更新
                        const actualTurnCount = await Messages.getTurnCount(session.session_id);
                        const currentSessionTurnCount = session.turn_count || 0;
                        
                        // 验证轮次计算的合理性
                        if (actualTurnCount !== turnIndex) {
                            console.warn(`[警告] [${requestId}] 轮次计算不一致: turnIndex=${turnIndex}, actualTurnCount=${actualTurnCount}`);
                        }
                        
                        // 只有在数据不一致时才更新（正常情况下不应该发生）
                        if (actualTurnCount !== currentSessionTurnCount) {
                            console.warn(`[警告] [${requestId}] 数据不一致，同步更新: sessionId=${session.session_id}, ${currentSessionTurnCount} -> ${actualTurnCount}`);
                            await Sessions.update(session.session_id, {
                                turn_count: actualTurnCount
                            });
                        }
                    }
            } catch (error) {
                console.error(`[错误] [${requestId}] 保存AI消息失败:`, error.message);
            }
        });
    } catch (error) {
        console.error(`[错误] [${requestId}] 处理聊天请求失败:`, error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器错误' }));
    }
}

module.exports = {
    handleChat
};

