# AI Teaching Lab (AI教学实验系统)

基于 DeepSeek API 的 AI 教学实验平台，用于研究不同学习策略对学生学习效果的影响。

## 快速开始

### 前置要求
- Python 3.6+
- Node.js 14+
- MySQL 数据库

### 启动
```bash
python start.py
```

启动脚本会自动检查环境、启动后端服务器并打开前端页面。

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
├── start.py              # 启动脚本
├── src/
│   ├── frontend/         # 前端（HTML + JavaScript）
│   └── backend/          # 后端（Node.js + MySQL）
└── docs/                 # 文档
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
  - 高亮任务：特定轮次触发关键词选择任务
  - 视觉奖励：完成目标后显示奖励动画

- **进度管理**
  - 实时进度追踪（轮次/目标）
  - 完成日期日历记录
  - 账号信息查看

### 管理员功能

- **用户管理**
  - 查看所有用户列表
  - 实时显示用户进度和完成状态
  - 用户状态重置（清空当天进度）

- **进度控制**
  - 手动设置用户进度（轮次、完成状态）
  - 设置用户配额（最大轮次/目标轮次）
  - 自动设置完成时间（23:59:59）

- **数据持久化**
  - MySQL数据库存储
  - 会话和消息记录
  - 行为埋点追踪

## 技术栈

- 前端: HTML5, Tailwind CSS, JavaScript (ES6+)
- 后端: Node.js, MySQL
- AI: DeepSeek Chat API

## 许可证

MIT License
