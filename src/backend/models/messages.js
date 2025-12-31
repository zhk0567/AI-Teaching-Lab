/**
 * 消息模型
 * 处理消息相关的数据库操作
 */

const db = require('../db');

const Messages = {
    /**
     * 创建新消息
     */
    async create(messageData) {
        const result = await db.execute(
            `INSERT INTO messages 
             (session_id, role, content, template_id_used, is_edited, edit_distance, turn_index, response_time_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                messageData.session_id,
                messageData.role,
                messageData.content,
                messageData.template_id_used || null,
                messageData.is_edited || 0,
                messageData.edit_distance || null,
                messageData.turn_index,
                messageData.response_time_ms || null
            ]
        );
        return result.insertId;
    },

    /**
     * 根据session_id获取所有消息
     */
    async findBySessionId(sessionId) {
        return await db.query(
            'SELECT * FROM messages WHERE session_id = ? ORDER BY turn_index ASC, created_at ASC',
            [sessionId]
        );
    },

    /**
     * 获取会话的轮次数
     */
    async getTurnCount(sessionId) {
        const rows = await db.query(
            'SELECT MAX(turn_index) as max_turn FROM messages WHERE session_id = ?',
            [sessionId]
        );
        return rows[0]?.max_turn || 0;
    },

    /**
     * 删除会话的所有消息
     */
    async deleteBySessionId(sessionId) {
        // 记录删除操作（用于调试）
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM messages WHERE session_id = ?',
            [sessionId]
        );
        const messageCount = countResult[0]?.count || 0;
        if (messageCount > 0) {
            console.log(`[消息删除] 准备删除会话 ${sessionId} 的 ${messageCount} 条消息`);
        }
        
        await db.execute(
            'DELETE FROM messages WHERE session_id = ?',
            [sessionId]
        );
        
        if (messageCount > 0) {
            console.log(`[消息删除] 已删除会话 ${sessionId} 的 ${messageCount} 条消息`);
        }
    }
};

module.exports = Messages;

