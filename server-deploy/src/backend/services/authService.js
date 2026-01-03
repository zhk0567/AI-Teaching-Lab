/**
 * 认证服务
 * 处理用户登录、Token验证等认证相关逻辑
 */

const Users = require('../models/users');
const { generateToken, setToken } = require('../utils/auth');
const { getUserProgress } = require('../utils/progress');
const { setUserIdMapping } = require('../utils/progress');

// 只保留admin账号的硬编码（管理员账号特殊处理）
const adminUser = {
    'admin': { username: 'admin', password: 'admin123', group: 'admin', isAdmin: true }
};

/**
 * 验证用户登录（从数据库读取，admin除外）
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<object|null>} 用户对象或null
 */
async function validateUser(username, password) {
    // admin账号特殊处理（不需要数据库查询）
    if (username === 'admin') {
        const user = adminUser[username];
        if (!user || user.password !== password) {
            return null;
        }
        return user;
    }
    
    // 其他用户从数据库读取
    const dbUser = await Users.findByUsername(username);
    
    if (!dbUser) {
        return null;
    }
    
    // 数据库中的密码验证
    // 如果数据库中有密码字段，使用数据库中的密码；否则使用默认密码'123'（兼容旧数据）
    // 处理 NULL、空字符串等情况
    let dbPassword = null;
    if (dbUser.password !== null && dbUser.password !== undefined && dbUser.password !== '') {
        dbPassword = String(dbUser.password).trim();
    } else {
        // 如果数据库中没有密码，尝试使用 student_id 作为密码（CSV导入时通常密码等于学号）
        dbPassword = String(dbUser.student_id || username).trim();
    }
    
    // 清理输入的密码（去除前后空格）
    const inputPassword = String(password || '').trim();
    
    if (inputPassword !== dbPassword) {
        // 如果密码不匹配，再尝试使用默认密码'123'（兼容旧数据）
        if (inputPassword === '123') {
            // 继续执行，使用默认密码
        } else {
            return null;
        }
    }
    
    // 映射group_id到group名称
    let group = 'group1';
    if (dbUser.group_id === '2') {
        group = 'group2';
    } else if (dbUser.group_id === '3') {
        group = 'group3';
    } else if (dbUser.group_id === '4') {
        group = 'group4';
    }
    
    return {
        username: dbUser.student_id,
        password: '123', // 不返回真实密码
        group: group,
        maxTurns: dbUser.max_turns || (group === 'group1' ? 2 : null),
        targetTurns: dbUser.target_turns || (group === 'group2' ? 6 : null),
        isAdmin: false,
        user_id: dbUser.user_id  // 添加 user_id，避免 login 函数再次查询
    };
}

/**
 * 处理用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<object>} 登录结果 {success, token, username, group, isAdmin, progress}
 */
async function login(username, password) {
    // 优化：validateUser 已经查询过数据库，直接使用返回的用户信息
    // 对于非admin用户，validateUser 已经返回了包含 user_id 的信息
    const user = await validateUser(username, password);
    
    if (!user) {
        throw new Error('用户名或密码错误');
    }

    // 对于非admin用户，validateUser 已经查询过数据库
    // 如果 user 对象包含 user_id，直接使用；否则需要再次查询（但这种情况不应该发生）
    if (username !== 'admin' && user.user_id) {
        setUserIdMapping(username, user.user_id);
    } else if (username !== 'admin' && !user.user_id) {
        // 如果 validateUser 没有返回 user_id，再次查询（但应该避免这种情况）
        const dbUser = await Users.findByUsername(username);
        if (dbUser) {
            setUserIdMapping(username, dbUser.user_id);
        }
    }

    // 生成Token
    const token = generateToken();
    setToken(token, {
        username: user.username,
        group: user.group,
        isAdmin: user.isAdmin || false,
        createdAt: Date.now()
    });

    // 登录时不查询进度，直接返回默认值，避免阻塞登录流程
    // 前端可以在登录后通过 /progress 接口单独获取进度
    const progress = { turnCount: 0, completed: false };

    return {
        success: true,
        token: token,
        username: user.username,
        group: user.group,
        isAdmin: user.isAdmin || false,
        progress: progress
    };
}

module.exports = {
    validateUser,
    login
};

