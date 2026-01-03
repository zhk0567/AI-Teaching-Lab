/**
 * 进度管理工具函数
 */

const Sessions = require('../models/sessions');
const Messages = require('../models/messages');

// 用户ID映射（username -> user_id，用于临时兼容）
const usernameToUserId = new Map();

/**
 * 设置用户ID映射
 * @param {string} username - 用户名
 * @param {number} userId - 用户ID
 */
function setUserIdMapping(username, userId) {
    usernameToUserId.set(username, userId);
}

/**
 * 获取用户ID
 * @param {string} username - 用户名
 * @returns {number|null} 用户ID或null
 */
function getUserId(username) {
    return usernameToUserId.get(username) || null;
}

/**
 * 获取用户今天的进度（从数据库）
 * @param {string} username - 用户名
 * @returns {Promise<object>} 进度对象 {turnCount, completed}
 */
async function getUserProgress(username) {
    // 获取user_id（如果映射中没有，尝试从数据库查找）
    let userId = getUserId(username);
    if (!userId) {
        const Users = require('../models/users');
        const dbUser = await Users.findByUsername(username);
        if (dbUser) {
            userId = dbUser.user_id;
            setUserIdMapping(username, userId);
        } else {
            // 用户不存在，抛出错误而不是返回默认值
            throw new Error(`用户 ${username} 不存在`);
        }
    }

    // 获取今天的topic_id（从数据库配置读取）
    const { getCurrentTopicId } = require('./topics');
    const topicId = await getCurrentTopicId();
    
    // 查找今天的会话
    const session = await Sessions.findTodaySessionByUserId(userId, topicId);
    
    if (session) {
        // 优先使用会话中的 turn_count（管理员设置的）
        // 如果会话中没有，才从消息表计算
        let actualTurnCount = session.turn_count || 0;
        
        // 如果会话中的 turn_count 为 0 或未设置，尝试从消息表计算
        // 注意：这里只读取，不自动更新，避免在保存消息过程中产生竞态条件
        // turn_count 应该在保存消息时由 chat.js 统一更新
        if (actualTurnCount === 0) {
            const messageTurnCount = await Messages.getTurnCount(session.session_id);
            if (messageTurnCount > 0) {
                actualTurnCount = messageTurnCount;
                // 注意：这里不自动更新会话的turn_count，避免与chat.js中的更新产生竞态条件
                // 如果发现数据不一致，应该由chat.js在保存消息时统一更新
            }
        }
        
        // MySQL BOOLEAN 返回的是 1/0/NULL，需要转换为布尔值
        // 使用与管理员界面完全相同的逻辑
        const isCompleted = session.is_completed === 1 || session.is_completed === true || session.is_completed === '1';
        
        const progress = {
            turnCount: typeof actualTurnCount === 'number' ? actualTurnCount : 0,
            completed: isCompleted
        };
        
        return progress;
    }
    
    // 没有会话，返回数据库中的真实状态（0, false）
    return { turnCount: 0, completed: false };
}

/**
 * 保存用户今天的进度（到数据库）
 * @param {string} username - 用户名
 * @param {object} progress - 进度对象 {turnCount, completed}
 */
async function saveUserProgress(username, progress) {
    try {
        const Users = require('../models/users');
        
        // 获取user_id（如果映射中没有，尝试从数据库查找）
        let userId = getUserId(username);
        let dbUser = null;
        
        if (!userId) {
            // 尝试从数据库查找用户
            dbUser = await Users.findByUsername(username);
            if (dbUser) {
                userId = dbUser.user_id;
                setUserIdMapping(username, userId);
            } else {
                // 用户不存在，尝试自动创建（从用户名推断组别）
                // 从用户名推断组别（group1_user1 -> group1, group2_user1 -> group2）
                let groupId = '1';
                let conditionDepth = 0;
                let conditionTurns = 0;
                
                if (username.includes('group1')) {
                    groupId = '1';
                    conditionDepth = 0;
                    conditionTurns = 0;
                } else if (username.includes('group2')) {
                    groupId = '2';
                    conditionDepth = 0;
                    conditionTurns = 1;
                } else if (username.includes('group3')) {
                    groupId = '3';
                    conditionDepth = 1;
                    conditionTurns = 0;
                } else if (username.includes('group4')) {
                    groupId = '4';
                    conditionDepth = 1;
                    conditionTurns = 1;
                }
                
                // 创建新用户
                userId = await Users.create({
                    student_id: username,
                    group_id: groupId,
                    condition_depth: conditionDepth,
                    condition_turns: conditionTurns,
                    consent_agreed: 1,
                    max_turns: groupId === '1' ? 2 : null,
                    target_turns: groupId === '2' ? 6 : null
                });
                
                setUserIdMapping(username, userId);
            }
        } else {
            // 如果已有userId，也获取一下用户信息（用于日志）
            dbUser = await Users.findById(userId);
        }

        // 获取今天的topic_id（从数据库配置读取）
        const { getCurrentTopicId } = require('./topics');
        const topicId = await getCurrentTopicId();
        
        // 查找或创建今天的会话
        let session = await Sessions.findTodaySessionByUserId(userId, topicId);
        if (!session) {
            const sessionId = await Sessions.create({
                user_id: userId,
                topic_id: topicId
            });
            session = await Sessions.findById(sessionId);
            if (!session) {
                throw new Error(`创建会话后无法找到会话 session_id: ${sessionId}`);
            }
        }

        // 更新会话进度（确保 completed 转换为 MySQL 的 1/0）
        const isCompleted = progress.completed === true || progress.completed === 1 || progress.completed === '1';
        const updateData = {
            turn_count: progress.turnCount !== undefined ? progress.turnCount : 0,
            is_completed: isCompleted ? 1 : 0  // MySQL BOOLEAN 实际是 TINYINT(1)
        };
        
        // 如果设置为已完成，自动设置完成时间为当日的 24:00 (23:59:59)
        if (isCompleted) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            // 设置为当日的 23:59:59（接近24:00）
            updateData.end_time = `${year}-${month}-${day} 23:59:59`;
        }
        
        // 执行更新
        await Sessions.update(session.session_id, updateData);
        
        // 等待一小段时间，确保数据库写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 验证更新是否成功（立即查询数据库确认）
        const updatedSession = await Sessions.findById(session.session_id);
        if (!updatedSession) {
            throw new Error(`更新后无法找到会话 session_id: ${session.session_id}`);
        }
        
        // 验证数据是否正确保存
        const savedTurnCount = updatedSession.turn_count || 0;
        const savedIsCompleted = updatedSession.is_completed === 1 || updatedSession.is_completed === true;
        
        if (savedTurnCount !== updateData.turn_count || savedIsCompleted !== isCompleted) {
            console.error(`⚠ 数据验证失败！`, {
                期望: { turn_count: updateData.turn_count, is_completed: isCompleted },
                实际: { turn_count: savedTurnCount, is_completed: savedIsCompleted },
                原始值: { turn_count_raw: updatedSession.turn_count, is_completed_raw: updatedSession.is_completed }
            });
            throw new Error('数据保存后验证失败，数据可能未正确写入数据库');
        }
        
        // 如果设置了完成时间，验证是否保存成功
        if (isCompleted && updateData.end_time) {
            const savedEndTime = updatedSession.end_time;
            if (!savedEndTime) {
                console.warn(`⚠ 完成时间未保存（可能字段不存在）`);
            }
        }
    } catch (error) {
        console.error('保存用户进度失败:', error);
        throw error; // 抛出错误，让调用者知道保存失败
    }
}

/**
 * 获取用户所有完成日期
 * @param {string} username - 用户名
 * @returns {Promise<string[]>} - 完成日期数组（格式：YYYY-MM-DD）
 */
async function getCompletedDates(username) {
    let userId = getUserId(username);
    if (!userId) {
        const Users = require('../models/users');
        const user = await Users.findByUsername(username);
        if (user) {
            userId = user.user_id;
            setUserIdMapping(username, userId);
        } else {
            return [];
        }
    }

    const Sessions = require('../models/sessions');
    // 查询所有已完成的会话，提取日期
    const sessions = await Sessions.findCompletedSessionsByUserId(userId);
    
    const completedDates = new Set();
    
    for (const session of sessions) {
        if (session.is_completed === 1 || session.is_completed === true) {
            if (session.end_time) {
                // 提取日期部分（YYYY-MM-DD）
                const dateStr = session.end_time.toString().split(' ')[0];
                if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    completedDates.add(dateStr);
                }
            }
        }
    }
    
    return Array.from(completedDates).sort();
}

module.exports = {
    setUserIdMapping,
    getUserId,
    getUserProgress,
    saveUserProgress,
    getCompletedDates
};

