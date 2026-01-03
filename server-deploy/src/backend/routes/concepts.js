/**
 * 概念墙路由
 * 处理概念相关的API请求
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const { getUserId } = require('../utils/progress');
const Concepts = require('../models/concepts');
const Sessions = require('../models/sessions');

/**
 * 处理保存概念请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleSaveConcept(req, res) {
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
        const { concept_name, session_id, concept_date } = requestData;

        if (!concept_name || !concept_name.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '概念名称不能为空' }));
            return;
        }

        // 获取日期（如果未提供，使用今天）
        let finalDate = concept_date;
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

        // 创建概念
        const conceptId = await Concepts.create({
            user_id: userId,
            student_id: studentId,
            session_id: finalSessionId,
            concept_name: concept_name.trim(),
            concept_date: finalDate
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, concept_id: conceptId }));
    } catch (error) {
        console.error('保存概念失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

/**
 * 处理获取概念列表请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetConcepts(req, res) {
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

        let concepts;
        if (date) {
            // 按日期查询
            concepts = await Concepts.findByUserIdAndDate(userId, date);
        } else {
            // 查询所有概念
            const studentId = tokenData.username;
            concepts = await Concepts.findByStudentId(studentId);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, concepts: concepts }));
    } catch (error) {
        console.error('获取概念列表失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

module.exports = {
    handleSaveConcept,
    handleGetConcepts
};

