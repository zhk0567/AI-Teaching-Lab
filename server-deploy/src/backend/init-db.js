/**
 * 数据库初始化脚本
 * 自动创建所有必需的表
 */

const db = require('./db');

/**
 * 初始化所有表
 */
async function initTables() {
    try {
        await db.createPool();

        // 1. 用户核心表 (Users Table)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE NOT NULL COMMENT '学号',
                group_id ENUM('1', '2', '3', '4') NOT NULL COMMENT '1=LDLT, 2=LDHT, 3=HDLT, 4=HDHT',
                condition_depth BOOLEAN NOT NULL DEFAULT 0 COMMENT '0=Low, 1=High',
                condition_turns BOOLEAN NOT NULL DEFAULT 0 COMMENT '0=Low, 1=High',
                consent_agreed BOOLEAN NOT NULL DEFAULT 0 COMMENT '是否同意知情同意书',
                max_turns INT NULL COMMENT '最大轮次（group1使用）',
                target_turns INT NULL COMMENT '目标轮次（group2使用）',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_student_id (student_id),
                INDEX idx_group_id (group_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户核心表'
        `);
        
        // 添加新字段（如果表已存在但字段不存在）
        try {
            await db.execute(`ALTER TABLE users ADD COLUMN max_turns INT NULL COMMENT '最大轮次（group1使用）'`);
        } catch (e) {
            // 字段已存在，忽略错误（检查错误代码）
            if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
                console.warn('添加 max_turns 字段时出错:', e.message);
            }
        }
        try {
            await db.execute(`ALTER TABLE users ADD COLUMN target_turns INT NULL COMMENT '目标轮次（group2使用）'`);
        } catch (e) {
            // 字段已存在，忽略错误（检查错误代码）
            if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
                console.warn('添加 target_turns 字段时出错:', e.message);
            }
        }
        try {
            await db.execute(`ALTER TABLE users ADD COLUMN password VARCHAR(100) NULL COMMENT '用户密码'`);
        } catch (e) {
            // 字段已存在，忽略错误（检查错误代码）
            if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
                console.warn('添加 password 字段时出错:', e.message);
            }
        }

        // 2. 会话记录表 (Sessions Table)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                topic_id VARCHAR(50) NOT NULL COMMENT '关联当天的知识点',
                session_date DATE NOT NULL COMMENT '会话日期，用于区分不同日期的数据',
                start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME NULL,
                turn_count INT NOT NULL DEFAULT 0 COMMENT '最终对话轮数',
                is_completed BOOLEAN NOT NULL DEFAULT 0 COMMENT '是否达到了组别的要求',
                satisfaction_score INT NULL COMMENT '1-5星打分',
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_topic_id (topic_id),
                INDEX idx_session_date (session_date),
                INDEX idx_start_time (start_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话记录表'
        `);
        
        // 添加 session_date 字段（如果表已存在但字段不存在）
        try {
            await db.execute(`ALTER TABLE sessions ADD COLUMN session_date DATE NULL COMMENT '会话日期，用于区分不同日期的数据'`);
            // 为已有数据设置默认值（使用 start_time 的日期部分）
            await db.execute(`UPDATE sessions SET session_date = DATE(start_time) WHERE session_date IS NULL OR session_date = '0000-00-00'`);
            // 将字段设置为 NOT NULL（在数据更新后）
            await db.execute(`ALTER TABLE sessions MODIFY COLUMN session_date DATE NOT NULL COMMENT '会话日期，用于区分不同日期的数据'`);
        } catch (e) {
            // 字段已存在，忽略错误（检查错误代码）
            if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
                console.warn('添加 session_date 字段时出错:', e.message);
            }
        }

        // 3. 消息详情表 (Messages Table)
        // 检查表是否存在，如果存在则检查数据量（用于诊断）
        try {
            const existingData = await db.query('SELECT COUNT(*) as count FROM messages');
            const messageCount = existingData[0]?.count || 0;
            if (messageCount > 0) {
                console.log(`[数据库初始化] messages 表已存在，当前有 ${messageCount} 条消息`);
            }
        } catch (e) {
            // 表不存在，这是正常的
        }
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                message_id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                student_id VARCHAR(50) NOT NULL COMMENT '学号，用于快速查询',
                message_date DATE NOT NULL COMMENT '消息日期，用于区分不同日期的数据',
                role ENUM('user', 'ai') NOT NULL COMMENT 'user 或 AI',
                content TEXT NOT NULL COMMENT '实际的对话内容',
                template_id_used VARCHAR(100) NULL COMMENT '记录学生选了哪个prompt模板',
                is_edited BOOLEAN NOT NULL DEFAULT 0 COMMENT '学生是否修改了预设的Prompt模板',
                edit_distance INT NULL COMMENT '修改了多少字符',
                turn_index INT NOT NULL COMMENT '第几轮 (1, 2, 3...)',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                response_time_ms INT NULL COMMENT 'AI生成回复耗时（毫秒）',
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
                INDEX idx_session_id (session_id),
                INDEX idx_student_id (student_id),
                INDEX idx_message_date (message_date),
                INDEX idx_turn_index (turn_index),
                INDEX idx_template_id (template_id_used)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息详情表'
        `);
        
        // 添加 message_date 字段（如果表已存在但字段不存在）
        try {
            await db.execute(`ALTER TABLE messages ADD COLUMN message_date DATE NULL COMMENT '消息日期，用于区分不同日期的数据'`);
            // 为已有数据设置默认值（使用 created_at 的日期部分）
            await db.execute(`UPDATE messages SET message_date = DATE(created_at) WHERE message_date IS NULL OR message_date = '0000-00-00'`);
            // 将字段设置为 NOT NULL（在数据更新后）
            await db.execute(`ALTER TABLE messages MODIFY COLUMN message_date DATE NOT NULL COMMENT '消息日期，用于区分不同日期的数据'`);
        } catch (e) {
            // 字段已存在，忽略错误（检查错误代码）
            if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
                console.warn('添加 message_date 字段时出错:', e.message);
            }
        }
        
        // 添加 student_id 字段（如果表已存在但字段不存在）
        try {
            await db.execute(`ALTER TABLE messages ADD COLUMN student_id VARCHAR(50) NULL COMMENT '学号，用于快速查询'`);
            // 为已有数据设置默认值（通过 JOIN sessions 和 users 表获取）
            await db.execute(`
                UPDATE messages m
                INNER JOIN sessions s ON m.session_id = s.session_id
                INNER JOIN users u ON s.user_id = u.user_id
                SET m.student_id = u.student_id
                WHERE m.student_id IS NULL OR m.student_id = ''
            `);
            // 将字段设置为 NOT NULL（在数据更新后）
            await db.execute(`ALTER TABLE messages MODIFY COLUMN student_id VARCHAR(50) NOT NULL COMMENT '学号，用于快速查询'`);
            // 添加索引
            try {
                await db.execute(`CREATE INDEX idx_student_id ON messages(student_id)`);
            } catch (e) {
                // 索引可能已存在，忽略错误
                if (e.code !== 'ER_DUP_KEYNAME' && e.errno !== 1061) {
                    console.warn('添加 student_id 索引时出错:', e.message);
                }
            }
        } catch (e) {
            // 字段已存在，忽略错误（检查错误代码）
            if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
                console.warn('添加 student_id 字段时出错:', e.message);
            }
        }

        // 4. 行为埋点表 (UI Events / Trace Logs)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ui_events (
                event_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_id INT NULL,
                event_type VARCHAR(50) NOT NULL COMMENT '事件类型',
                event_value TEXT NULL COMMENT '记录细节',
                timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '精确到毫秒',
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_session_id (session_id),
                INDEX idx_event_type (event_type),
                INDEX idx_timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='行为埋点表'
        `);

        // 5. 每日任务配置表 (Daily Topics Config)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS daily_topics (
                day_id INT PRIMARY KEY COMMENT '第几天，e.g., 1, 2, 3...',
                topic_name VARCHAR(100) NOT NULL COMMENT '主题名称，如"C++ Vectors"',
                concept_definition TEXT NOT NULL COMMENT '预设的知识点定义',
                available_templates JSON NULL COMMENT '当天不同group允许使用的模板内容',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_day_id (day_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日任务配置表'
        `);

        // 6. 关键词表 (Keywords Table)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS keywords (
                keyword_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                student_id VARCHAR(50) NOT NULL COMMENT '学号，用于快速查询',
                session_id INT NULL COMMENT '关联的会话ID',
                message_id INT NULL COMMENT '关联的消息ID',
                keyword_text VARCHAR(200) NOT NULL COMMENT '关键词文本',
                keyword_date DATE NOT NULL COMMENT '标记日期',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_student_id (student_id),
                INDEX idx_keyword_date (keyword_date),
                INDEX idx_keyword_text (keyword_text)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关键词表'
        `);

        // 7. 概念墙表 (Concepts Table)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS concepts (
                concept_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                student_id VARCHAR(50) NOT NULL COMMENT '学号，用于快速查询',
                session_id INT NULL COMMENT '关联的会话ID',
                concept_name VARCHAR(200) NOT NULL COMMENT '概念名称',
                concept_date DATE NOT NULL COMMENT '掌握日期',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_student_id (student_id),
                INDEX idx_concept_date (concept_date),
                INDEX idx_concept_name (concept_name),
                UNIQUE KEY uk_user_concept_date (user_id, concept_name, concept_date) COMMENT '同一用户同一天同一概念只记录一次'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='概念墙表'
        `);
    } catch (error) {
        console.error('初始化表失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本，执行初始化
if (require.main === module) {
    initTables()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('数据库初始化失败:', error);
            process.exit(1);
        });
}

module.exports = { initTables };

