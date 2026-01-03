/**
 * 任务配置路由
 * 处理任务配置相关的API请求
 */

const { verifyToken } = require('../utils/auth');
const { getCurrentTopic } = require('../utils/topics');

/**
 * 获取当天的任务配置
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetCurrentTopic(req, res) {
    try {
        // 验证Token（可选，如果需要登录才能查看配置）
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const tokenData = verifyToken(token);
            if (!tokenData) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Token无效或已过期' }));
                return;
            }
        }

        // 获取当天的任务配置
        const topic = await getCurrentTopic();
        
        if (!topic) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未找到当天的任务配置' }));
            return;
        }

        // 解析 available_templates（如果是字符串）
        let availableTemplates = topic.available_templates;
        if (typeof availableTemplates === 'string') {
            try {
                availableTemplates = JSON.parse(availableTemplates);
            } catch (e) {
                console.error('解析 available_templates 失败:', e);
                availableTemplates = {};
            }
        }

        // 返回配置
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            day_id: topic.day_id,
            topic_name: topic.topic_name,
            concept_definition: topic.concept_definition,
            available_templates: availableTemplates || {}
        }));
    } catch (error) {
        console.error('获取任务配置失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器错误' }));
    }
}

module.exports = {
    handleGetCurrentTopic
};

