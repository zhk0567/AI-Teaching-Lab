/**
 * 认证路由
 * 处理登录、Token验证等认证相关路由
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const { getUserProgress } = require('../utils/progress');
const authService = require('../services/authService');

/**
 * 处理登录请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleLogin(req, res) {
    try {
        const requestData = await parseBody(req);
        const { username, password } = requestData;

        if (!username || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户名和密码不能为空' }));
            return;
        }

        const result = await authService.login(username, password);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    } catch (error) {
        console.error('登录失败:', error);
        if (!res.headersSent) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || '用户名或密码错误' }));
        }
    }
}

/**
 * 处理Token验证请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleVerify(req, res) {
    try {
        const requestData = await parseBody(req);
        const { token } = requestData;

        if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token不能为空' }));
            return;
        }

        const tokenData = verifyToken(token);
        if (!tokenData) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token无效或已过期' }));
            return;
        }

        // 获取用户进度（简化：直接使用默认值，避免查询阻塞）
        const progress = { turnCount: 0, completed: false };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            username: tokenData.username,
            group: tokenData.group,
            isAdmin: tokenData.isAdmin || false,
            progress: progress
        }));
    } catch (error) {
        console.error('验证Token失败:', error.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误' }));
        }
    }
}

module.exports = {
    handleLogin,
    handleVerify
};

