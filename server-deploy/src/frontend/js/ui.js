/**
 * UI渲染模块
 * 负责所有界面更新和渲染逻辑
 */

const UI = {
    /**
     * 更新所有UI组件
     */
    update() {
        this.renderProgress();
        this.renderPrompts();
        this.updateInputState();
        lucide.createIcons();
    },

    /**
     * 渲染进度条
     */
    renderProgress() {
        const container = Utils.getElement('progress-area');
        if (!container) {
            return;
        }

        if (AppState.currentGroup === GROUP_CONFIG.GROUP1.NAME) {
            this._renderGroup1Progress(container);
        } else {
            this._renderGroup2Progress(container);
        }
    },

    /**
     * 渲染Group1进度（倒数）
     * @private
     */
    _renderGroup1Progress(container) {
        // 优先使用管理员设置的 completed 状态
        const isDone = AppState.completed || AppState.isGroup1LimitReached();
        const remaining = Math.max(0, GROUP_CONFIG.GROUP1.MAX_TURNS - AppState.turnCount);
        const colorClass = isDone
            ? 'bg-red-100 text-red-600'
            : 'bg-green-100 text-green-700';
        const text = isDone
            ? '今日额度已用完'
            : `剩余: ${remaining} / ${GROUP_CONFIG.GROUP1.MAX_TURNS}`;

        container.innerHTML = `
            <div class="flex justify-end items-center gap-3">
                <span class="text-sm font-medium text-gray-600">剩余提问机会：</span>
                <div class="px-3 py-1 rounded-full text-sm font-bold ${colorClass}">
                    ${text}
                </div>
            </div>`;
    },

    /**
     * 渲染Group2进度（进度条）
     * @private
     */
    _renderGroup2Progress(container) {
        // 优先使用管理员设置的 completed 状态
        const isDone = AppState.completed || AppState.isGroup2TargetReached();
        // 限制进度条不超过100%，防止超出轮数
        const actualTurnCount = Math.min(AppState.turnCount, GROUP_CONFIG.GROUP2.TARGET_TURNS);
        const percent = Math.min(100, (actualTurnCount / GROUP_CONFIG.GROUP2.TARGET_TURNS) * 100);
        const color = isDone ? 'bg-green-500' : 'bg-blue-500';
        const statusText = isDone ? '目标达成！' : '研究深度';
        const progressText = this._getProgressText(isDone);

        container.innerHTML = `
            <div class="flex flex-col w-full">
                <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="${isDone ? 'text-green-600' : 'text-blue-600'}">${statusText}</span>
                    <span>${progressText}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full transition-all duration-500 ${color}" 
                         style="width: ${percent}%"></div>
                </div>
            </div>`;
    },

    /**
     * 获取进度文本
     * @private
     */
    _getProgressText(isDone) {
        if (isDone) {
            // 显示实际轮次，但不超过目标
            const displayCount = Math.min(AppState.turnCount, GROUP_CONFIG.GROUP2.TARGET_TURNS);
            return `目标达成！(${displayCount}/${GROUP_CONFIG.GROUP2.TARGET_TURNS})`;
        }
        // 即使初始状态（turnCount = 0），也显示轮数比
        const remaining = GROUP_CONFIG.GROUP2.TARGET_TURNS - AppState.turnCount;
        return remaining > 0
            ? `当前进度: 第${AppState.turnCount}/${GROUP_CONFIG.GROUP2.TARGET_TURNS}轮，加油，还需${remaining}轮`
            : `${AppState.turnCount} / ${GROUP_CONFIG.GROUP2.TARGET_TURNS}`;
    },

    /**
     * 渲染Prompt菜单
     */
    renderPrompts() {
        const container = Utils.getElement('prompt-container');
        if (!container) {
            return;
        }

        // 保存解锁提示（如果存在）
        const unlockNotice = container.querySelector('.unlock-notice');
        const noticeHTML = unlockNotice ? unlockNotice.outerHTML : null;

        container.innerHTML = '';
        
        // 恢复解锁提示（如果存在且未过期）
        if (noticeHTML && unlockNotice) {
            container.insertAdjacentHTML('beforeend', noticeHTML);
            lucide.createIcons();
        }

        if (AppState.turnCount === 0) {
            // 第一次，显示步骤一（开始学习定义）
            this._renderStartPrompt(container);
        } else if (AppState.isGroup1LimitReached()) {
            this._renderLimitReached(container);
        } else if (AppState.isGroup2TargetReached()) {
            this._renderGroup2Completed(container);
        } else if (AppState.hasUsedLeftPrompt) {
            // 只有使用过左侧提示词，才显示步骤二（深度探索）
            this._renderPromptOptions(container);
        } else {
            // 如果第一次没有使用左侧提示词，不显示步骤二
            this._renderNoPromptMessage(container);
        }
    },

    /**
     * 渲染开始Prompt
     * @private
     */
    _renderStartPrompt(container) {
        // 从任务配置获取提示，如果没有则使用默认值
        const prompts = AppState.topicConfig?.available_templates || PROMPTS;
        const startPrompt = prompts.start || { text: '', label: '开始学习定义' };
        
        container.innerHTML = `
            <button onclick="fillPrompt('${Utils.escapeHtml(startPrompt.text)}')" 
                class="w-full text-left p-4 rounded-xl border-2 border-blue-100 bg-blue-50 
                       hover:border-blue-500 hover:shadow-md transition-all group">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-blue-700">${Utils.escapeHtml(startPrompt.label)}</span>
                    <i data-lucide="play" class="w-4 h-4 text-blue-400 group-hover:text-blue-600"></i>
                </div>
                <p class="text-xs text-slate-500">点击加载定义。</p>
            </button>`;
    },

    /**
     * 渲染限制达到提示
     * @private
     */
    _renderLimitReached(container) {
        container.innerHTML = `
            <div class="p-4 bg-gray-100 rounded-lg text-center border border-gray-200 mt-10">
                <div class="mx-auto text-green-500 mb-2 flex justify-center">
                    <i data-lucide="check-circle" width="32" height="32"></i>
                </div>
                <h3 class="font-bold text-gray-700">今日额度已用完</h3>
                <p class="text-xs text-gray-500 mt-2">今日基础概念学习已完成，请整理笔记。</p>
            </div>`;
    },

    /**
     * 渲染Group2完成提示
     * @private
     */
    _renderGroup2Completed(container) {
        container.innerHTML = `
            <div class="p-4 bg-green-50 rounded-lg text-center border-2 border-green-200 mt-10">
                <div class="mx-auto text-green-500 mb-2 flex justify-center">
                    <i data-lucide="trophy" width="32" height="32"></i>
                </div>
                <h3 class="font-bold text-green-700 mb-1">目标达成！</h3>
                <p class="text-xs text-green-600 mt-2">
                    恭喜！你已完成 ${GROUP_CONFIG.GROUP2.TARGET_TURNS} 轮深度探索，已掌握 ${AppState.topicConfig?.topic_name || 'C++ 指针'}概念！
                </p>
                <p class="text-xs text-gray-500 mt-3">
                    实验已完成，请整理笔记。
                </p>
            </div>`;
    },

    /**
     * 渲染Prompt选项
     * @private
     */
    _renderPromptOptions(container) {
        const isLocked = AppState.isAiTyping || AppState.showHighlightTask || AppState.waitingForView;
        const lockClass = isLocked ? 'opacity-40 pointer-events-none blur-[1px]' : '';

        let html = `
            <div class="text-sm font-semibold text-gray-400 mb-3 transition-opacity ${lockClass}">
                步骤 ${AppState.turnCount + 1}：深度探索
            </div>
            <div class="space-y-3 transition-opacity duration-300 ${lockClass}">`;

        // 从任务配置获取提示，如果没有则使用默认值
        const prompts = AppState.topicConfig?.available_templates || PROMPTS;
        const options = prompts.options || [];
        
        options.forEach(opt => {
            html += `
                <button onclick="fillPrompt('${Utils.escapeHtml(opt.text)}')" 
                    class="w-full text-left p-3 rounded-lg border border-gray-200 
                           hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                    <div class="flex items-center gap-2 font-semibold text-slate-700">
                        <span class="p-1 bg-gray-100 rounded text-slate-500">
                            <i data-lucide="${opt.icon}" width="16" height="16"></i>
                        </span>
                        ${opt.label}
                    </div>
                </button>`;
        });

        html += '</div>';

        if (isLocked) {
            html += this._renderLockMessage();
        }

        container.innerHTML = html;
    },

    /**
     * 渲染无提示词消息（当用户第一次没有使用左侧提示词时）
     * @private
     */
    _renderNoPromptMessage(container) {
        container.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg text-center border border-gray-200 mt-10">
                <div class="mx-auto text-gray-400 mb-2 flex justify-center">
                    <i data-lucide="info" width="24" height="24"></i>
                </div>
                <p class="text-xs text-gray-500 mt-2">
                    提示：左侧提示词是辅助工具。如需使用，请在第一次对话时点击左侧提示词。
                </p>
            </div>`;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * 渲染锁定消息
     * @private
     */
    _renderLockMessage() {
        if (AppState.showHighlightTask) {
            return `
                <div class="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg animate-pulse">
                    <div class="flex gap-2 text-amber-800 font-bold text-sm items-center mb-1">
                        <i data-lucide="mouse-pointer-2" width="16"></i> 需要交互
                    </div>
                    <p class="text-xs text-amber-700">
                        请点击或划词选择 AI 回复中你最不理解的一个关键词，或你觉得最重要的代码行。
                    </p>
                </div>`;
        }
        if (AppState.waitingForView) {
            return `
                <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg 
                            flex items-center gap-2 text-blue-600 text-sm">
                    <i data-lucide="eye" width="16"></i> 
                    <span>请查看上方 AI 回复（停留2-3秒以解锁）</span>
                </div>`;
        }
        return `
            <div class="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg 
                        flex items-center gap-2 text-gray-500 text-sm">
                <i data-lucide="lock" width="16"></i> AI 正在思考...
            </div>`;
    },

    /**
     * 更新输入框状态
     */
    updateInputState() {
        const input = Utils.getElement('user-input');
        const btn = Utils.getElement('send-btn');
        const dot = Utils.getElement('ai-status-dot');

        if (!input || !btn) {
            return;
        }

        // 确保状态值有效（防止undefined或null）
        const isAiTyping = AppState.isAiTyping === true;
        const showHighlightTask = AppState.showHighlightTask === true;
        const waitingForView = AppState.waitingForView === true;
        const doneG1 = AppState.isGroup1LimitReached();
        const doneG2 = AppState.isGroup2TargetReached();
        // 只有在AI正在打字时才锁定输入框，其他情况允许用户输入
        // showHighlightTask 和 waitingForView 不应该阻止用户输入，只应该阻止发送
        const locked = isAiTyping || doneG1 || doneG2;

        // 更新输入框状态
        if (locked) {
            input.disabled = true;
        } else {
            // 确保输入框可用
            input.disabled = false;
            input.removeAttribute('readonly');
            // 确保输入框可以接收焦点和输入
            input.style.pointerEvents = 'auto';
            input.style.userSelect = 'text';
        }
        
        btn.disabled = locked || !input.value.trim();

        input.placeholder = this._getPlaceholder(doneG1);

        if (dot) {
            dot.className = isAiTyping
                ? "w-2 h-2 rounded-full bg-green-400 animate-ping"
                : "w-2 h-2 rounded-full bg-gray-300";
        }
    },

    /**
     * 获取占位符文本
     * @private
     */
    _getPlaceholder(doneG1) {
        if (doneG1) {
            return "今日基础概念学习已完成，请整理笔记。";
        }
        if (AppState.isGroup2TargetReached()) {
            return "目标已达成！实验已完成，请整理笔记。";
        }
        if (AppState.showHighlightTask) {
            return "请点击上方 AI 回复中的关键词以解锁下一步...";
        }
        return "从左侧选择一个提示，或直接输入问题...";
    }
};

