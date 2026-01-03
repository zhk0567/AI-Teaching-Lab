# 数据库查询指南

## 连接数据库

### 在服务器上连接 MySQL

```bash
# 使用密码连接
mysql -u root -pTeaching2026

# 或者交互式输入密码
mysql -u root -p
# 然后输入密码: Teaching2026
```

### 选择数据库

```sql
USE ai_teaching_lab;
```

---

## 数据库基本信息

- **数据库名**: `ai_teaching_lab`
- **字符集**: `utf8mb4`
- **排序规则**: `utf8mb4_unicode_ci`

---

## 查看数据库和表

### 查看所有数据库

```sql
SHOW DATABASES;
```

### 查看当前数据库的所有表

```sql
SHOW TABLES;
```

### 查看表结构

```sql
-- 查看表结构
DESCRIBE users;
-- 或
DESC users;

-- 查看完整的建表语句
SHOW CREATE TABLE users;
```

---

## 数据表说明

### 1. users - 用户核心表

存储用户基本信息、组别、配额等。

**字段说明**:
- `user_id`: 用户ID（主键，自增）
- `student_id`: 学号（唯一）
- `group_id`: 组别（'1'=LDLT, '2'=LDHT, '3'=HDLT, '4'=HDHT）
- `condition_depth`: 深度条件（0=Low, 1=High）
- `condition_turns`: 轮次条件（0=Low, 1=High）
- `consent_agreed`: 是否同意知情同意书
- `max_turns`: 最大轮次（group1使用）
- `target_turns`: 目标轮次（group2使用）
- `created_at`: 创建时间

**常用查询**:

```sql
-- 查看所有用户
SELECT * FROM users;

-- 查看特定学号的用户
SELECT * FROM users WHERE student_id = '2021001';

-- 查看组别1的所有用户
SELECT * FROM users WHERE group_id = '1';

-- 统计各组别用户数量
SELECT group_id, COUNT(*) as count FROM users GROUP BY group_id;

-- 查看用户及其配额信息
SELECT student_id, group_id, max_turns, target_turns, created_at 
FROM users 
ORDER BY created_at DESC;
```

---

### 2. sessions - 会话记录表

存储每日会话信息，包含日期字段用于区分不同日期。

**字段说明**:
- `session_id`: 会话ID（主键，自增）
- `user_id`: 用户ID（外键）
- `topic_id`: 关联当天的知识点
- `session_date`: 会话日期（重要：用于区分不同日期的数据）
- `start_time`: 开始时间
- `end_time`: 结束时间
- `turn_count`: 最终对话轮数
- `is_completed`: 是否达到了组别的要求
- `satisfaction_score`: 满意度评分（1-5星）

**常用查询**:

```sql
-- 查看所有会话
SELECT * FROM sessions ORDER BY start_time DESC;

-- 查看特定用户的会话
SELECT * FROM sessions WHERE user_id = 1 ORDER BY session_date DESC;

-- 查看特定日期的会话
SELECT * FROM sessions WHERE session_date = '2024-01-15';

-- 查看完成的会话
SELECT * FROM sessions WHERE is_completed = 1;

-- 统计每日会话数量
SELECT session_date, COUNT(*) as count 
FROM sessions 
GROUP BY session_date 
ORDER BY session_date DESC;

-- 查看用户会话详情（关联用户表）
SELECT 
    s.session_id,
    u.student_id,
    s.session_date,
    s.turn_count,
    s.is_completed,
    s.satisfaction_score
FROM sessions s
JOIN users u ON s.user_id = u.user_id
ORDER BY s.start_time DESC;
```

---

### 3. messages - 消息详情表

存储所有对话消息，包含日期字段。

**字段说明**:
- `message_id`: 消息ID（主键，自增）
- `session_id`: 会话ID（外键）
- `user_id`: 用户ID（外键）
- `student_id`: 学号（用于快速查询）
- `message_date`: 消息日期
- `role`: 角色（'user' 或 'assistant'）
- `content`: 消息内容
- `turn_number`: 轮次编号
- `used_template`: 是否使用了模板
- `template_content`: 模板内容
- `is_edited`: 是否被编辑
- `response_time_ms`: 响应时间（毫秒）
- `created_at`: 创建时间

**常用查询**:

```sql
-- 查看所有消息
SELECT * FROM messages ORDER BY created_at DESC LIMIT 100;

-- 查看特定会话的所有消息
SELECT * FROM messages WHERE session_id = 1 ORDER BY turn_number, created_at;

-- 查看特定日期的消息
SELECT * FROM messages WHERE message_date = '2024-01-15';

-- 查看用户的所有消息
SELECT * FROM messages WHERE student_id = '2021001' ORDER BY created_at DESC;

-- 统计每日消息数量
SELECT message_date, COUNT(*) as count 
FROM messages 
GROUP BY message_date 
ORDER BY message_date DESC;

-- 查看对话记录（按会话和轮次排序）
SELECT 
    m.message_id,
    m.role,
    m.content,
    m.turn_number,
    m.created_at,
    u.student_id
FROM messages m
JOIN users u ON m.user_id = u.user_id
WHERE m.session_id = 1
ORDER BY m.turn_number, m.created_at;
```

---

### 4. keywords - 关键词表

存储用户标记的关键词，按日期存储。

**字段说明**:
- `keyword_id`: 关键词ID（主键，自增）
- `user_id`: 用户ID（外键）
- `student_id`: 学号
- `session_id`: 关联的会话ID
- `message_id`: 关联的消息ID
- `keyword_text`: 关键词文本
- `keyword_date`: 标记日期
- `created_at`: 创建时间

**常用查询**:

```sql
-- 查看所有关键词
SELECT * FROM keywords ORDER BY created_at DESC;

-- 查看特定用户的关键词
SELECT * FROM keywords WHERE student_id = '2021001' ORDER BY keyword_date DESC;

-- 查看特定日期的关键词
SELECT * FROM keywords WHERE keyword_date = '2024-01-15';

-- 统计每个用户的关键词数量
SELECT student_id, COUNT(*) as keyword_count 
FROM keywords 
GROUP BY student_id 
ORDER BY keyword_count DESC;

-- 查看最常标记的关键词
SELECT keyword_text, COUNT(*) as count 
FROM keywords 
GROUP BY keyword_text 
ORDER BY count DESC 
LIMIT 20;

-- 查看用户的关键词（关联用户信息）
SELECT 
    k.keyword_text,
    k.keyword_date,
    k.created_at,
    u.student_id,
    u.group_id
FROM keywords k
JOIN users u ON k.user_id = u.user_id
WHERE k.student_id = '2021001'
ORDER BY k.keyword_date DESC;
```

---

### 5. concepts - 概念墙表

存储用户掌握的概念（即每天的topic），按日期存储。

**字段说明**:
- `concept_id`: 概念ID（主键，自增）
- `user_id`: 用户ID（外键）
- `student_id`: 学号
- `session_id`: 关联的会话ID
- `concept_name`: 概念名称
- `concept_date`: 掌握日期
- `created_at`: 创建时间

**常用查询**:

```sql
-- 查看所有概念
SELECT * FROM concepts ORDER BY concept_date DESC;

-- 查看特定用户的概念
SELECT * FROM concepts WHERE student_id = '2021001' ORDER BY concept_date DESC;

-- 查看特定日期的概念
SELECT * FROM concepts WHERE concept_date = '2024-01-15';

-- 统计每个用户掌握的概念数量
SELECT student_id, COUNT(*) as concept_count 
FROM concepts 
GROUP BY student_id 
ORDER BY concept_count DESC;

-- 查看所有掌握的概念（去重）
SELECT DISTINCT concept_name FROM concepts ORDER BY concept_name;

-- 查看用户的概念墙（关联用户信息）
SELECT 
    c.concept_name,
    c.concept_date,
    c.created_at,
    u.student_id,
    u.group_id
FROM concepts c
JOIN users u ON c.user_id = u.user_id
WHERE c.student_id = '2021001'
ORDER BY c.concept_date DESC;
```

---

### 6. ui_events - 行为埋点表

存储用户行为事件（登录、发送消息、划词等）。

**字段说明**:
- `event_id`: 事件ID（主键，自增）
- `user_id`: 用户ID（外键）
- `student_id`: 学号
- `event_type`: 事件类型（如 'login', 'send_message', 'highlight_keyword' 等）
- `event_data`: 事件数据（JSON格式）
- `timestamp`: 时间戳（精确到毫秒）
- `created_at`: 创建时间

**常用查询**:

```sql
-- 查看所有事件
SELECT * FROM ui_events ORDER BY timestamp DESC LIMIT 100;

-- 查看特定用户的事件
SELECT * FROM ui_events WHERE student_id = '2021001' ORDER BY timestamp DESC;

-- 查看特定类型的事件
SELECT * FROM ui_events WHERE event_type = 'login' ORDER BY timestamp DESC;

-- 统计各类型事件数量
SELECT event_type, COUNT(*) as count 
FROM ui_events 
GROUP BY event_type 
ORDER BY count DESC;

-- 查看用户的行为轨迹
SELECT 
    event_type,
    event_data,
    timestamp,
    student_id
FROM ui_events
WHERE student_id = '2021001'
ORDER BY timestamp ASC;
```

---

### 7. daily_topics - 每日任务配置表

存储7天的任务配置（主题、概念定义、提示模板），支持7天自动循环。

**字段说明**:
- `topic_id`: 主题ID（主键）
- `day_number`: 天数（1-7，循环使用）
- `topic_name`: 主题名称
- `concept_definition`: 概念定义
- `prompt_template`: 提示模板
- `created_at`: 创建时间
- `updated_at`: 更新时间

**常用查询**:

```sql
-- 查看所有任务配置
SELECT * FROM daily_topics ORDER BY day_number;

-- 查看特定天数的配置
SELECT * FROM daily_topics WHERE day_number = 1;

-- 查看当前应该使用的配置（根据日期计算）
SELECT * FROM daily_topics 
WHERE day_number = (DAYOFWEEK(CURDATE()) - 1) % 7 + 1;
```

---

## 综合查询示例

### 1. 查看用户的完整学习记录

```sql
SELECT 
    u.student_id,
    u.group_id,
    s.session_date,
    s.turn_count,
    s.is_completed,
    COUNT(DISTINCT k.keyword_id) as keyword_count,
    COUNT(DISTINCT c.concept_id) as concept_count
FROM users u
LEFT JOIN sessions s ON u.user_id = s.user_id
LEFT JOIN keywords k ON u.user_id = k.user_id AND s.session_date = k.keyword_date
LEFT JOIN concepts c ON u.user_id = c.user_id AND s.session_date = c.concept_date
WHERE u.student_id = '2021001'
GROUP BY u.user_id, s.session_id
ORDER BY s.session_date DESC;
```

### 2. 统计每日活跃用户

```sql
SELECT 
    session_date,
    COUNT(DISTINCT user_id) as active_users,
    SUM(turn_count) as total_turns,
    SUM(is_completed) as completed_sessions
FROM sessions
GROUP BY session_date
ORDER BY session_date DESC;
```

### 3. 查看用户的学习进度

```sql
SELECT 
    u.student_id,
    u.group_id,
    COUNT(DISTINCT s.session_id) as total_sessions,
    SUM(s.is_completed) as completed_sessions,
    SUM(s.turn_count) as total_turns,
    COUNT(DISTINCT k.keyword_id) as total_keywords,
    COUNT(DISTINCT c.concept_id) as total_concepts
FROM users u
LEFT JOIN sessions s ON u.user_id = s.user_id
LEFT JOIN keywords k ON u.user_id = k.user_id
LEFT JOIN concepts c ON u.user_id = c.user_id
GROUP BY u.user_id
ORDER BY total_sessions DESC;
```

### 4. 查看特定日期的所有数据

```sql
-- 查看2024-01-15的所有数据
SET @target_date = '2024-01-15';

-- 会话
SELECT * FROM sessions WHERE session_date = @target_date;

-- 消息
SELECT * FROM messages WHERE message_date = @target_date;

-- 关键词
SELECT * FROM keywords WHERE keyword_date = @target_date;

-- 概念
SELECT * FROM concepts WHERE concept_date = @target_date;
```

---

## 数据导出

### 导出为 CSV

```sql
-- 导出用户数据
SELECT * FROM users 
INTO OUTFILE '/tmp/users.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- 导出会话数据
SELECT * FROM sessions 
INTO OUTFILE '/tmp/sessions.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

### 导出查询结果

```bash
# 在命令行中导出
mysql -u root -pTeaching2026 ai_teaching_lab -e "SELECT * FROM users;" > users.csv
```

---

## 常用管理命令

### 查看数据库大小

```sql
SELECT 
    table_schema AS '数据库',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS '大小(MB)'
FROM information_schema.tables
WHERE table_schema = 'ai_teaching_lab'
GROUP BY table_schema;
```

### 查看表大小

```sql
SELECT 
    table_name AS '表名',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS '大小(MB)'
FROM information_schema.tables
WHERE table_schema = 'ai_teaching_lab'
ORDER BY (data_length + index_length) DESC;
```

### 查看表的行数

```sql
SELECT 
    'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'keywords', COUNT(*) FROM keywords
UNION ALL
SELECT 'concepts', COUNT(*) FROM concepts
UNION ALL
SELECT 'ui_events', COUNT(*) FROM ui_events
UNION ALL
SELECT 'daily_topics', COUNT(*) FROM daily_topics;
```

---

## 注意事项

1. **日期字段很重要**: `session_date`, `message_date`, `keyword_date`, `concept_date` 用于区分不同日期的数据，查询时注意使用正确的日期字段。

2. **外键关系**: 
   - `sessions.user_id` → `users.user_id`
   - `messages.session_id` → `sessions.session_id`
   - `keywords.user_id` → `users.user_id`
   - `concepts.user_id` → `users.user_id`

3. **索引优化**: 常用查询字段已建立索引，查询时尽量使用索引字段（如 `student_id`, `session_date`）。

4. **数据备份**: 定期备份数据库：
   ```bash
   mysqldump -u root -pTeaching2026 ai_teaching_lab > backup_$(date +%Y%m%d).sql
   ```

---

## 快速参考

```bash
# 连接数据库
mysql -u root -pTeaching2026

# 在MySQL中
USE ai_teaching_lab;
SHOW TABLES;
DESC users;
SELECT * FROM users LIMIT 10;
```

