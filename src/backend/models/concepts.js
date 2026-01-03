/**
 * 概念墙模型
 * 处理概念相关的数据库操作
 */

const db = require('../db');

const Concepts = {
    /**
     * 创建概念
     */
    async create(conceptData) {
        // 先检查是否已存在
        const existing = await this.findByUserAndNameAndDate(
            conceptData.user_id,
            conceptData.concept_name,
            conceptData.concept_date
        );
        
        if (existing) {
            // 已存在，返回现有记录的ID
            return existing.concept_id;
        }

        // 不存在，创建新记录
        const result = await db.execute(
            `INSERT INTO concepts (user_id, student_id, session_id, concept_name, concept_date)
             VALUES (?, ?, ?, ?, ?)`,
            [
                conceptData.user_id,
                conceptData.student_id,
                conceptData.session_id || null,
                conceptData.concept_name,
                conceptData.concept_date
            ]
        );
        return result.insertId;
    },

    /**
     * 根据用户ID和日期获取概念列表
     */
    async findByUserIdAndDate(userId, date) {
        return await db.query(
            'SELECT * FROM concepts WHERE user_id = ? AND concept_date = ? ORDER BY created_at ASC',
            [userId, date]
        );
    },

    /**
     * 根据学号获取概念列表
     */
    async findByStudentId(studentId) {
        return await db.query(
            'SELECT * FROM concepts WHERE student_id = ? ORDER BY concept_date DESC, created_at ASC',
            [studentId]
        );
    },

    /**
     * 根据学号和日期获取概念列表
     */
    async findByStudentIdAndDate(studentId, date) {
        return await db.query(
            'SELECT * FROM concepts WHERE student_id = ? AND concept_date = ? ORDER BY created_at ASC',
            [studentId, date]
        );
    },

    /**
     * 根据用户ID、概念名称和日期查找概念
     */
    async findByUserAndNameAndDate(userId, conceptName, date) {
        const rows = await db.query(
            'SELECT * FROM concepts WHERE user_id = ? AND concept_name = ? AND concept_date = ?',
            [userId, conceptName, date]
        );
        return rows[0] || null;
    },

    /**
     * 根据会话ID获取概念列表
     */
    async findBySessionId(sessionId) {
        return await db.query(
            'SELECT * FROM concepts WHERE session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
    }
};

module.exports = Concepts;

