/**
 * 定时任务调度器
 * 负责管理所有定时任务
 */

const resetService = require('./resetService');

// 存储定时器引用
let dailyResetTimer = null;

/**
 * 计算到下一个重置时间的毫秒数
 * 默认每天 00:00:00 执行重置
 * @param {number} hour - 小时 (0-23)，默认 0
 * @param {number} minute - 分钟 (0-59)，默认 0
 * @returns {number} 毫秒数
 */
function getMillisecondsUntilReset(hour = 0, minute = 0) {
    const now = new Date();
    const resetTime = new Date();
    
    // 设置重置时间为今天的指定时间
    resetTime.setHours(hour, minute, 0, 0);
    
    // 如果已经过了今天的重置时间，设置为明天的重置时间
    if (resetTime <= now) {
        resetTime.setDate(resetTime.getDate() + 1);
    }
    
    return resetTime.getTime() - now.getTime();
}

/**
 * 启动每日重置任务
 * @param {number} hour - 重置时间（小时），默认 0（午夜）
 * @param {number} minute - 重置时间（分钟），默认 0
 */
function startDailyReset(hour = 0, minute = 0) {
    // 如果已经有定时器在运行，先清除
    if (dailyResetTimer) {
        clearTimeout(dailyResetTimer);
        dailyResetTimer = null;
    }

    console.log(`[定时任务] 启动每日重置任务，将在每天 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} 执行`);

    /**
     * 执行重置并安排下一次重置
     */
    async function scheduleNextReset() {
        try {
            // 执行重置
            console.log(`[定时任务] ${new Date().toLocaleString('zh-CN')} - 开始执行每日重置...`);
            const result = await resetService.resetAllUsersStatus();
            
            if (result.success) {
                console.log(`[定时任务] 每日重置成功！重置了 ${result.resetCount} 个会话`);
            } else {
                console.error(`[定时任务] 每日重置失败:`, result.error);
            }
        } catch (error) {
            console.error('[定时任务] 执行每日重置时发生错误:', error);
        }

        // 安排下一次重置（24小时后）
        const msUntilNext = getMillisecondsUntilReset(hour, minute);
        dailyResetTimer = setTimeout(scheduleNextReset, msUntilNext);
        
        const nextResetTime = new Date(Date.now() + msUntilNext);
        console.log(`[定时任务] 下次重置时间: ${nextResetTime.toLocaleString('zh-CN')}`);
    }

    // 计算到第一次重置的时间
    const msUntilFirst = getMillisecondsUntilReset(hour, minute);
    dailyResetTimer = setTimeout(scheduleNextReset, msUntilFirst);
    
    const firstResetTime = new Date(Date.now() + msUntilFirst);
    console.log(`[定时任务] 首次重置时间: ${firstResetTime.toLocaleString('zh-CN')}`);
}

/**
 * 停止每日重置任务
 */
function stopDailyReset() {
    if (dailyResetTimer) {
        clearTimeout(dailyResetTimer);
        dailyResetTimer = null;
        console.log('[定时任务] 已停止每日重置任务');
    }
}

/**
 * 立即执行一次重置（用于测试或手动触发）
 */
async function executeResetNow() {
    console.log('[定时任务] 手动触发立即重置...');
    return await resetService.resetAllUsersStatus();
}

module.exports = {
    startDailyReset,
    stopDailyReset,
    executeResetNow
};

