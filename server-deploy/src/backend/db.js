/**
 * 数据库连接模块
 * 负责MySQL数据库的连接和初始化
 */

const mysql = require('mysql2/promise');

// 数据库配置
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: 'Teaching2026',
    database: null, // 首次连接时不指定数据库，用于创建数据库
    charset: 'utf8mb4'
};

let pool = null;

/**
 * 创建数据库连接池（不指定数据库，用于创建数据库）
 */
async function createConnectionWithoutDB() {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('创建数据库连接超时(5秒)')), 5000)
    );
    
    return Promise.race([
        mysql.createConnection({
            host: DB_CONFIG.host,
            user: DB_CONFIG.user,
            password: DB_CONFIG.password,
            charset: DB_CONFIG.charset,
            connectTimeout: 5000  // 5秒连接超时
        }),
        timeoutPromise
    ]);
}

/**
 * 初始化数据库（如果不存在则创建）
 */
async function initDatabase() {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('初始化数据库超时(5秒)')), 5000)
    );
    
    const connection = await createConnectionWithoutDB();
    
    try {
        // 创建数据库（如果不存在）
        await Promise.race([
            connection.execute(`CREATE DATABASE IF NOT EXISTS ai_teaching_lab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`),
            timeoutPromise
        ]);
    } catch (error) {
        console.error('创建数据库失败:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// 防止并发创建连接池
let isCreatingPool = false;
let poolCreationPromise = null;

/**
 * 创建数据库连接池（带重试机制）
 */
async function createPool() {
    if (pool) {
        return pool;
    }
    
    // 如果正在创建，等待同一个Promise
    if (isCreatingPool && poolCreationPromise) {
        return poolCreationPromise;
    }

    isCreatingPool = true;
    poolCreationPromise = (async () => {
        const maxRetries = 5;
        const retryDelay = 2000; // 2秒
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 先初始化数据库
                await initDatabase();

                // 创建连接池
                // 优化配置：减少连接数，设置队列限制，禁用keepAlive，确保查询完成后立即释放
                pool = mysql.createPool({
                    host: DB_CONFIG.host,
                    user: DB_CONFIG.user,
                    password: DB_CONFIG.password,
                    database: 'ai_teaching_lab',
                    charset: DB_CONFIG.charset,
                    waitForConnections: true,
                    connectionLimit: 5,  // 减少连接数，避免过多连接
                    queueLimit: 10,     // 设置队列限制，避免无限等待
                    enableKeepAlive: false  // 禁用keepAlive，查询完成后立即释放连接
                });
                
                // 测试连接是否可用
                const testConnection = await pool.getConnection();
                await testConnection.ping();
                testConnection.release();
                
                console.log('数据库连接池创建成功');
                
                // 监听连接错误
                pool.on('error', (err) => {
                    console.error('数据库连接池错误:', err);
                    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                        console.error('数据库连接丢失，需要重启服务器');
                        pool = null;
                        isCreatingPool = false;
                        poolCreationPromise = null;
                    }
                });
                
                // 监听连接获取和释放（用于监控）
                pool.on('acquire', (connection) => {
                    // 连接被获取
                });
                
                pool.on('release', (connection) => {
                    // 连接被释放（查询完成后自动释放）
                });

                return pool;
            } catch (error) {
                if (error.code === 'ECONNREFUSED' && attempt < maxRetries) {
                    console.warn(`数据库连接失败 (尝试 ${attempt}/${maxRetries})，${retryDelay/1000}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                console.error('创建连接池失败:', error);
                pool = null;
                isCreatingPool = false;
                poolCreationPromise = null;
                throw error;
            }
        }
        
        // 如果所有重试都失败
        throw new Error(`数据库连接失败，已重试 ${maxRetries} 次`);
    })();
    
    return poolCreationPromise;
}

/**
 * 获取数据库连接池
 */
async function getPool() {
    if (!pool) {
        await createPool();
    }
    return pool;
}

/**
 * 执行SQL查询（1秒超时，查询完成后立即释放连接）
 * 注意：pool.execute() 会自动管理连接，查询完成后立即释放
 */
async function query(sql, params = []) {
    const pool = await getPool();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`数据库查询超时(1秒): ${sql.substring(0, 50)}...`)), 1000)
    );
    
    try {
        // pool.execute() 会自动获取和释放连接，查询完成后立即释放
        const [rows] = await Promise.race([
            pool.execute(sql, params),
            timeoutPromise
        ]);
        return rows;
    } catch (error) {
        const totalTime = Date.now() - queryStartTime;
        console.error(`[数据库] 查询失败，总耗时: ${totalTime}ms`, error);
        console.error('SQL:', sql);
        console.error('参数:', params);
        throw error;
    }
}

/**
 * 执行SQL更新（INSERT, UPDATE, DELETE）（1秒超时，查询完成后立即释放连接）
 * 注意：pool.execute() 会自动管理连接，查询完成后立即释放
 */
async function execute(sql, params = []) {
    const pool = await getPool();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`数据库更新超时(1秒): ${sql.substring(0, 50)}...`)), 1000)
    );
    
    try {
        // pool.execute() 会自动获取和释放连接，查询完成后立即释放
        const [result] = await Promise.race([
            pool.execute(sql, params),
            timeoutPromise
        ]);
        return result;
    } catch (error) {
        // 如果是已知的重复字段错误，不输出错误日志（由调用者处理）
        if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) {
            throw error;  // 仍然抛出，让调用者决定如何处理
        }
        console.error('数据库更新失败:', error);
        console.error('SQL:', sql);
        console.error('参数:', params);
        throw error;
    }
}

/**
 * 关闭数据库连接
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = {
    createPool,
    getPool,
    query,
    execute,
    close
};

