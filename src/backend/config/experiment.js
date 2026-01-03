/**
 * 实验配置
 * 定义实验相关的全局配置
 */

/**
 * 实验开始日期
 * 格式：YYYY-MM-DD
 * 从这一天开始计算第几天，然后对7取模实现7天循环
 */
const EXPERIMENT_START_DATE = '2024-01-01'; // 可以修改为实际的实验开始日期

/**
 * 任务循环天数
 */
const CYCLE_DAYS = 7;

module.exports = {
    EXPERIMENT_START_DATE,
    CYCLE_DAYS
};

