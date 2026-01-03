/**
 * 关键词路由
 * 处理关键词相关的API请求
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const { getUserId } = require('../utils/progress');
const Keywords = require('../models/keywords');
const Sessions = require('../models/sessions');

/**
 * 处理保存关键词请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleSaveKeyword(req, res) {
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

        const studentId = tokenData.username;

        // 解析请求体
        const requestData = await parseBody(req);
        const { keyword_text, session_id, message_id, keyword_date } = requestData;

        if (!keyword_text || !keyword_text.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '关键词文本不能为空' }));
            return;
        }

        // 获取日期（如果未提供，使用今天）
        let finalDate = keyword_date;
        if (!finalDate) {
            const today = new Date();
            finalDate = today.toISOString().split('T')[0];
        }

        // 验证session_id是否属于当前用户
        let finalSessionId = null;
        if (session_id) {
            const session = await Sessions.findById(session_id);
            if (session && session.user_id === userId) {
                finalSessionId = session_id;
            }
        }

        // 检查是否已存在（同一用户、同一消息、同一文本）
        if (message_id) {
            const exists = await Keywords.exists(userId, keyword_text.trim(), message_id);
            if (exists) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '关键词已存在' }));
                return;
            }
        }

        // 创建关键词
        const keywordId = await Keywords.create({
            user_id: userId,
            student_id: studentId,
            session_id: finalSessionId,
            message_id: message_id || null,
            keyword_text: keyword_text.trim(),
            keyword_date: finalDate
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, keyword_id: keywordId }));
    } catch (error) {
        console.error('保存关键词失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

/**
 * 处理删除关键词请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleDeleteKeyword(req, res) {
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
        const { keyword_text, message_id } = requestData;

        if (!keyword_text || !keyword_text.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '关键词文本不能为空' }));
            return;
        }

        // 删除关键词
        await Keywords.deleteByUserAndText(userId, keyword_text.trim(), message_id || null);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '关键词已删除' }));
    } catch (error) {
        console.error('删除关键词失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

/**
 * 处理获取用户关键词列表请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetKeywords(req, res) {
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

        // 解析查询参数
        const url = new URL(req.url, `http://${req.headers.host}`);
        const date = url.searchParams.get('date');

        let keywords;
        if (date) {
            // 按日期查询
            keywords = await Keywords.findByUserIdAndDate(userId, date);
        } else {
            // 查询所有关键词
            keywords = await Keywords.findByUserId(userId);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, keywords: keywords }));
    } catch (error) {
        console.error('获取关键词列表失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

module.exports = {
    handleSaveKeyword,
    handleDeleteKeyword,
    handleGetKeywords
};

