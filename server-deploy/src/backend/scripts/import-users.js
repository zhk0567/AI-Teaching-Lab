/**
 * 从CSV文件导入用户到数据库
 * 使用方法: node src/backend/scripts/import-users.js [csv文件路径]
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const Users = require('../models/users');
const { setUserIdMapping } = require('../utils/progress');

/**
 * 解析CSV文件
 */
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const users = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 处理CSV中的逗号（可能出现在name字段中）
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());
        
        if (values.length >= 4) {
            const user = {
                student_id: values[0],
                name: values[1],
                group_code: values[2],
                pwd: values[3]
            };
            users.push(user);
        }
    }
    
    return users;
}

/**
 * 根据Group_Code映射到数据库字段
 */
function mapGroupCode(groupCode) {
    const code = groupCode.toString().trim();
    
    // Group_Code 映射规则：
    // 1 -> group1 (LDLT): condition_depth=0, condition_turns=0, max_turns=2
    // 2 -> group2 (LDHT): condition_depth=0, condition_turns=1, target_turns=6
    // 3 -> group3 (HDLT): condition_depth=1, condition_turns=0
    // 4 -> group4 (HDHT): condition_depth=1, condition_turns=1
    
    const mapping = {
        '1': {
            group_id: '1',
            condition_depth: 0,
            condition_turns: 0,
            max_turns: 2,
            target_turns: null
        },
        '2': {
            group_id: '2',
            condition_depth: 0,
            condition_turns: 1,
            max_turns: null,
            target_turns: 6
        },
        '3': {
            group_id: '3',
            condition_depth: 1,
            condition_turns: 0,
            max_turns: null,
            target_turns: null
        },
        '4': {
            group_id: '4',
            condition_depth: 1,
            condition_turns: 1,
            max_turns: null,
            target_turns: null
        }
    };
    
    return mapping[code] || mapping['1']; // 默认使用group1
}

/**
 * 导入用户
 * @param {string} csvFilePath - CSV文件路径
 * @param {boolean} skipDbInit - 是否跳过数据库连接初始化（如果已经在server.js中初始化过）
 */
async function importUsers(csvFilePath, skipDbInit = false) {
    try {
        // 初始化数据库连接（如果还没有初始化）
        if (!skipDbInit) {
            await db.createPool();
        }
        
        // 解析CSV文件
        console.log(`正在读取CSV文件: ${csvFilePath}`);
        const users = parseCSV(csvFilePath);
        console.log(`找到 ${users.length} 个用户`);
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        // 导入每个用户
        for (const user of users) {
            try {
                // 检查用户是否已存在
                const existingUser = await Users.findByStudentId(user.student_id);
                
                if (existingUser) {
                    // 如果用户已存在，更新密码（使用CSV中的pwd字段）
                    const password = user.pwd || user.student_id;
                    try {
                        await db.execute(
                            'UPDATE users SET password = ? WHERE student_id = ?',
                            [password, user.student_id]
                        );
                        console.log(`✓ 更新已存在用户的密码: ${user.student_id} (${user.name}) -> ${password}`);
                    } catch (error) {
                        console.warn(`更新密码失败: ${user.student_id} (${user.name})`, error.message);
                    }
                    skipCount++;
                    // 更新用户ID映射
                    setUserIdMapping(user.student_id, existingUser.user_id);
                    continue;
                }
                
                // 映射Group_Code到数据库字段
                const groupMapping = mapGroupCode(user.group_code);
                
                // 创建用户
                const userId = await Users.create({
                    student_id: user.student_id,
                    group_id: groupMapping.group_id,
                    condition_depth: groupMapping.condition_depth,
                    condition_turns: groupMapping.condition_turns,
                    consent_agreed: 1, // 默认同意
                    max_turns: groupMapping.max_turns,
                    target_turns: groupMapping.target_turns,
                    password: user.pwd || user.student_id // 使用CSV中的pwd字段作为密码，如果没有则使用student_id
                });
                
                // 设置用户ID映射
                setUserIdMapping(user.student_id, userId);
                
                console.log(`✓ 导入用户: ${user.student_id} (${user.name}) - Group ${user.group_code}`);
                successCount++;
            } catch (error) {
                console.error(`✗ 导入用户失败: ${user.student_id} (${user.name})`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n导入完成:');
        console.log(`  成功: ${successCount}`);
        console.log(`  跳过: ${skipCount}`);
        console.log(`  失败: ${errorCount}`);
        console.log(`  总计: ${users.length}`);
        
    } catch (error) {
        console.error('导入失败:', error);
        process.exit(1);
    } finally {
        // 关闭数据库连接（只有在单独运行时才关闭）
        if (!skipDbInit && db.pool) {
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
        console.log('使用方法: node src/backend/scripts/import-users.js [csv文件路径]');
        process.exit(1);
    }
    
    await importUsers(csvFilePath);
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
}

module.exports = { importUsers, parseCSV, mapGroupCode };

