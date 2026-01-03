/**
 * 进度路由
 * 处理用户进度相关的请求
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const { getUserProgress, saveUserProgress, getCompletedDates } = require('../utils/progress');
const { getUserId } = require('../utils/progress');
const Sessions = require('../models/sessions');
const Messages = require('../models/messages');

/**
 * 处理获取进度请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetProgress(req, res) {
    try {
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

        const progress = await getUserProgress(tokenData.username);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, progress: progress }));
    } catch (error) {
        console.error('获取进度失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '获取进度失败', details: error.message }));
    }
}

/**
 * 处理保存进度请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleSaveProgress(req, res) {
    try {
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

        const requestData = await parseBody(req);
        const { turnCount, completed } = requestData;

        await saveUserProgress(tokenData.username, {
            turnCount: turnCount || 0,
            completed: completed || false
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        console.error('保存进度失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '保存进度失败', details: error.message }));
    }
}

/**
 * 处理获取完成日期请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetCompletedDates(req, res) {
    try {
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

        const completedDates = await getCompletedDates(tokenData.username);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, dates: completedDates }));
    } catch (error) {
        console.error('获取完成日期失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '获取完成日期失败', details: error.message }));
    }
}

/**
 * 处理获取消息历史请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetMessages(req, res) {
    try {
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
        let userId = getUserId(tokenData.username);
        if (!userId) {
            const Users = require('../models/users');
            const dbUser = await Users.findByUsername(tokenData.username);
            if (dbUser) {
                userId = dbUser.user_id;
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '用户不存在' }));
                return;
            }
        }

        // 获取今天的topic_id
        const { getCurrentTopicId } = require('../utils/topics');
        const topicId = await getCurrentTopicId();
        
        // 查找今天的会话
        const session = await Sessions.findTodaySessionByUserId(userId, topicId);
        
        if (!session) {
            // 没有会话，返回空消息列表
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, messages: [], sessionId: null }));
            return;
        }
        
        // 获取会话的所有消息
        const messages = await Messages.findBySessionId(session.session_id);
        
        // 格式化消息（只返回必要字段）
        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            turnIndex: msg.turn_index,
            createdAt: msg.created_at
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            messages: formattedMessages,
            sessionId: session.session_id
        }));
    } catch (error) {
        console.error('获取消息历史失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '获取消息历史失败', details: error.message }));
    }
}

module.exports = {
    handleGetProgress,
    handleSaveProgress,
    handleGetCompletedDates,
    handleGetMessages
};

