/**
 * 重置服务
 * 处理每日状态重置相关逻辑
 */

const Sessions = require('../models/sessions');
const Messages = require('../models/messages');
const Users = require('../models/users');
const { getCurrentTopicId } = require('../utils/topics');

/**
 * 重置所有用户的当天状态
 * @returns {Promise<object>} 重置结果 {success, resetCount, errorCount}
 */
async function resetAllUsersStatus() {
    const startTime = Date.now();
    let resetCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
        console.log('[每日重置] 开始重置所有用户的当天状态...');
        
        // 获取当天的 topic_id
        const topicId = await getCurrentTopicId();
        console.log(`[每日重置] 当前 topic_id: ${topicId}`);

        // 获取所有用户
        const allUsers = await Users.findAll();
        console.log(`[每日重置] 找到 ${allUsers.length} 个用户`);

        // 批量查找所有用户需要重置的会话
        // 重置逻辑：重置所有"昨天"的会话（重置在00:00执行，此时已经是新的一天）
        // 这样用户可以在新的一天重新开始
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

        // 使用单个 SQL 查询获取所有用户昨天的会话
        // 注意：不再删除数据，只确保昨天的会话有结束时间（如果还没有的话）
        const db = require('../db');
        const sessions = await db.query(`
            SELECT s.session_id, s.user_id, s.turn_count, s.is_completed, s.end_time
            FROM sessions s
            WHERE s.topic_id = ? 
            AND s.session_date = ?
        `, [topicId, yesterdayStr]);

        console.log(`[每日重置] 找到 ${sessions.length} 个昨天的会话（日期: ${yesterdayStr}）`);

        // 批量更新昨天的会话：确保有结束时间（如果还没有）
        // 注意：不再删除消息，保留所有历史数据
        if (sessions.length > 0) {
            const sessionIds = sessions
                .filter(s => !s.end_time) // 只更新还没有结束时间的会话
                .map(s => s.session_id);
            
            if (sessionIds.length > 0) {
                // 为昨天的会话设置结束时间（23:59:59）
                const yesterdayEndTime = `${yesterdayStr} 23:59:59`;
                const updateResult = await db.execute(
                    `UPDATE sessions 
                     SET end_time = ?
                     WHERE session_id IN (${sessionIds.map(() => '?').join(',')})`,
                    [yesterdayEndTime, ...sessionIds]
                );
                
                resetCount = updateResult.affectedRows || 0;
                console.log(`[每日重置] 已为 ${resetCount} 个昨天的会话设置结束时间（保留所有历史数据）`);
            } else {
                console.log(`[每日重置] 所有昨天的会话都已有关结束时间，无需更新`);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[每日重置] 重置完成！重置了 ${resetCount} 个会话，耗时 ${elapsed}ms`);

        return {
            success: true,
            resetCount: resetCount,
            errorCount: errorCount,
            errors: errors,
            elapsed: elapsed
        };
    } catch (error) {
        console.error('[每日重置] 重置过程中发生错误:', error);
        return {
            success: false,
            resetCount: resetCount,
            errorCount: errorCount + 1,
            errors: [...errors, error.message],
            error: error.message
        };
    }
}

module.exports = {
    resetAllUsersStatus
};

