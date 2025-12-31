/**
 * 行为埋点模型
 * 处理UI事件相关的数据库操作
 */

const db = require('../db');

const Events = {
    /**
     * 记录事件
     */
    async create(eventData) {
        const result = await db.execute(
            `INSERT INTO ui_events (user_id, session_id, event_type, event_value, timestamp)
             VALUES (?, ?, ?, ?, ?)`,
            [
                eventData.user_id,
                eventData.session_id || null,
                eventData.event_type,
                eventData.event_value || null,
                eventData.timestamp || new Date()
            ]
        );
        return result.insertId;
    },

    /**
     * 根据user_id获取用户的所有事件
     */
    async findByUserId(userId, limit = 100) {
        return await db.query(
            'SELECT * FROM ui_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
            [userId, limit]
        );
    },

    /**
     * 根据session_id获取会话的所有事件
     */
    async findBySessionId(sessionId) {
        return await db.query(
            'SELECT * FROM ui_events WHERE session_id = ? ORDER BY timestamp ASC',
            [sessionId]
        );
    }
};

module.exports = Events;

