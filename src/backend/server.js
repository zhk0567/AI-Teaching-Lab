/**
 * 后端服务器主文件
 * 负责HTTP服务器创建和路由分发
 */

const http = require('http');

// 数据库模块
const { initTables } = require('./init-db');
const Users = require('./models/users');

// 路由模块
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const progressRoutes = require('./routes/progress');
const adminRoutes = require('./routes/admin');

// 服务和工具
const authService = require('./services/authService');
const { setUserIdMapping } = require('./utils/progress');

const PORT = 3000;

/**
 * 设置CORS头
 * @param {object} res - HTTP响应对象
 */
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * 处理路由分发
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleRequest(req, res) {
    const requestStartTime = Date.now();
    // 使用 WHATWG URL API 替代已弃用的 url.parse()
    const baseUrl = `http://${req.headers.host || 'localhost:3000'}`;
    const parsedUrl = new URL(req.url, baseUrl);
    const pathname = parsedUrl.pathname;
    
    // 不记录正常请求，只记录错误
    
    // 设置请求超时，防止请求长时间挂起
    const requestTimeout = setTimeout(() => {
        const elapsed = Date.now() - requestStartTime;
        console.error(`[服务器] 请求超时，关闭连接: ${req.method} ${pathname}，已耗时: ${elapsed}ms`);
        if (!res.headersSent) {
            res.writeHead(408, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '请求超时' }));
        }
        // 销毁socket，强制关闭连接
        if (req.socket && !req.socket.destroyed) {
            req.socket.destroy();
        }
    }, 5000);  // 5秒超时
    
    // 请求完成时清除超时
    res.on('finish', () => {
        clearTimeout(requestTimeout);
    });
    
    res.on('close', () => {
        clearTimeout(requestTimeout);
    });
    
    setCorsHeaders(res);

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        clearTimeout(requestTimeout);
        return;
    }

    try {
        // 认证路由
        if (pathname === '/login' && req.method === 'POST') {
            await authRoutes.handleLogin(req, res);
            return;
        }

        if (pathname === '/verify' && req.method === 'POST') {
            await authRoutes.handleVerify(req, res);
            return;
        }

        // 聊天路由（流式响应，需要更长时间，不设置超时保护）
        if (pathname === '/chat' && req.method === 'POST') {
            // 对于流式响应，清除所有超时限制
            clearTimeout(requestTimeout);
            // 清除socket级别的超时
            if (req.socket && req.socket.setTimeout) {
                req.socket.setTimeout(0);  // 0表示无超时
            }
            await chatRoutes.handleChat(req, res);
            return;
        }

        // 进度路由
        if (pathname === '/progress' && req.method === 'GET') {
            await progressRoutes.handleGetProgress(req, res);
            return;
        }

        if (pathname === '/progress' && req.method === 'POST') {
            await progressRoutes.handleSaveProgress(req, res);
            return;
        }

        if (pathname === '/progress/completed-dates' && req.method === 'GET') {
            await progressRoutes.handleGetCompletedDates(req, res);
            return;
        }

        // 管理员路由
        if (pathname === '/admin/users' && req.method === 'GET') {
            await adminRoutes.handleGetUsers(req, res);
            return;
        }

        if (pathname === '/admin/set-progress' && req.method === 'POST') {
            await adminRoutes.handleSetProgress(req, res);
            return;
        }

        if (pathname === '/admin/set-quota' && req.method === 'POST') {
            await adminRoutes.handleSetQuota(req, res);
            return;
        }

        if (pathname === '/admin/reset-status' && req.method === 'POST') {
            await adminRoutes.handleResetUserStatus(req, res);
            return;
        }

        // 404 未找到
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '接口不存在' }));

    } catch (error) {
        console.error('Server Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
    }
}

// 创建 HTTP 服务器
const server = http.createServer(handleRequest);

// 设置服务器连接超时和最大连接数，防止连接堆积
// 注意：流式响应（/chat）不设置超时，其他请求保持超时保护
server.keepAliveTimeout = 60000;  // 60秒后关闭空闲连接（流式响应可能需要更长时间）
server.headersTimeout = 65000;    // 65秒后关闭未发送headers的连接
server.maxHeadersCount = 20;      // 限制最大headers数量

// 监听连接事件，防止连接堆积
server.on('connection', (socket) => {
    // 初始设置socket超时，但流式响应会在handleRequest中清除
    socket.setTimeout(5000);  // 默认5秒超时（流式响应会清除此超时）
    
    socket.on('timeout', () => {
        // 只有在socket确实空闲时才关闭（流式响应会清除超时，不会触发此事件）
        socket.destroy();
    });
    
    socket.on('error', (err) => {
        console.error('Socket错误:', err);
        socket.destroy();
    });
});

// 监听服务器错误
server.on('error', (err) => {
    console.error('服务器错误:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用，请检查是否有其他进程在使用`);
    }
});

/**
 * 初始化数据库并启动服务器
 */
async function startServer() {
    try {
        await initTables();
        
        // 初始化测试用户到数据库（如果不存在）
        // 注意：admin 账号是管理员账号，不写入数据库
        const testUsers = [
            { username: 'group1_user1', group: 'group1', groupId: '1', maxTurns: 2, conditionDepth: 0, conditionTurns: 0 },
            { username: 'group1_user2', group: 'group1', groupId: '1', maxTurns: 2, conditionDepth: 0, conditionTurns: 0 },
            { username: 'group2_user1', group: 'group2', groupId: '2', targetTurns: 6, conditionDepth: 0, conditionTurns: 1 },
            { username: 'group2_user2', group: 'group2', groupId: '2', targetTurns: 6, conditionDepth: 0, conditionTurns: 1 }
        ];
        
        for (const userData of testUsers) {
            try {
                let dbUser = await Users.findByUsername(userData.username);
                if (!dbUser) {
                    const userId = await Users.create({
                        student_id: userData.username,
                        group_id: userData.groupId,
                        condition_depth: userData.conditionDepth,
                        condition_turns: userData.conditionTurns,
                        consent_agreed: 1,
                        max_turns: userData.maxTurns || null,
                        target_turns: userData.targetTurns || null
                    });
                    setUserIdMapping(userData.username, userId);
                } else {
                    setUserIdMapping(userData.username, dbUser.user_id);
                    // 如果数据库中没有max_turns或target_turns，更新它们
                    if ((userData.maxTurns && !dbUser.max_turns) || (userData.targetTurns && !dbUser.target_turns)) {
                        await Users.update(dbUser.user_id, {
                            max_turns: userData.maxTurns || dbUser.max_turns,
                            target_turns: userData.targetTurns || dbUser.target_turns
                        });
                    }
                }
            } catch (error) {
                console.error(`初始化用户 ${userData.username} 失败:`, error);
            }
        }
        
        server.listen(PORT, () => {
            console.log(`服务器运行在 http://localhost:${PORT}`);
        });
        
        // 监听服务器连接（不输出日志，只监听错误）
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();
