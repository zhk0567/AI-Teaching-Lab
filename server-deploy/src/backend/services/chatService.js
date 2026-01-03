/**
 * 聊天服务
 * 处理与DeepSeek API的交互
 */

const https = require('https');

const DEEPSEEK_API_KEY = 'sk-d83352c336d04699a990bef28686ecff';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * 构建系统消息
 * @param {boolean} isRegenerate - 是否为重新生成
 * @returns {string} 系统消息
 */
function buildSystemMessage(isRegenerate = false, topicName = 'C++ 编程') {
    let systemMessage = `你是一位友好的 ${topicName} 导师。请用清晰简洁的方式解释概念，在适当的时候使用例子。请始终用中文回复。`;
    
    if (isRegenerate) {
        systemMessage += ' 请用不同的角度或方式重新解释，可以换一个例子或使用不同的表达方式。';
    }
    
    return systemMessage;
}

/**
 * 构建API请求数据
 * @param {Array} conversationHistory - 对话历史
 * @param {string} message - 用户消息
 * @param {boolean} isRegenerate - 是否为重新生成
 * @returns {string} JSON字符串
 */
function buildApiRequestData(conversationHistory, message, isRegenerate = false, topicName = 'C++ 编程') {
    const systemMessage = buildSystemMessage(isRegenerate, topicName);
    const temperature = isRegenerate ? 0.9 : 0.7;
    
    const messages = [
        {
            role: 'system',
            content: systemMessage
        },
        ...conversationHistory,
        {
            role: 'user',
            content: message
        }
    ];

    return JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        stream: true,
        temperature: temperature
    });
}

/**
 * 发送流式请求到DeepSeek API
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 * @param {Array} conversationHistory - 对话历史
 * @param {string} message - 用户消息
 * @param {boolean} isRegenerate - 是否为重新生成
 * @param {string} topicName - 主题名称
 * @param {Function} onComplete - 完成回调函数
 */
function sendStreamRequest(req, res, conversationHistory, message, isRegenerate, topicName, onComplete) {
    const apiRequestData = buildApiRequestData(conversationHistory, message, isRegenerate, topicName);
    const apiUrl = new URL(DEEPSEEK_API_URL);

    const options = {
        hostname: apiUrl.hostname,
        port: apiUrl.port || 443,
        path: apiUrl.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Length': Buffer.byteLength(apiRequestData)
        }
    };

    // 发送请求到 DeepSeek API
    const apiReq = https.request(options, (apiRes) => {
        // 设置响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        let buffer = '';
        let fullResponse = '';

        // 转发流式响应
        apiRes.on('data', (chunk) => {
            buffer += chunk.toString();
            res.write(chunk);
            
            // 解析流式数据，累积完整响应
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        continue;
                    }
                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullResponse += delta;
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        });

        apiRes.on('end', () => {
            if (onComplete) {
                onComplete(fullResponse);
            }
            res.end();
        });
    });

    apiReq.on('error', (error) => {
        console.error('API Request Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to connect to DeepSeek API' }));
    });

    // 发送请求数据
    apiReq.write(apiRequestData);
    apiReq.end();
}

module.exports = {
    sendStreamRequest
};

