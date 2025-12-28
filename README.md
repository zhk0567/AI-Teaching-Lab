# AI Teaching Lab (AI教学实验系统)

## 项目简介

基于 DeepSeek API 的 AI 教学实验平台，用于研究不同学习策略对学生学习效果的影响。系统支持两种实验组别，具有完整的交互机制和视觉反馈。

## 快速开始

### 前置要求

- **Python 3.6+** （用于启动脚本）
- **Node.js 14+** （用于后端服务器）
- 现代浏览器（Chrome、Edge、Firefox 等）

### 一键启动

**Windows:**
```powershell
python start.py
```

**Linux/Mac:**
```bash
python3 start.py
```

启动脚本会自动：
1. 检查 Node.js 是否已安装
2. 检查端口 3000 是否可用
3. 启动后端服务器
4. 自动打开前端页面

### 使用说明

1. **选择实验组别**
   - 在页面顶部选择组别 1 或组别 2
   - 组别 1: 基础概念学习，限制 2 次对话
   - 组别 2: 深度探索，目标完成 6 轮对话

2. **开始对话**
   - 点击左侧的 "开始学习定义" 按钮
   - 等待 AI 回复（流式输出，有打字机效果）

3. **继续对话**
   - AI 回复后，点击回复中的任意位置以解锁下一步（组别 2）
   - 从左侧选择新的 Prompt 选项继续对话

4. **完成目标**
   - 组别 1: 完成 2 次对话后自动锁定
   - 组别 2: 完成 6 轮对话后显示完成奖励

## 项目结构

```
.
├── start.py              # 启动脚本（唯一入口）
├── README.md             # 项目文档
├── src/
│   ├── frontend/         # 前端
│   │   ├── cplus.html    # 主页面
│   │   ├── styles.css   # 样式
│   │   └── js/           # JavaScript模块
│   └── backend/          # 后端
│       └── server.js     # 服务器
└── docs/                 # 文档和设计参考
```

## 功能特性

- 双组别实验设计（组别1: 限制2次 / 组别2: 目标6轮）
- 流式AI响应（打字机效果）
- 解锁机制（机制A: 查看锁定 / 机制B: 高亮任务）
- 视觉奖励系统（机制C: 概念墙）
- 可拖动面板调整
- Markdown渲染和代码高亮

## 技术栈

- 前端: HTML5, Tailwind CSS, Lucide Icons, Marked.js, Highlight.js
- 后端: Node.js
- AI: DeepSeek Chat API

## 配置

### API Key
编辑 `src/backend/server.js` 中的 `DEEPSEEK_API_KEY`

### 端口
默认 3000，修改 `src/backend/server.js` 和 `start.py` 中的端口配置

## 故障排除

- **找不到 Python/Node.js**: 确保已安装并添加到 PATH
- **端口被占用**: 修改端口配置或关闭占用程序
- **API 调用失败**: 检查 API Key 和网络连接

## 开发规范

- 文件大小：单个代码文件不超过500行
- 代码规范：遵循PEP 8（Python）和阿里规范（JavaScript）
- 代码复用：全面实现复用，避免冗余
- 详细规范：查看 `docs/代码规范.md`

## 许可证

MIT License
