/**
 * 管理员路由
 * 处理管理员相关的请求
 */

const { parseBody } = require('../utils/auth');
const { verifyToken } = require('../utils/auth');
const Users = require('../models/users');
const Sessions = require('../models/sessions');
const { getUserId, setUserIdMapping, saveUserProgress, getUserProgress } = require('../utils/progress');
const authService = require('../services/authService');

/**
 * 检查管理员权限
 * @param {string} token - Token字符串
 * @returns {object|null} Token数据或null
 */
function checkAdminAuth(token) {
    const tokenData = verifyToken(token);
    if (!tokenData || !tokenData.isAdmin) {
        return null;
    }
    return tokenData;
}

/**
 * 处理获取用户列表请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleGetUsers(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        const token = authHeader.substring(7);
        const tokenData = checkAdminAuth(token);
        if (!tokenData) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '需要管理员权限' }));
            return;
        }
        
        // 使用批量查询一次性获取所有用户及其进度信息
        const dbUsersWithProgress = await Users.findAllWithProgress();
        
        if (dbUsersWithProgress.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, users: [] }));
            return;
        }
        
        // 格式化用户数据，使用数据库中的真实信息
        const formattedUsers = dbUsersWithProgress.map((row) => {
            const username = row.student_id;
            const group = row.group_id === '2' ? 'group2' : 'group1';
            
            // 设置用户ID映射
            if (!getUserId(username)) {
                setUserIdMapping(username, row.user_id);
            }
            
            // 从数据库获取真实的进度信息
            let turnCount = 0;
            let completed = false;
            
            if (row.session_id) {
                // 有今天的会话，使用会话中的真实数据
                // 使用与 getUserProgress 相同的逻辑：
                // 1. 优先使用会话中的 turn_count（如果 > 0）
                // 2. 如果 turn_count 为 0 或 NULL，使用消息表计算的
                // 3. 如果都没有，使用 0
                turnCount = row.actual_turn_count || 0;
                
                // MySQL BOOLEAN 返回的是 1/0/NULL，需要转换为布尔值
                // 使用与 getUserProgress 完全相同的逻辑
                completed = row.is_completed === 1 || row.is_completed === true || row.is_completed === '1';
                
            } else {
                // 没有今天的会话，turnCount为0，completed为false（数据库中的真实状态）
                turnCount = 0;
                completed = false;
            }
            
            return {
                student_id: username,
                username: username,
                group: group,
                progress: {
                    turnCount: typeof turnCount === 'number' ? turnCount : 0,
                    completed: completed
                },
                maxTurns: row.max_turns !== null && row.max_turns !== undefined ? row.max_turns : (group === 'group1' ? 2 : null),
                targetTurns: row.target_turns !== null && row.target_turns !== undefined ? row.target_turns : (group === 'group2' ? 6 : null),
                user_id: row.user_id,
                group_id: row.group_id,
                condition_depth: row.condition_depth || 0,
                condition_turns: row.condition_turns || 0
            };
        });
        
        const responseData = JSON.stringify({ success: true, users: formattedUsers });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(responseData);
    } catch (error) {
        console.error('获取用户列表失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

/**
 * 处理设置用户进度请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleSetProgress(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        const token = authHeader.substring(7);
        const tokenData = checkAdminAuth(token);
        if (!tokenData) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '需要管理员权限' }));
            return;
        }

        const requestData = await parseBody(req);
        const { username, turnCount, completed } = requestData;

        if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户名不能为空' }));
            return;
        }

        // 确保 completed 是布尔值
        const isCompleted = completed === true || completed === 'true' || completed === 1 || completed === '1';
        const progressData = {
            turnCount: turnCount !== undefined ? parseInt(turnCount) : 0,
            completed: isCompleted
        };
        
        try {
            await saveUserProgress(username, progressData);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '进度已保存' }));
        } catch (error) {
            console.error(`[管理员] ✗ 保存用户 ${username} 的进度失败:`, error);
            throw error; // 重新抛出，让外层 catch 处理
        }
    } catch (error) {
        console.error('设置用户进度失败:', error.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误' }));
        }
    }
}

/**
 * 处理设置用户额度请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleSetQuota(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        const token = authHeader.substring(7);
        const tokenData = checkAdminAuth(token);
        if (!tokenData) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '需要管理员权限' }));
            return;
        }

        const requestData = await parseBody(req);
        const { username, maxTurns, targetTurns } = requestData;

        if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户名不能为空' }));
            return;
        }

        // 从数据库查找用户
        const dbUser = await Users.findByUsername(username);
        if (!dbUser) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户不存在' }));
            return;
        }

        // 直接更新数据库（只要字段存在就更新）
        const updateData = {};
        if (maxTurns !== undefined) {
            updateData.max_turns = maxTurns;
        }
        if (targetTurns !== undefined) {
            updateData.target_turns = targetTurns;
        }

        if (Object.keys(updateData).length > 0) {
            await Users.update(dbUser.user_id, updateData);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        console.error('设置用户额度失败:', error.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误' }));
        }
    }
}

/**
 * 处理重置用户状态请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleResetUserStatus(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        const token = authHeader.substring(7);
        const tokenData = checkAdminAuth(token);
        if (!tokenData) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '需要管理员权限' }));
            return;
        }

        const requestData = await parseBody(req);
        const { username } = requestData;

        if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户名不能为空' }));
            return;
        }

        // 获取user_id
        let userId = getUserId(username);
        if (!userId) {
            const Users = require('../models/users');
            const dbUser = await Users.findByUsername(username);
            if (!dbUser) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '用户不存在' }));
                return;
            }
            userId = dbUser.user_id;
            setUserIdMapping(username, userId);
        }

        // 获取当天的topic_id（从数据库配置读取）
        const { getCurrentTopicId } = require('../utils/topics');
        const topicId = await getCurrentTopicId();
        
        // 查找今天的会话
        const session = await Sessions.findTodaySessionByUserId(userId, topicId);
        
        if (session) {
            // 删除该会话的所有消息记录（完全重置）
            const Messages = require('../models/messages');
            await Messages.deleteBySessionId(session.session_id);
            
            // 重置会话状态：turn_count=0, is_completed=false, end_time=NULL
            await Sessions.update(session.session_id, {
                turn_count: 0,
                is_completed: false,
                end_time: null
            });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '用户状态已重置' }));
    } catch (error) {
        console.error('重置用户状态失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

/**
 * 处理手动触发每日重置请求
 * @param {object} req - HTTP请求对象
 * @param {object} res - HTTP响应对象
 */
async function handleTriggerDailyReset(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        const token = authHeader.substring(7);
        const tokenData = checkAdminAuth(token);
        if (!tokenData) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '需要管理员权限' }));
            return;
        }

        // 执行重置
        const scheduler = require('../services/scheduler');
        const result = await scheduler.executeResetNow();

        if (result.success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: '重置完成',
                resetCount: result.resetCount,
                elapsed: result.elapsed
            }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: result.error || '重置失败',
                resetCount: result.resetCount,
                errorCount: result.errorCount
            }));
        }
    } catch (error) {
        console.error('手动触发重置失败:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误', details: error.message }));
        }
    }
}

module.exports = {
    handleGetUsers,
    handleSetProgress,
    handleSetQuota,
    handleResetUserStatus,
    handleTriggerDailyReset
};

