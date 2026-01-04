# AI Teaching Lab (AI教学实验系统)

基于 DeepSeek API 的 AI 教学实验平台，用于研究不同学习策略对学生学习效果的影响。

**最后更新：2026年1月4日**

---

## 快速开始

### 本地开发

**前置要求**
- Python 3.6+
- Node.js 14+
- MySQL 数据库

**启动**
```bash
python start.py
```

启动脚本会自动检查环境、启动后端服务器并打开前端页面。

### 服务器部署

**服务器信息**
- IP: `113.47.7.91`
- 用户名: `root`
- 密码: `Teaching2026`
- 数据库密码: `Teaching2026`

**快速部署**
1. 上传 `server-deploy/` 文件夹内容到服务器 `/var/www/ai-teaching-lab/`
2. 执行部署脚本：
   ```bash
   cd /var/www/ai-teaching-lab
   chmod +x deploy.sh
   ./deploy.sh
   ```
3. 配置华为云安全组：开放 80 端口（HTTP）
4. 访问系统：
   - 前端页面: http://113.47.7.91/cplus.html
   - 管理员页面: http://113.47.7.91/admin.html

**服务管理**
```bash
pm2 status                    # 查看后端状态
pm2 logs ai-teaching-backend  # 查看后端日志
pm2 restart ai-teaching-backend  # 重启后端
systemctl restart nginx       # 重启 Nginx
```

---

## 用户导入

### 从CSV文件导入用户

1. **准备CSV文件**
   - 格式：`student_id,name,Group_Code,pwd`
   - 示例：`stu_rnd_grp.csv`

2. **执行导入**
   ```bash
   node src/backend/scripts/import-users.js stu_rnd_grp.csv
   ```

3. **Group_Code 映射规则**
   - `1` → group1 (LDLT): 限制2次，condition_depth=0, condition_turns=0
   - `2` → group2 (LDHT): 目标6次，condition_depth=0, condition_turns=1
   - `3` → group3 (HDLT): condition_depth=1, condition_turns=0
   - `4` → group4 (HDHT): condition_depth=1, condition_turns=1

4. **注意事项**
   - 已存在的用户会被跳过
   - 密码默认为学号（student_id）
   - 所有用户默认同意知情同意书

---

## 配置

### API Key
编辑 `src/backend/services/chatService.js` 中的 `DEEPSEEK_API_KEY`

### 数据库
编辑 `src/backend/db.js` 中的数据库连接配置

### 端口
默认 3000，修改 `src/backend/server.js` 中的 `PORT`

---

## 核心功能

### 用户端
- **实验设计**：4个实验组（LDLT/LDHT/HDLT/HDHT），不同学习策略
- **AI对话**：流式响应、Markdown渲染、消息操作（复制/刷新/重新生成）
- **学习机制**：
  - 查看锁定：AI回复后需查看2.5秒才能继续
  - 关键词划词：选中文本标记，自动保存到数据库
  - 视觉奖励：完成目标后显示奖励动画
- **概念墙与关键词**：按日期独立存储，完成任务后自动添加概念
- **进度管理**：实时追踪轮次/目标，完成日期日历记录
- **每日任务**：7天循环任务配置，每天不同主题和概念定义

### 管理员端
- **用户管理**：查看用户列表、进度、完成状态
- **进度控制**：手动设置进度、配额、完成时间
- **数据重置**：用户状态重置、手动触发每日重置
- **自动化**：每日00:00自动重置，保留历史数据

---

## 数据库表结构

- **users** - 用户核心表（基本信息、组别、配额）
- **sessions** - 会话表（包含 `session_date` 字段）
- **messages** - 消息详情表（包含 `message_date` 字段）
- **keywords** - 关键词表（包含 `keyword_date` 字段，每天数据独立）
- **concepts** - 概念墙表（包含 `concept_date` 字段，每天数据独立）
- **ui_events** - 行为埋点表（精确到毫秒的时间戳）
- **daily_topics** - 每日任务配置表（7天循环）

---

## 项目结构

```
.
├── start.py                    # 启动脚本
├── server-deploy/              # 服务器部署包
│   ├── deploy.sh               # 自动部署脚本
│   ├── fix.sh                  # 快速修复脚本
│   ├── test.sh                 # 测试脚本
│   └── src/                    # 预配置的源代码
├── src/
│   ├── frontend/               # 前端（HTML + JavaScript）
│   │   ├── cplus.html          # 主页面
│   │   ├── admin.html          # 管理员页面
│   │   ├── js/                 # JavaScript模块
│   │   └── styles.css          # 样式文件
│   └── backend/                # 后端（Node.js + MySQL）
│       ├── server.js           # 服务器主文件
│       ├── db.js               # 数据库连接
│       ├── routes/             # 路由
│       ├── models/             # 数据模型
│       ├── services/           # 业务服务
│       └── utils/              # 工具函数
└── docs/                       # 文档（已精简）
```

---

## 技术栈

- **前端**: HTML5, Tailwind CSS, JavaScript (ES6+)
- **后端**: Node.js, MySQL (mysql2/promise)
- **AI**: DeepSeek Chat API
- **其他**: Markdown渲染 (marked.js), 代码高亮 (highlight.js), 图标 (lucide)

---

## 常见问题

**MySQL 认证错误**
- 错误: `Access denied for user 'root'@'localhost'`
- 解决: 运行 `./fix.sh` 或手动修复：
  ```bash
  sudo mysql
  ALTER USER 'root'@'localhost' IDENTIFIED BY 'Teaching2026';
  FLUSH PRIVILEGES;
  ```

**502 Bad Gateway**
- 检查后端: `pm2 status`
- 检查 MySQL: `systemctl status mysql`
- 运行修复: `./fix.sh`

**admin.html 404**
- 运行修复脚本: `./fix.sh`（会自动修复 Nginx 配置）

---

## 许可证

MIT License
