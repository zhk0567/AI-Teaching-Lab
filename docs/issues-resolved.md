# 问题解决记录

本文档记录系统开发和使用过程中遇到的重要问题及其解决方案。

---

## 2026-01-03

### 问题1: 轮次计数重复增加

**问题描述**：
- 用户只发送一条消息，但系统显示用了两次
- 一次对话被计为两次

**根本原因**：
1. 后端在保存AI消息后，使用 `MAX(turn_index)` 计算轮次，但 `turn_index` 是每轮对话的编号，用户消息和AI消息使用相同的 `turn_index`
2. 前端在AI回复完成后也调用 `incrementTurn()` 增加轮次
3. 导致轮次被增加了两次

**解决方案**：
1. **前端修复**：
   - 修改 `src/frontend/js/main.js`
   - 前端不再调用 `incrementTurn()`
   - 改为在AI回复完成后，从后端重新加载进度（`loadProgress()`）
   - 轮次由后端统一管理，前端只负责同步显示

2. **后端修复**：
   - 修改 `src/backend/models/messages.js` 中的 `getTurnCount()` 方法
   - 改为使用 `COUNT(DISTINCT turn_index) WHERE role = 'user'` 计算用户消息的唯一轮次数量
   - 这样即使有重复消息，也能正确计算轮次

3. **刷新消息修复**：
   - 修改 `src/frontend/js/messages.js`
   - 移除 `regenerateMessage()` 函数中的 `incrementTurn()` 调用
   - 刷新只是重新生成同一轮次的回复，不应该增加轮次

**相关文件**：
- `src/frontend/js/main.js`
- `src/frontend/js/state.js`
- `src/frontend/js/messages.js`
- `src/backend/routes/chat.js`
- `src/backend/models/messages.js`

**状态**: ✅ 已解决

---

### 问题5: MySQL 连接被拒绝 (ECONNREFUSED)

**问题描述**：
- 后端服务报错：`Error: connect ECONNREFUSED 127.0.0.1:3306`
- MySQL 服务未运行或无法连接

**解决方案**：
1. 检查 MySQL 服务状态：`systemctl status mysql`
2. 启动 MySQL 服务：`systemctl start mysql`
3. 如果MySQL认证失败，修复认证：
   ```bash
   sudo mysql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'Teaching2026';
   FLUSH PRIVILEGES;
   EXIT;
   ```
4. 重启后端服务：`pm2 restart ai-teaching-backend`
5. 如果仍有问题，运行修复脚本：`./fix.sh`

**相关文件**：
- `server-deploy/fix.sh`
- `server-deploy/troubleshooting.md`

**状态**: ✅ 已解决

---

### 问题7: Token验证失败频繁显示错误日志

**问题描述**：
- 每次页面加载时，Token验证失败都会在控制台显示大量错误日志
- 错误信息包括：`POST http://113.47.7.91/verify 401 (Unauthorized)`
- 这些错误日志影响开发体验，且对用户无意义

**根本原因**：
1. Token存储在服务器内存中（Map），服务器重启后Token会丢失
2. 前端每次页面加载都会调用 `checkAuth()` 验证Token
3. 如果Token无效（比如服务器重启），会显示详细的错误日志
4. 错误处理过于详细，在生产环境也会显示所有错误信息

**解决方案**：
1. **优化错误处理**：
   - 修改 `src/frontend/js/auth.js` 中的 `checkAuth()` 函数
   - Token验证失败时静默处理，只在开发环境显示警告
   - 减少不必要的错误日志输出

2. **优化admin.html**：
   - 修改 `src/frontend/admin.html` 中的Token验证逻辑
   - 401错误静默处理，不显示详细错误信息
   - 只在开发环境且非401错误时显示警告

3. **错误处理策略**：
   - 生产环境：Token验证失败静默处理，直接跳转到登录页
   - 开发环境：显示简化的警告信息，便于调试

**相关文件**：
- `src/frontend/js/auth.js`
- `src/frontend/admin.html`

**状态**: ✅ 已解决

---

## 最佳实践

### 轮次计数管理
- ✅ 轮次由后端统一管理（基于消息表中的 `turn_index`）
- ✅ 前端只负责从后端同步显示
- ✅ 不要在前端手动增加轮次

### 日志记录
- ✅ 使用请求ID追踪单个请求的完整流程
- ✅ 记录关键状态变化（轮次增加前后）
- ✅ 记录调用堆栈，便于定位问题来源

---

## 更新日志

- 2026-01-03: 创建文档，记录重要问题
