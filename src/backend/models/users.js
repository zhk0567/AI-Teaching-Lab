/**
 * 用户模型
 * 处理用户相关的数据库操作
 */

const db = require('../db');

const Users = {
    /**
     * 根据学号查找用户
     */
    async findByStudentId(studentId) {
        const rows = await db.query(
            'SELECT * FROM users WHERE student_id = ?',
            [studentId]
        );
        return rows[0] || null;
    },

    /**
     * 根据用户名查找用户（用户名实际存储在student_id字段中）
     */
    async findByUsername(username) {
        const rows = await db.query(
            'SELECT * FROM users WHERE student_id = ?',
            [username]
        );
        return rows[0] || null;
    },

    /**
     * 根据user_id查找用户
     */
    async findById(userId) {
        const rows = await db.query(
            'SELECT * FROM users WHERE user_id = ?',
            [userId]
        );
        return rows[0] || null;
    },

    /**
     * 创建新用户
     */
    async create(userData) {
        const result = await db.execute(
            `INSERT INTO users (student_id, group_id, condition_depth, condition_turns, consent_agreed, max_turns, target_turns)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userData.student_id,
                userData.group_id,
                userData.condition_depth || 0,
                userData.condition_turns || 0,
                userData.consent_agreed || 0,
                userData.max_turns || null,
                userData.target_turns || null
            ]
        );
        return result.insertId;
    },

    /**
     * 更新用户信息
     */
    async update(userId, userData) {
        const fields = [];
        const values = [];

        if (userData.group_id !== undefined) {
            fields.push('group_id = ?');
            values.push(userData.group_id);
        }
        if (userData.consent_agreed !== undefined) {
            fields.push('consent_agreed = ?');
            values.push(userData.consent_agreed);
        }
        if (userData.max_turns !== undefined) {
            fields.push('max_turns = ?');
            values.push(userData.max_turns);
        }
        if (userData.target_turns !== undefined) {
            fields.push('target_turns = ?');
            values.push(userData.target_turns);
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(userId);
        await db.execute(
            `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`,
            values
        );
    },

    /**
     * 获取所有用户（管理员用）
     */
    async findAll() {
        return await db.query('SELECT * FROM users ORDER BY created_at DESC');
    },
    
    /**
     * 批量获取所有用户及其今天的进度信息（管理员用）
     * 使用JOIN一次性查询，避免逐个查询
     */
    async findAllWithProgress() {
        const topicId = 'cpp_pointers_memory'; // 默认主题
        
        // 使用LEFT JOIN一次性获取所有用户及其今天的会话信息
        // 使用LEFT JOIN获取消息表的turn_count（如果会话中没有）
        const rows = await db.query(`
            SELECT 
                u.user_id,
                u.student_id,
                u.group_id,
                u.max_turns,
                u.target_turns,
                u.condition_depth,
                u.condition_turns,
                u.created_at,
                s.session_id,
                s.turn_count as session_turn_count,
                s.is_completed,
                s.end_time,
                CASE 
                    -- 如果会话中的 turn_count 存在且 > 0，使用它
                    WHEN s.turn_count IS NOT NULL AND s.turn_count > 0 THEN s.turn_count
                    -- 否则，如果消息表中有数据，使用消息表的 max_turn
                    WHEN m.max_turn IS NOT NULL AND m.max_turn > 0 THEN m.max_turn
                    -- 否则使用 0
                    ELSE 0
                END as actual_turn_count
            FROM users u
            LEFT JOIN sessions s ON u.user_id = s.user_id 
                AND s.topic_id = ? 
                AND DATE(s.start_time) = CURDATE()
            LEFT JOIN (
                SELECT session_id, MAX(turn_index) as max_turn
                FROM messages
                GROUP BY session_id
            ) m ON s.session_id = m.session_id
            WHERE u.student_id != 'admin'
            ORDER BY u.created_at DESC
        `, [topicId]);
        
        return rows;
    }
};

module.exports = Users;

