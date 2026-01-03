# AI Teaching Lab (AI教学实验系统)

基于 DeepSeek API 的 AI 教学实验平台，用于研究不同学习策略对学生学习效果的影响。

## 快速开始（本地开发）

### 前置要求
- Python 3.6+
- Node.js 14+
- MySQL 数据库

### 启动
```bash
python start.py
```

启动脚本会自动检查环境、启动后端服务器并打开前端页面。

## 用户导入

### 从CSV文件导入用户

系统提供了从CSV文件批量导入用户的功能。

1. **准备CSV文件**
   - CSV文件格式：`student_id,name,Group_Code,pwd`
   - 示例文件：`stu_rnd_grp.csv`

2. **执行导入脚本**
   ```bash
   # 在项目根目录执行
   node src/backend/scripts/import-users.js [csv文件路径]
   
   # 示例（使用默认路径）
   node src/backend/scripts/import-users.js stu_rnd_grp.csv
   ```

3. **Group_Code 映射规则**
   - `1` → group1 (LDLT): 限制2次，condition_depth=0, condition_turns=0
   - `2` → group2 (LDHT): 目标6次，condition_depth=0, condition_turns=1
   - `3` → group3 (HDLT): condition_depth=1, condition_turns=0
   - `4` → group4 (HDHT): condition_depth=1, condition_turns=1

4. **注意事项**
   - 已存在的用户会被跳过（不会重复导入）
   - 密码默认为学号（student_id）
   - 所有用户默认同意知情同意书（consent_agreed=1）

## 用户导入

### 从CSV文件导入用户

系统提供了从CSV文件批量导入用户的功能。

1. **准备CSV文件**
   - CSV文件格式：`student_id,name,Group_Code,pwd`
   - 示例文件：`stu_rnd_grp.csv`

2. **执行导入脚本**
   ```bash
   # 在项目根目录执行
   node src/backend/scripts/import-users.js [csv文件路径]
   
   # 示例（使用默认路径）
   node src/backend/scripts/import-users.js stu_rnd_grp.csv
   ```

3. **Group_Code 映射规则**
   - `1` → group1 (LDLT): 限制2次，condition_depth=0, condition_turns=0
   - `2` → group2 (LDHT): 目标6次，condition_depth=0, condition_turns=1
   - `3` → group3 (HDLT): condition_depth=1, condition_turns=0
   - `4` → group4 (HDHT): condition_depth=1, condition_turns=1

4. **注意事项**
   - 已存在的用户会被跳过（不会重复导入）
   - 密码默认为学号（student_id）
   - 所有用户默认同意知情同意书（consent_agreed=1）

## 服务器部署

### 服务器信息
- **IP**: 113.47.7.91
- **用户名**: root
- **密码**: Teaching2026
- **数据库密码**: Teaching2026

### 快速部署（推荐）

1. **上传部署文件**
   - 使用 FinalShell 或其他工具上传 `server-deploy/` 文件夹内容到服务器 `/var/www/ai-teaching-lab/`
   - 文件已预配置（数据库密码和 API 地址）

2. **执行部署脚本**
   ```bash
   cd /var/www/ai-teaching-lab
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **修复 MySQL 认证（如需要）**
   ```bash
   sudo mysql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'Teaching2026';
   FLUSH PRIVILEGES;
   EXIT;
   ```

5. **配置华为云安全组**
   - 开放 80 端口（HTTP）
   - 开放 443 端口（HTTPS，可选）

6. **访问系统**
   - 前端页面: http://113.47.7.91/cplus.html
   - 管理员页面: http://113.47.7.91/admin.html

### 部署工具

**server-deploy/** 文件夹包含：
- `deploy.sh` - 自动部署脚本
- `fix.sh` - 快速修复脚本（MySQL、Nginx、后端）
- `test.sh` - 服务测试脚本
- `troubleshooting.md` - 故障排除指南
- `src/` - 预配置的源代码

### 常见问题

**MySQL 认证错误**
- 错误: `Access denied for user 'root'@'localhost'`
- 解决: 参考 `server-deploy/troubleshooting.md` 或运行 `./fix.sh`

**502 Bad Gateway**
- 检查后端服务: `pm2 status`
- 检查 MySQL: `systemctl status mysql`
- 运行修复脚本: `./fix.sh`

**admin.html 404**
- 运行修复脚本: `./fix.sh`（会自动修复 Nginx 配置）

详细故障排除请参考 `server-deploy/troubleshooting.md`

### 服务管理

```bash
# 查看后端状态
pm2 status

# 查看后端日志
pm2 logs ai-teaching-backend

# 重启后端
pm2 restart ai-teaching-backend

# 重启 Nginx
systemctl restart nginx

# 测试服务
./test.sh
```

## 配置

### API Key
编辑 `src/backend/services/chatService.js` 中的 `DEEPSEEK_API_KEY`

### 数据库
编辑 `src/backend/db.js` 中的数据库连接配置

### 端口
默认 3000，修改 `src/backend/server.js` 中的 `PORT`

## 项目结构

```
.
├── start.py                    # 启动脚本
├── deploy.sh                   # 服务器部署脚本（根目录）
├── server-deploy/              # 服务器部署包
│   ├── deploy.sh               # 自动部署脚本
│   ├── fix.sh                  # 快速修复脚本
│   ├── test.sh                 # 测试脚本
│   ├── troubleshooting.md     # 故障排除指南
│   └── src/                    # 预配置的源代码
├── src/
│   ├── frontend/               # 前端（HTML + JavaScript）
│   │   ├── cplus.html          # 主页面
│   │   ├── admin.html          # 管理员页面
│   │   ├── js/                 # JavaScript模块
│   │   │   ├── main.js         # 主逻辑
│   │   │   ├── api.js          # API调用
│   │   │   ├── auth.js         # 认证模块
│   │   │   ├── messages.js     # 消息处理
│   │   │   ├── mechanisms.js   # 实验机制
│   │   │   ├── keywordHighlighter.js  # 关键词划词
│   │   │   ├── accountModal.js  # 账号信息弹窗
│   │   │   ├── tracking.js     # 行为埋点
│   │   │   └── ...             # 其他模块
│   │   └── styles.css          # 样式文件
│   └── backend/                # 后端（Node.js + MySQL）
│       ├── server.js           # 服务器主文件
│       ├── db.js               # 数据库连接
│       ├── init-db.js          # 数据库初始化
│       ├── init-topics.js      # 任务配置初始化
│       ├── routes/              # 路由
│       │   ├── auth.js         # 认证路由
│       │   ├── chat.js         # 聊天路由
│       │   ├── admin.js        # 管理员路由
│       │   ├── keywords.js     # 关键词路由
│       │   ├── concepts.js     # 概念墙路由
│       │   ├── events.js       # 事件埋点路由
│       │   └── topics.js       # 任务配置路由
│       ├── models/             # 数据模型
│       │   ├── users.js        # 用户模型
│       │   ├── sessions.js     # 会话模型
│       │   ├── messages.js     # 消息模型
│       │   ├── keywords.js     # 关键词模型
│       │   ├── concepts.js     # 概念模型
│       │   └── events.js       # 事件模型
│       ├── services/           # 业务服务
│       │   ├── authService.js  # 认证服务
│       │   ├── chatService.js  # 聊天服务
│       │   ├── resetService.js # 重置服务
│       │   └── scheduler.js   # 定时任务
│       └── utils/              # 工具函数
│           ├── auth.js         # 认证工具
│           ├── progress.js     # 进度工具
│           └── topics.js       # 任务配置工具
└── docs/                       # 文档
```

## 功能特性

### 用户端功能

- **双组别实验设计**
  - 组别1：基础概念学习，限制2次对话
  - 组别2：深度探索，目标完成6轮对话

- **AI对话交互**
  - 流式响应（实时打字机效果）
  - 消息验证机制（第一条消息无需验证）
  - 消息操作：复制、刷新、重新生成
  - Markdown渲染和代码高亮

- **学习机制**
  - 查看锁定：AI回复后需查看2.5秒才能继续
  - 关键词划词：类似知乎/番茄小说的划词功能
    - 选中文本后显示自定义任务栏
    - 点击"划词"添加蓝色下划线标记
    - 点击已标记文本可取消标记
    - 所有标记自动保存到数据库
  - 视觉奖励：完成目标后显示奖励动画

- **概念墙与关键词管理**
  - 概念墙：完成任务后自动添加当天的主题到概念墙
  - 关键词列表：显示已标记的关键词
  - 按日期查看：点击日历日期查看该日期的概念和关键词
  - 数据独立：每天的概念和关键词数据独立存储

- **进度管理**
  - 实时进度追踪（轮次/目标）
  - 完成日期日历记录
  - 账号信息查看（支持日期切换）
  - 概念墙和关键词按日期显示

- **每日任务配置**
  - 7天循环任务配置
  - 每天不同的主题和概念定义
  - 动态提示模板

### 管理员功能

- **用户管理**
  - 查看所有用户列表（批量查询优化）
  - 实时显示用户进度和完成状态
  - 用户状态重置（清空当天进度）
  - 手动触发每日重置

- **进度控制**
  - 手动设置用户进度（轮次、完成状态）
  - 设置用户配额（最大轮次/目标轮次）
  - 自动设置完成时间（23:59:59）

- **数据持久化**
  - MySQL数据库存储
  - 会话和消息记录（包含日期字段）
  - 行为埋点追踪（ui_events表）
  - 关键词记录（keywords表，按日期存储）
  - 概念墙记录（concepts表，按日期存储）
  - 每日任务配置（daily_topics表，7天循环）

- **自动化任务**
  - 每日状态重置（每天00:00自动执行）
  - 保留历史数据（通过日期字段区分）
  - 7天任务配置自动循环

## 数据库表结构

系统包含以下数据表：

- **users** - 用户核心表
  - 存储用户基本信息、组别、配额等

- **sessions** - 会话表
  - 存储每日会话信息，包含 `session_date` 字段用于区分不同日期

- **messages** - 消息详情表
  - 存储所有对话消息，包含 `message_date` 和 `student_id` 字段
  - 记录模板使用、编辑状态、响应时间等

- **keywords** - 关键词表
  - 存储用户标记的关键词
  - 包含 `keyword_date` 字段，每天数据独立

- **concepts** - 概念墙表
  - 存储用户掌握的概念（即每天的topic）
  - 包含 `concept_date` 字段，每天数据独立
  - 完成任务后自动添加

- **ui_events** - 行为埋点表
  - 存储用户行为事件（登录、发送消息、划词等）
  - 精确到毫秒的时间戳

- **daily_topics** - 每日任务配置表
  - 存储7天的任务配置（主题、概念定义、提示模板）
  - 支持7天自动循环

## 技术栈

- 前端: HTML5, Tailwind CSS, JavaScript (ES6+)
- 后端: Node.js, MySQL (mysql2/promise)
- AI: DeepSeek Chat API
- 其他: Markdown渲染 (marked.js), 代码高亮 (highlight.js), 图标 (lucide)

## 问题解决记录

系统开发和使用过程中遇到的问题及解决方案，请参考：
- [问题解决记录](docs/issues-resolved.md)

## 许可证

MIT License
