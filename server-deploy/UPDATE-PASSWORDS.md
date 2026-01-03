# 更新用户密码操作指南

## 问题说明

CSV文件中的用户密码存储在`pwd`字段中，但数据库中的现有用户可能没有密码或密码不正确。

## 解决方案

### 方法1：使用更新脚本（推荐）

1. 上传文件到服务器后，执行以下命令：

```bash
cd /var/www/ai-teaching-lab
node src/backend/scripts/update-user-passwords.js
```

这个脚本会：
- 读取 `stu_rnd_grp.csv` 文件
- 更新所有现有用户的密码为CSV中的`pwd`字段值

### 方法2：使用SQL命令直接更新

如果CSV文件已经在服务器上，可以直接使用SQL命令：

```bash
mysql -u root -pTeaching2026 ai_teaching_lab <<EOF
-- 首先确保password字段存在
ALTER TABLE users ADD COLUMN password VARCHAR(100) NULL COMMENT '用户密码';

-- 更新所有用户的密码为student_id（如果CSV中pwd字段与student_id相同）
UPDATE users SET password = student_id WHERE password IS NULL OR password = '';

-- 或者，如果CSV文件在服务器上，可以使用LOAD DATA命令
-- 但更简单的方法是重新导入用户数据
EOF
```

### 方法3：重新导入用户数据

由于导入脚本已经更新，会同时更新已存在用户的密码：

```bash
cd /var/www/ai-teaching-lab
node src/backend/scripts/import-users.js
```

## 验证

更新后，可以使用以下命令验证：

```bash
mysql -u root -pTeaching2026 ai_teaching_lab -e "SELECT student_id, password FROM users LIMIT 10;"
```

应该能看到所有用户都有密码了。

## 登录信息

- **用户名**：CSV中的`student_id`字段（例如：`B25051302`）
- **密码**：CSV中的`pwd`字段（通常与`student_id`相同，例如：`B25051302`）

## 注意事项

1. 确保`stu_rnd_grp.csv`文件在服务器上的正确位置：`/var/www/ai-teaching-lab/stu_rnd_grp.csv`
2. 更新密码后，需要重启后端服务：
   ```bash
   pm2 restart ai-teaching-backend
   ```

