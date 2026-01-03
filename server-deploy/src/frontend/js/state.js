/**
 * 应用状态管理模块
 * 集中管理全局状态变量
 */

const AppState = {
    currentGroup: GROUP_CONFIG.GROUP2.NAME,
    turnCount: 0,
    completed: false,       // 完成状态（管理员设置的）
    isAiTyping: false,
    isInputLocked: false,
    showHighlightTask: false,
    conversationHistory: [],
    currentAiMessageElement: null,
    waitingForView: false,  // 等待用户查看消息
    viewTimer: null,        // 查看计时器
    viewStartTime: null,    // 开始查看的时间
    userInfo: null,         // 用户信息 {username, group}
    topicConfig: null,      // 当天的任务配置 {topic_name, concept_definition, available_templates}
    currentSessionId: null, // 当前会话ID

    /**
     * 初始化用户信息
     */
    initUserInfo() {
        let userInfo = null;
        if (typeof Storage !== 'undefined' && Storage.getUserInfo) {
            userInfo = Storage.getUserInfo();
        } else {
            // 兼容旧代码
            const userInfoStr = localStorage.getItem('user_info');
            if (userInfoStr) {
                try {
                    userInfo = JSON.parse(userInfoStr);
                } catch (e) {
                    console.error('解析用户信息失败:', e);
                }
            }
        }
        
        if (userInfo) {
            // 严格验证：确保必要字段存在
            if (!userInfo.username) {
                console.error('严重错误：userInfo 缺少 username 字段！', userInfo);
                return;
            }
            if (!userInfo.group) {
                console.error('严重错误：userInfo 缺少 group 字段！', userInfo);
                return;
            }
            
            this.userInfo = userInfo;
            // 根据用户组别设置当前组
            this.currentGroup = this.userInfo.group;
        }
    },

    /**
     * 加载当天的任务配置
     */
    async loadTopicConfig() {
        try {
            if (typeof API !== 'undefined' && API.getCurrentTopic) {
                const config = await API.getCurrentTopic();
                this.topicConfig = config;
                console.log('已加载任务配置:', config);
                return config;
            }
        } catch (error) {
            console.error('加载任务配置失败:', error);
            // 如果加载失败，使用默认配置（向后兼容）
            this.topicConfig = {
                topic_name: 'C++ 指针与内存',
                concept_definition: '',
                available_templates: PROMPTS || {}
            };
            return this.topicConfig;
        }
    },

    /**
     * 加载用户进度
     */
    async loadProgress() {
        if (typeof API !== 'undefined' && API.getProgress) {
            const progress = await API.getProgress();
            
            if (progress) {
                // 严格验证：确保 progress 是对象
                if (typeof progress !== 'object') {
                    throw new Error('progress 不是对象: ' + JSON.stringify(progress));
                }
                // 直接使用后端返回的turnCount，保持实际进度
                this.turnCount = progress.turnCount || 0;
                
                // 同步 completed 状态（管理员设置的）
                if (typeof progress.completed === 'boolean') {
                    this.completed = progress.completed;
                    console.log('已更新完成状态:', this.completed, 'turnCount:', this.turnCount);
                } else {
                    // 如果没有返回 completed，根据 turnCount 计算
                    this.completed = this.isGroup1LimitReached() || this.isGroup2TargetReached();
                }
                
                console.log('已加载用户进度:', { turnCount: this.turnCount, completed: this.completed });
                
                // 更新UI显示（包括进度和完成状态）
                if (typeof UI !== 'undefined' && UI.update) {
                    UI.update();
                }
                // 同时更新用户信息显示
                if (typeof Main !== 'undefined' && Main._updateUserInfoDisplay) {
                    Main._updateUserInfoDisplay();
                }
            }
        }
    },

    /**
     * 保存用户进度
     */
    async saveProgress() {
        try {
            if (typeof API !== 'undefined' && API.saveProgress) {
                const completed = this.isGroup1LimitReached() || this.isGroup2TargetReached();
                await API.saveProgress(this.turnCount, completed);
                console.log('已保存用户进度:', { turnCount: this.turnCount, completed });
            }
        } catch (error) {
            console.error('保存进度失败:', error);
        }
    },

    /**
     * 重置状态（但保留进度）
     */
    reset() {
        // 注意：不重置 turnCount 和 completed，保持从数据库加载的进度
        this.isAiTyping = false;
        this.isInputLocked = false;
        this.showHighlightTask = false;
        this.conversationHistory = [];
        this.currentAiMessageElement = null;
        this.waitingForView = false;
        this._clearViewTimer();
    },

    /**
     * 清除查看计时器
     * @private
     */
    _clearViewTimer() {
        if (this.viewTimer) {
            clearInterval(this.viewTimer);
            this.viewTimer = null;
        }
        this.viewStartTime = null;
    },

    /**
     * 切换组别
     * @param {string} group - 组别名称
     */
    switchGroup(group) {
        this.currentGroup = group;
        this.reset();
    },

    /**
     * 增加轮次
     */
    incrementTurn() {
        const beforeTurnCount = this.turnCount;
        const callStack = new Error().stack;
        
        // 检查是否已达到目标，防止超出
        if (this.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
            if (this.turnCount >= GROUP_CONFIG.GROUP2.TARGET_TURNS) {
                console.warn('[轮次日志] incrementTurn被调用但已达到目标，不增加', {
                    currentGroup: this.currentGroup,
                    turnCount: this.turnCount,
                    target: GROUP_CONFIG.GROUP2.TARGET_TURNS,
                    callStack: callStack.split('\n').slice(1, 4).join('\n')
                });
                return; // 已达到目标，不再增加
            }
        } else if (this.currentGroup === GROUP_CONFIG.GROUP1.NAME) {
            if (this.turnCount >= GROUP_CONFIG.GROUP1.MAX_TURNS) {
                console.warn('[轮次日志] incrementTurn被调用但已达到限制，不增加', {
                    currentGroup: this.currentGroup,
                    turnCount: this.turnCount,
                    max: GROUP_CONFIG.GROUP1.MAX_TURNS,
                    callStack: callStack.split('\n').slice(1, 4).join('\n')
                });
                return; // 已达到限制，不再增加
            }
        }
        
        this.turnCount++;
        
        console.log('[轮次日志] incrementTurn执行', {
            before: beforeTurnCount,
            after: this.turnCount,
            increment: 1,
            currentGroup: this.currentGroup,
            timestamp: new Date().toISOString(),
            callStack: callStack.split('\n').slice(1, 4).join('\n')
        });
        
        // 立即保存进度（异步，不阻塞）
        this.saveProgress().catch(error => {
            console.error('[轮次日志] 保存进度失败:', error);
        });
    },

    /**
     * 检查是否达到限制
     * @returns {boolean}
     */
    isGroup1LimitReached() {
        // 如果管理员设置了 completed，直接返回 true
        if (this.completed && this.currentGroup === GROUP_CONFIG.GROUP1.NAME) {
            return true;
        }
        return this.currentGroup === GROUP_CONFIG.GROUP1.NAME &&
               this.turnCount >= GROUP_CONFIG.GROUP1.MAX_TURNS;
    },

    /**
     * 检查是否达到目标
     * @returns {boolean}
     */
    isGroup2TargetReached() {
        // 如果管理员设置了 completed，直接返回 true
        if (this.completed && this.currentGroup === GROUP_CONFIG.GROUP2.NAME) {
            return true;
        }
        return this.currentGroup === GROUP_CONFIG.GROUP2.NAME &&
               this.turnCount >= GROUP_CONFIG.GROUP2.TARGET_TURNS;
    }
};

