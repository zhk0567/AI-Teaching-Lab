/**
 * 认证工具函数
 */

const crypto = require('crypto');

// Token存储（临时会话数据，使用内存存储）
const tokens = new Map();

/**
 * 生成随机Token
 * @returns {string} Token字符串
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 验证Token
 * @param {string} token - Token字符串
 * @returns {object|null} Token数据或null
 */
function verifyToken(token) {
    return tokens.get(token) || null;
}

/**
 * 存储Token
 * @param {string} token - Token字符串
 * @param {object} data - Token数据
 */
function setToken(token, data) {
    tokens.set(token, data);
}

/**
 * 删除Token
 * @param {string} token - Token字符串
 */
function deleteToken(token) {
    tokens.delete(token);
}

/**
 * 解析请求体
 * @param {object} req - HTTP请求对象
 * @returns {Promise<object>} 解析后的JSON对象
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let timeout = setTimeout(() => {
            reject(new Error('解析请求体超时(1秒)'));
        }, 1000);
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            clearTimeout(timeout);
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

module.exports = {
    generateToken,
    verifyToken,
    setToken,
    deleteToken,
    parseBody
};

