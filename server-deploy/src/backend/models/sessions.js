/**
 * 会话模型
 * 处理会话相关的数据库操作
 */

const db = require('../db');

const Sessions = {
    /**
     * 创建新会话
     */
    async create(sessionData) {
        // 获取今天的日期（YYYY-MM-DD格式）
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const result = await db.execute(
            `INSERT INTO sessions (user_id, topic_id, session_date, start_time)
             VALUES (?, ?, ?, NOW())`,
            [sessionData.user_id, sessionData.topic_id, todayStr]
        );
        return result.insertId;
    },

    /**
     * 根据session_id查找会话
     */
    async findById(sessionId) {
        const rows = await db.query(
            'SELECT * FROM sessions WHERE session_id = ?',
            [sessionId]
        );
        return rows[0] || null;
    },

    /**
     * 根据user_id查找用户的所有会话
     */
    async findByUserId(userId) {
        return await db.query(
            'SELECT * FROM sessions WHERE user_id = ? ORDER BY start_time DESC',
            [userId]
        );
    },

    /**
     * 更新会话（结束时间、轮次、完成状态等）
     */
    async update(sessionId, sessionData) {
        const fields = [];
        const values = [];

        if (sessionData.end_time !== undefined) {
            fields.push('end_time = ?');
            values.push(sessionData.end_time);
        }
        if (sessionData.turn_count !== undefined) {
            fields.push('turn_count = ?');
            values.push(sessionData.turn_count);
        }
        if (sessionData.is_completed !== undefined) {
            fields.push('is_completed = ?');
            values.push(sessionData.is_completed);
        }
        if (sessionData.satisfaction_score !== undefined) {
            fields.push('satisfaction_score = ?');
            values.push(sessionData.satisfaction_score);
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(sessionId);
        await db.execute(
            `UPDATE sessions SET ${fields.join(', ')} WHERE session_id = ?`,
            values
        );
    },

    /**
     * 获取用户今天的会话（如果存在）
     */
    async findTodaySessionByUserId(userId, topicId) {
        // 获取今天的日期（YYYY-MM-DD格式）
        // 使用本地时区，避免UTC时区导致的日期不匹配问题
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        const rows = await db.query(
            `SELECT * FROM sessions 
             WHERE user_id = ? AND topic_id = ? 
             AND session_date = ?
             ORDER BY start_time DESC
             LIMIT 1`,
            [userId, topicId, todayStr]
        );
        
        return rows[0] || null;
    },
    
    /**
     * 查找用户所有已完成的会话
     */
    async findCompletedSessionsByUserId(userId) {
        return await db.query(
            'SELECT end_time, is_completed FROM sessions WHERE user_id = ? AND is_completed = 1 AND end_time IS NOT NULL',
            [userId]
        );
    }
};

module.exports = Sessions;

