/**
 * 更新现有用户的密码
 * 从CSV文件读取密码并更新到数据库
 * 使用方法: node src/backend/scripts/update-user-passwords.js [csv文件路径]
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const { parseCSV } = require('./import-users');

/**
 * 更新用户密码
 * @param {string} csvFilePath - CSV文件路径
 */
async function updateUserPasswords(csvFilePath) {
    try {
        // 初始化数据库连接
        await db.createPool();
        
        // 解析CSV文件
        console.log(`正在读取CSV文件: ${csvFilePath}`);
        const users = parseCSV(csvFilePath);
        console.log(`找到 ${users.length} 个用户`);
        
        let successCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;
        
        // 更新每个用户的密码
        for (const user of users) {
            try {
                // 查找用户
                const rows = await db.query(
                    'SELECT user_id, student_id FROM users WHERE student_id = ?',
                    [user.student_id]
                );
                
                if (rows.length === 0) {
                    console.log(`用户不存在: ${user.student_id} (${user.name})`);
                    notFoundCount++;
                    continue;
                }
                
                // 更新密码（使用CSV中的pwd字段，如果没有则使用student_id）
                const password = user.pwd || user.student_id;
                await db.execute(
                    'UPDATE users SET password = ? WHERE student_id = ?',
                    [password, user.student_id]
                );
                
                console.log(`✓ 更新密码: ${user.student_id} (${user.name}) -> ${password}`);
                successCount++;
            } catch (error) {
                console.error(`✗ 更新密码失败: ${user.student_id} (${user.name})`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n更新完成:');
        console.log(`  成功: ${successCount}`);
        console.log(`  未找到: ${notFoundCount}`);
        console.log(`  失败: ${errorCount}`);
        console.log(`  总计: ${users.length}`);
        
    } catch (error) {
        console.error('更新失败:', error);
        process.exit(1);
    } finally {
        // 关闭数据库连接
        if (db.pool) {
            await db.pool.end();
        }
    }
}

// 主函数
async function main() {
    // 获取CSV文件路径
    const csvFilePath = process.argv[2] || path.join(__dirname, '../../stu_rnd_grp.csv');
    
    // 检查文件是否存在
    if (!fs.existsSync(csvFilePath)) {
        console.error(`错误: CSV文件不存在: ${csvFilePath}`);
        console.log('使用方法: node src/backend/scripts/update-user-passwords.js [csv文件路径]');
        process.exit(1);
    }
    
    await updateUserPasswords(csvFilePath);
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
}

module.exports = { updateUserPasswords };

