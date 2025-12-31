/**
 * API调用模块
 * 负责与后端服务器的通信
 */

const API = {
    /**
     * 获取认证Token
     * @returns {string|null}
     */
    getToken() {
        if (typeof Storage !== 'undefined' && Storage.getAuthToken) {
            return Storage.getAuthToken();
        }
        // 兼容旧代码
        return localStorage.getItem('auth_token');
    },

    /**
     * 发送消息并获取AI回复
     * @param {string} message - 用户消息
     * @param {boolean} isRegenerate - 是否为重新生成（增加随机性）
     * @returns {Promise<string>} - AI回复内容
     */
    async sendMessage(message, isRegenerate = false) {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        // 流式响应不设置超时，因为AI生成回复可能需要较长时间
        const response = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: AppState.conversationHistory.slice(0, -1),
                isRegenerate: isRegenerate
            })
        });

        if (!response.ok) {
            // 如果是401未授权，清除token并跳转到登录页
            if (response.status === 401) {
                if (typeof Storage !== 'undefined' && Storage.clearAuth) {
                    Storage.clearAuth();
                } else {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                }
                // 不跳转，因为现在使用弹窗登录
                const error = new Error('登录已过期，请重新登录');
                console.error('发送消息失败 - 401未授权:', error);
                throw error;
            }
            const error = new Error(`HTTP error! status: ${response.status}`);
            console.error('发送消息失败 - HTTP错误:', error, '响应状态:', response.status);
            throw error;
        }

        return this._processStreamResponse(response);
    },

    /**
     * 处理流式响应
     * @private
     * @param {Response} response - Fetch响应对象
     * @returns {Promise<string>} - 完整回复内容
     */
    async _processStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            continue;
                        }

                        try {
                            const json = JSON.parse(data);
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullResponse += delta;
                                if (AppState.currentAiMessageElement) {
                                    Messages.updateAiMessage(
                                        AppState.currentAiMessageElement,
                                        fullResponse
                                    );
                                }
                            }
                        } catch (e) {
                            // 忽略解析错误
                            console.warn('解析流式响应数据失败:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('处理流式响应失败:', error);
            // 确保即使出错也返回已接收的内容
            throw error;
        } finally {
            // 确保reader被释放
            try {
                reader.releaseLock();
            } catch (e) {
                // 忽略释放错误
            }
        }

        return fullResponse;
    },

    /**
     * 获取用户进度
     * @returns {Promise<Object>} - 用户进度信息
     */
    async getProgress() {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('获取进度超时(1秒)')), 1000)
        );

        const response = await Promise.race([
            fetch(`${CONFIG.API_BASE_URL}/progress`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                window.location.href = 'login.html';
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.progress;
    },

    /**
     * 获取用户所有完成日期
     * @returns {Promise<string[]>} - 完成日期数组（格式：YYYY-MM-DD）
     */
    async getCompletedDates() {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('获取完成日期超时(1秒)')), 1000)
        );

        const response = await Promise.race([
            fetch(`${CONFIG.API_BASE_URL}/progress/completed-dates`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            if (response.status === 401) {
                if (typeof Storage !== 'undefined' && Storage.clearAuth) {
                    Storage.clearAuth();
                } else {
                    localStorage.removeItem('auth_token');
                }
                const error = new Error('登录已过期，请重新登录');
            console.error('获取完成日期失败 - 401未授权:', error);
            throw error;
            }
            const error = new Error('获取完成日期失败');
            console.error('获取完成日期失败 - HTTP错误:', error, '响应状态:', response.status);
            throw error;
        }

        const data = await response.json();
        if (!data.success) {
            const error = new Error(data.error || '获取完成日期失败');
            console.error('获取完成日期失败 - 服务器返回错误:', error, '响应数据:', data);
            throw error;
        }

        return data.dates || [];
    },

    /**
     * 保存用户进度
     * @param {number} turnCount - 轮次数量
     * @param {boolean} completed - 是否完成
     */
    async saveProgress(turnCount, completed) {
        const token = this.getToken();
        if (!token) {
            return; // 未登录时不保存
        }

        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('保存进度超时(1秒)')), 1000)
            );

            await Promise.race([
                fetch(`${CONFIG.API_BASE_URL}/progress`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        turnCount: turnCount,
                        completed: completed
                    })
                }),
                timeoutPromise
            ]);
        } catch (error) {
            console.error('保存进度失败:', error);
            console.error('错误类型:', error.constructor.name);
            console.error('错误消息:', error.message);
            console.error('错误堆栈:', error.stack);
        }
    },

    /**
     * 管理员：获取所有用户列表
     * @returns {Promise<Array>} - 用户列表
     */
    async getUsers(abortSignal = null) {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        const fetchOptions = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        
        // 如果提供了 AbortSignal，添加到请求中
        if (abortSignal) {
            fetchOptions.signal = abortSignal;
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('获取用户列表超时(1秒)')), 1000)
        );

        const response = await Promise.race([
            fetch(`${CONFIG.API_BASE_URL}/admin/users`, fetchOptions),
            timeoutPromise
        ]);

        if (!response.ok) {
            if (response.status === 401) {
                if (typeof Storage !== 'undefined' && Storage.clearAuth) {
                    Storage.clearAuth();
                } else {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                }
                const error = new Error('登录已过期，请重新登录');
                console.error('获取用户列表失败 - 401未授权:', error);
                throw error;
            }
            if (response.status === 403) {
                const error = new Error('需要管理员权限');
                console.error('获取用户列表失败 - 403权限不足:', error);
                throw error;
            }
            if (response.status === 500) {
                const error = new Error('服务器内部错误，请查看后端日志');
                console.error('获取用户列表失败 - 500服务器错误:', error);
                throw error;
            }
            const error = new Error(`HTTP error! status: ${response.status}`);
            console.error('获取用户列表失败 - HTTP错误:', error, '响应状态:', response.status);
            throw error;
        }

        const data = await response.json();
        return data.users || [];
    },

    /**
     * 管理员：设置用户进度
     * @param {string} username - 用户名
     * @param {number} turnCount - 轮次数量
     * @param {boolean} completed - 是否完成
     */
    async setUserProgress(username, turnCount, completed) {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('设置进度超时(1秒)')), 1000)
        );

        const response = await Promise.race([
            fetch(`${CONFIG.API_BASE_URL}/admin/set-progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: username,
                    turnCount: turnCount,
                    completed: completed
                })
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            if (response.status === 403) {
                const error = new Error('需要管理员权限');
                console.error('设置进度失败 - 403权限不足:', error);
                throw error;
            }
            const error = new Error(`HTTP error! status: ${response.status}`);
            console.error('设置进度失败 - HTTP错误:', error, '响应状态:', response.status);
            throw error;
        }

        const data = await response.json();
        return data;
    },

    /**
     * 管理员：设置用户额度
     * @param {string} username - 用户名
     * @param {number} maxTurns - 最大轮次（group1）
     * @param {number} targetTurns - 目标轮次（group2）
     */
    async setUserQuota(username, maxTurns, targetTurns) {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('设置配额超时(1秒)')), 1000)
        );

        const response = await Promise.race([
            fetch(`${CONFIG.API_BASE_URL}/admin/set-quota`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: username,
                    ...(maxTurns !== undefined && { maxTurns }),
                    ...(targetTurns !== undefined && { targetTurns })
                })
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            if (response.status === 403) {
                const error = new Error('需要管理员权限');
                console.error('设置配额失败 - 403权限不足:', error);
                throw error;
            }
            const error = new Error(`HTTP error! status: ${response.status}`);
            console.error('设置配额失败 - HTTP错误:', error, '响应状态:', response.status);
            throw error;
        }

        const data = await response.json();
        return data;
    },

    /**
     * 管理员：重置用户状态
     * @param {string} username - 用户名
     */
    async resetUserStatus(username) {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('重置状态超时(1秒)')), 1000)
        );

        const response = await Promise.race([
            fetch(`${CONFIG.API_BASE_URL}/admin/reset-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: username })
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            if (response.status === 403) {
                const error = new Error('需要管理员权限');
                console.error('重置状态失败 - 403权限不足:', error);
                throw error;
            }
            const error = new Error(`HTTP error! status: ${response.status}`);
            console.error('重置状态失败 - HTTP错误:', error, '响应状态:', response.status);
            throw error;
        }

        const data = await response.json();
        return data;
    }
};

