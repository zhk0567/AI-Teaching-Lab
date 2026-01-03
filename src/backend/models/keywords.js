/**
 * 关键词模型
 * 处理关键词相关的数据库操作
 */

const db = require('../db');

const Keywords = {
    /**
     * 创建关键词
     */
    async create(keywordData) {
        const result = await db.execute(
            `INSERT INTO keywords (user_id, student_id, session_id, message_id, keyword_text, keyword_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                keywordData.user_id,
                keywordData.student_id,
                keywordData.session_id || null,
                keywordData.message_id || null,
                keywordData.keyword_text,
                keywordData.keyword_date
            ]
        );
        return result.insertId;
    },

    /**
     * 根据关键词ID删除关键词
     */
    async deleteById(keywordId) {
        await db.execute(
            'DELETE FROM keywords WHERE keyword_id = ?',
            [keywordId]
        );
    },

    /**
     * 根据用户ID和关键词文本删除关键词（用于取消标记）
     */
    async deleteByUserAndText(userId, keywordText, messageId = null) {
        if (messageId) {
            await db.execute(
                'DELETE FROM keywords WHERE user_id = ? AND keyword_text = ? AND message_id = ?',
                [userId, keywordText, messageId]
            );
        } else {
            // 如果没有messageId，删除该用户的所有同名关键词（谨慎使用）
            await db.execute(
                'DELETE FROM keywords WHERE user_id = ? AND keyword_text = ? LIMIT 1',
                [userId, keywordText]
            );
        }
    },

    /**
     * 根据用户ID获取所有关键词
     */
    async findByUserId(userId) {
        return await db.query(
            'SELECT * FROM keywords WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    },

    /**
     * 根据用户ID和日期获取关键词列表
     */
    async findByUserIdAndDate(userId, date) {
        return await db.query(
            'SELECT * FROM keywords WHERE user_id = ? AND keyword_date = ? ORDER BY created_at ASC',
            [userId, date]
        );
    },

    /**
     * 根据学号获取所有关键词
     */
    async findByStudentId(studentId) {
        return await db.query(
            'SELECT * FROM keywords WHERE student_id = ? ORDER BY created_at DESC',
            [studentId]
        );
    },

    /**
     * 根据会话ID获取关键词
     */
    async findBySessionId(sessionId) {
        return await db.query(
            'SELECT * FROM keywords WHERE session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
    },

    /**
     * 根据消息ID获取关键词
     */
    async findByMessageId(messageId) {
        return await db.query(
            'SELECT * FROM keywords WHERE message_id = ? ORDER BY created_at ASC',
            [messageId]
        );
    },

    /**
     * 检查关键词是否已存在（同一用户、同一消息、同一文本）
     */
    async exists(userId, keywordText, messageId) {
        const rows = await db.query(
            'SELECT COUNT(*) as count FROM keywords WHERE user_id = ? AND keyword_text = ? AND message_id = ?',
            [userId, keywordText, messageId]
        );
        return (rows[0]?.count || 0) > 0;
    }
};

module.exports = Keywords;

