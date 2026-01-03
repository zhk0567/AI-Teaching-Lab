/**
 * 每日任务配置模型
 * 处理每日主题相关的数据库操作
 */

const db = require('../db');

const Topics = {
    /**
     * 根据day_id获取主题配置
     */
    async findByDayId(dayId) {
        const rows = await db.query(
            'SELECT * FROM daily_topics WHERE day_id = ?',
            [dayId]
        );
        return rows[0] || null;
    },

    /**
     * 创建或更新主题配置
     */
    async upsert(topicData) {
        const existing = await this.findByDayId(topicData.day_id);
        
        if (existing) {
            // 更新
            await db.execute(
                `UPDATE daily_topics 
                 SET topic_name = ?, concept_definition = ?, available_templates = ?
                 WHERE day_id = ?`,
                [
                    topicData.topic_name,
                    topicData.concept_definition,
                    JSON.stringify(topicData.available_templates || {}),
                    topicData.day_id
                ]
            );
            return existing.day_id;
        } else {
            // 创建
            const result = await db.execute(
                `INSERT INTO daily_topics (day_id, topic_name, concept_definition, available_templates)
                 VALUES (?, ?, ?, ?)`,
                [
                    topicData.day_id,
                    topicData.topic_name,
                    topicData.concept_definition,
                    JSON.stringify(topicData.available_templates || {})
                ]
            );
            return topicData.day_id;
        }
    },

    /**
     * 获取所有主题
     */
    async findAll() {
        return await db.query('SELECT * FROM daily_topics ORDER BY day_id ASC');
    }
};

module.exports = Topics;

