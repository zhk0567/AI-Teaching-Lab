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
        // 获取今天的日期（YYYY-MM-DD格式）
        // 如果 messageData 中提供了 message_date，使用它；否则使用当前日期
        let messageDate = messageData.message_date;
        if (!messageDate) {
            const today = new Date();
            messageDate = today.toISOString().split('T')[0];
        }
        
        const result = await db.execute(
            `INSERT INTO messages 
             (session_id, student_id, message_date, role, content, template_id_used, is_edited, edit_distance, turn_index, response_time_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                messageData.session_id,
                messageData.student_id,
                messageDate,
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
     * 注意：轮次应该基于用户消息的数量，而不是消息表中的最大turn_index
     * 因为turn_index是每轮对话的编号（用户消息和AI消息使用相同的turn_index）
     */
    async getTurnCount(sessionId) {
        // 计算唯一的用户消息轮次数量（使用DISTINCT turn_index）
        const rows = await db.query(
            'SELECT COUNT(DISTINCT turn_index) as turn_count FROM messages WHERE session_id = ? AND role = ?',
            [sessionId, 'user']
        );
        const turnCount = rows[0]?.turn_count || 0;
        
        // 只在开发环境或轮次变化时记录日志（减少日志输出）
        // 注意：这里只是查询，不会修改数据，所以不会导致轮次增加
        
        return turnCount;
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

