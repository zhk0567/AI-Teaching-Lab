/**
 * API调用模块
 * 负责与后端服务器的通信
 */

const API = {
    /**
     * 发送消息并获取AI回复
     * @param {string} message - 用户消息
     * @param {boolean} isRegenerate - 是否为重新生成（增加随机性）
     * @returns {Promise<string>} - AI回复内容
     */
    async sendMessage(message, isRegenerate = false) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: AppState.conversationHistory.slice(0, -1),
                isRegenerate: isRegenerate
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            const chunk = decoder.decode(value);
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
                    }
                }
            }
        }

        return fullResponse;
    }
};

