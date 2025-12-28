const http = require('http');
const https = require('https');
const url = require('url');

const DEEPSEEK_API_KEY = 'sk-814ea4b2d4fb44538c123fa820ebbcb5';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const PORT = 3000;

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 只处理 POST 请求
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    // 解析请求体
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

        req.on('end', () => {
        try {
            const requestData = JSON.parse(body);
            const { message, conversationHistory = [], isRegenerate = false } = requestData;

            if (!message) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Message is required' }));
                return;
            }

            // 构建消息历史
            let systemMessage = '你是一位友好的 C++ 编程导师。请用清晰简洁的方式解释概念，在适当的时候使用例子。请始终用中文回复。';
            
            // 如果是重新生成，修改系统提示以增加变化
            if (isRegenerate) {
                systemMessage += ' 请用不同的角度或方式重新解释，可以换一个例子或使用不同的表达方式。';
            }

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

            // 准备发送到 DeepSeek API 的请求
            // 重新生成时增加temperature以增加随机性
            const temperature = isRegenerate ? 0.9 : 0.7;
            
            const apiRequestData = JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                stream: true, // 启用流式输出
                temperature: temperature
            });

            // 解析 API URL
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

                // 转发流式响应
                apiRes.on('data', (chunk) => {
                    res.write(chunk);
                });

                apiRes.on('end', () => {
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

        } catch (error) {
            console.error('Server Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('按 Ctrl+C 停止服务器');
});

