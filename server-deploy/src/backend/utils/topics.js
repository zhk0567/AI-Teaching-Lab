/**
 * 任务配置工具函数
 * 处理任务配置相关的逻辑
 */

const Topics = require('../models/topics');
const { EXPERIMENT_START_DATE, CYCLE_DAYS } = require('../config/experiment');

/**
 * 获取当天的 day_id（1-7循环）
 * 根据实验开始日期计算当前是第几天，然后对7取模实现7天循环
 * @returns {number} day_id (1-7)
 */
function getCurrentDayId() {
    try {
        // 解析实验开始日期
        const startDate = new Date(EXPERIMENT_START_DATE);
        startDate.setHours(0, 0, 0, 0); // 设置为当天的00:00:00
        
        // 获取当前日期（只考虑日期部分，忽略时间）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 计算天数差
        const diffTime = today.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // 对7取模，得到1-7的循环
        // 处理负数情况：先加CYCLE_DAYS的倍数使其为正，再取模
        let dayId = ((diffDays % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS;
        
        // 转换为1-7的范围（0-6 -> 1-7）
        dayId = dayId + 1;
        
        // 确保dayId在1-7范围内（双重保险）
        if (dayId < 1 || dayId > CYCLE_DAYS) {
            dayId = 1; // 默认值
        }
        
        return dayId;
    } catch (error) {
        console.error('计算day_id失败，使用默认值1:', error);
        return 1; // 出错时返回默认值
    }
}

/**
 * 获取当天的任务配置
 * @returns {Promise<object|null>} 任务配置对象或null
 */
async function getCurrentTopic() {
    const dayId = getCurrentDayId();
    const topic = await Topics.findByDayId(dayId);
    
    if (topic && topic.available_templates) {
        // 解析 JSON 字符串
        if (typeof topic.available_templates === 'string') {
            topic.available_templates = JSON.parse(topic.available_templates);
        }
    }
    
    return topic;
}

/**
 * 获取当天的 topic_id（用于会话关联）
 * @returns {Promise<string>} topic_id
 */
async function getCurrentTopicId() {
    const topic = await getCurrentTopic();
    if (topic) {
        // 使用 day_id 作为 topic_id，格式：day_1, day_2, ...
        return `day_${topic.day_id}`;
    }
    // 如果没有配置，返回默认值
    return 'day_1';
}

module.exports = {
    getCurrentDayId,
    getCurrentTopic,
    getCurrentTopicId
};

