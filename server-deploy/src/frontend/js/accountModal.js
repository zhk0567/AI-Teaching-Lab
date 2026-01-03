/**
 * 账号信息弹窗管理模块
 */

const AccountModal = {
    modal: null,
    currentYear: null,
    currentMonth: null,
    completedDates: [], // 存储所有完成日期
    selectedDate: null, // 当前选中的日期（用于查看该日期的数据）
    
    init() {
        this.modal = document.getElementById('account-modal');
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
        // 默认选中今天
        this.selectedDate = today.toISOString().split('T')[0];
        // 不在这里加载账号信息，避免阻塞初始化
        // 账号信息将在 show() 时加载
    },
    
    async show() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
            
            // 先刷新进度，确保使用最新状态
            if (typeof AppState !== 'undefined' && AppState.loadProgress) {
                try {
                    await AppState.loadProgress();
                } catch (error) {
                    console.warn('刷新进度失败:', error.message);
                }
            }
            
            // 加载账号信息（包括今日状态），等待完成以确保显示最新数据
            try {
                await this.loadAccountInfo();
            } catch (error) {
                console.error('加载账号信息失败:', error);
            }
            
            // 初始化图标
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },
    
    hide() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    },
    
    async loadAccountInfo() {
        try {
            let userInfo = null;
            if (typeof Storage !== 'undefined' && Storage.getUserInfo) {
                userInfo = Storage.getUserInfo();
            } else {
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
                    document.getElementById('account-username').textContent = '未知用户';
                } else {
                    document.getElementById('account-username').textContent = userInfo.username;
                }
                
                if (!userInfo.group) {
                    console.error('严重错误：userInfo 缺少 group 字段！', userInfo);
                    document.getElementById('account-group').textContent = '未知组别';
                } else {
                    document.getElementById('account-group').textContent = 
                        userInfo.group === 'group1' ? '组别1 - 基础概念学习' : '组别2 - 深度探索';
                }
                
                // 加载今日状态
                await this.loadTodayStatus();
                
                // 加载完成日期
                await this.loadCompletedDates();
                
                // 加载概念墙和关键词列表（默认加载今天的）
                await this.loadConcepts(this.selectedDate);
                await this.loadKeywords(this.selectedDate);
                
                // 生成日历
                this.generateCalendar();
                
                // 绑定月份切换按钮
                this.setupMonthNavigation();
                
                // 绑定日期点击事件
                this.setupDateClick();
            } else {
                console.error('严重错误：userInfo 为空！');
                document.getElementById('account-username').textContent = '未登录';
                document.getElementById('account-group').textContent = '未知组别';
            }
        } catch (e) {
            console.error('加载账号信息失败:', e);
        }
    },
    
    async loadTodayStatus() {
        try {
            if (typeof API !== 'undefined' && API.getProgress) {
                const progress = await API.getProgress();
                const statusDiv = document.getElementById('today-status');
                const badgeDiv = document.getElementById('today-badge');
                
                // 严格验证：确保 progress 是对象
                if (!progress || typeof progress !== 'object') {
                    console.error('严重错误：progress 不是对象！', progress);
                    statusDiv.textContent = '加载失败';
                    badgeDiv.textContent = '错误';
                    badgeDiv.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800';
                    return;
                }
                
                // 安全访问 progress 属性
                const completed = progress.completed || false;
                const turnCount = progress.turnCount || 0;
                
                // 获取用户组别信息，用于判断是否达到上限
                let userInfo = null;
                if (typeof Storage !== 'undefined' && Storage.getUserInfo) {
                    userInfo = Storage.getUserInfo();
                } else {
                    const userInfoStr = localStorage.getItem('user_info');
                    if (userInfoStr) {
                        try {
                            userInfo = JSON.parse(userInfoStr);
                        } catch (e) {
                            console.error('解析用户信息失败:', e);
                        }
                    }
                }
                
                // 判断完成状态：
                // 1. 管理员手动设置的 completed 状态
                // 2. 或者自动判断：group1达到maxTurns，group2达到targetTurns
                let isCompleted = completed;
                if (!isCompleted && userInfo && userInfo.group) {
                    if (userInfo.group === 'group1') {
                        // 组别1：检查是否达到最大轮次
                        const maxTurns = GROUP_CONFIG.GROUP1.MAX_TURNS || 2;
                        if (turnCount >= maxTurns) {
                            isCompleted = true;
                        }
                    } else if (userInfo.group === 'group2') {
                        // 组别2：检查是否达到目标轮次
                        const targetTurns = GROUP_CONFIG.GROUP2.TARGET_TURNS || 6;
                        if (turnCount >= targetTurns) {
                            isCompleted = true;
                        }
                    }
                }
                
                if (isCompleted) {
                    statusDiv.textContent = '今日已完成';
                    badgeDiv.textContent = '已完成';
                    badgeDiv.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800';
                } else if (turnCount > 0) {
                    statusDiv.textContent = `进行中 (${turnCount} 轮)`;
                    badgeDiv.textContent = '进行中';
                    badgeDiv.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800';
                } else {
                    statusDiv.textContent = '未开始';
                    badgeDiv.textContent = '未开始';
                    badgeDiv.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800';
                }
            }
        } catch (error) {
            console.error('加载今日状态失败:', error);
            const statusDiv = document.getElementById('today-status');
            const badgeDiv = document.getElementById('today-badge');
            if (statusDiv && badgeDiv) {
                statusDiv.textContent = '加载失败';
                badgeDiv.textContent = '错误';
                badgeDiv.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800';
            }
        }
    },
    
    async loadCompletedDates() {
        try {
            if (typeof API !== 'undefined' && API.getCompletedDates) {
                this.completedDates = await API.getCompletedDates();
                console.log('加载完成日期:', this.completedDates);
            }
        } catch (error) {
            console.warn('加载完成日期失败（将使用空数组）:', error.message);
            this.completedDates = []; // 失败时使用空数组，不影响使用
        }
    },

    async loadKeywords(date = null) {
        try {
            if (typeof API !== 'undefined' && API.getKeywords) {
                const response = await API.getKeywords(date);
                if (response && response.keywords) {
                    // 更新左侧关键词列表
                    const container = Utils.getElement('selected-keywords-list');
                    if (container) {
                        // 使用 requestAnimationFrame 确保平滑更新
                        requestAnimationFrame(() => {
                            // 清空现有列表
                            container.innerHTML = '';
                            
                            // 去重（按关键词文本）
                            const uniqueKeywords = new Map();
                            response.keywords.forEach(keyword => {
                                if (!uniqueKeywords.has(keyword.keyword_text)) {
                                    uniqueKeywords.set(keyword.keyword_text, keyword);
                                }
                            });
                            
                            // 添加关键词标签
                            uniqueKeywords.forEach(keyword => {
                                const keywordTag = Utils.createElement('div', 
                                    'keyword-tag inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200');
                                
                                keywordTag.innerHTML = `
                                    <i data-lucide="check-circle" width="12" height="12"></i>
                                    <span>${Utils.escapeHtml(keyword.keyword_text)}</span>`;
                                
                                container.appendChild(keywordTag);
                            });
                            
                            // 初始化图标
                            if (typeof lucide !== 'undefined') {
                                lucide.createIcons();
                            }
                        });
                    }
                } else {
                    // 如果没有数据，清空列表
                    const container = Utils.getElement('selected-keywords-list');
                    if (container) {
                        requestAnimationFrame(() => {
                            container.innerHTML = '';
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('加载关键词列表失败:', error.message);
            // 出错时也清空列表
            const container = Utils.getElement('selected-keywords-list');
            if (container) {
                container.innerHTML = '';
            }
        }
    },

    async loadConcepts(date = null) {
        try {
            if (typeof API !== 'undefined' && API.getConcepts) {
                const response = await API.getConcepts(date);
                if (response && response.concepts) {
                    // 更新概念墙列表
                    const container = Utils.getElement('concept-wall-list');
                    if (container) {
                        // 使用 requestAnimationFrame 确保平滑更新
                        requestAnimationFrame(() => {
                            // 清空现有列表
                            container.innerHTML = '';
                            
                            // 去重（按概念名称）
                            const uniqueConcepts = new Map();
                            response.concepts.forEach(concept => {
                                if (!uniqueConcepts.has(concept.concept_name)) {
                                    uniqueConcepts.set(concept.concept_name, concept);
                                }
                            });
                            
                            // 添加概念砖块
                            uniqueConcepts.forEach(concept => {
                                const conceptBrick = Utils.createElement('div', 
                                    'concept-brick px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-600 font-semibold text-sm shadow-lg');
                                
                                conceptBrick.textContent = concept.concept_name;
                                container.appendChild(conceptBrick);
                            });
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('加载概念墙列表失败:', error.message);
        }
    },

    generateCalendar() {
        const container = document.getElementById('calendar-container');
        if (!container) return;
        
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();
        
        const currentYear = this.currentYear;
        const currentMonth = this.currentMonth;
        
        // 更新月份显示
        const monthYearElement = document.getElementById('calendar-month-year');
        if (monthYearElement) {
            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            monthYearElement.textContent = `${currentYear}年${monthNames[currentMonth]}`;
        }
        
        // 获取当月第一天是星期几
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        // 获取当月天数
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // 星期标题
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        let html = weekDays.map(day => 
            `<div class="text-center text-xs font-semibold text-gray-500 py-0.5">${day}</div>`
        ).join('');
        
        // 填充空白（上个月的日期）
        for (let i = 0; i < firstDay; i++) {
            html += '<div style="aspect-ratio: 1; min-height: 0; padding: 0;"></div>';
        }
        
        // 生成当月日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = (currentYear === todayYear && currentMonth === todayMonth && day === todayDate);
            const isCompleted = this.completedDates.includes(dateStr);
            const isSelected = this.selectedDate === dateStr;
            
            let dayClass = 'flex items-center justify-center rounded text-sm transition-colors cursor-pointer ';
            let dayStyle = 'aspect-ratio: 1; min-height: 0; padding: 0.25rem; width: 100%; height: 100%; ';
            
            if (isSelected) {
                // 选中的日期：紫色背景
                dayClass += 'bg-purple-500 text-white font-semibold border-2 border-purple-700';
                if (isCompleted) {
                    html += `<div class="${dayClass}" style="${dayStyle}" data-date="${dateStr}" title="已完成（已选中）">
                        <i data-lucide="check-circle" width="18" height="18" stroke-width="2.5"></i>
                    </div>`;
                } else {
                    html += `<div class="${dayClass}" style="${dayStyle}" data-date="${dateStr}" title="已选中">${day}</div>`;
                }
            } else if (isCompleted) {
                // 已完成日期：绿色背景，白色对号图标
                dayClass += 'bg-green-500 text-white font-semibold';
                // 使用 check-circle 图标，更明显的对号标记
                html += `<div class="${dayClass}" style="${dayStyle}" data-date="${dateStr}" title="已完成">
                    <i data-lucide="check-circle" width="18" height="18" stroke-width="2.5"></i>
                </div>`;
            } else if (isToday) {
                // 今天：蓝色背景
                dayClass += 'bg-blue-100 text-blue-800 font-semibold border border-blue-500';
                html += `<div class="${dayClass}" style="${dayStyle}" data-date="${dateStr}">${day}</div>`;
            } else {
                // 普通日期
                dayClass += 'hover:bg-gray-100 text-gray-700';
                html += `<div class="${dayClass}" style="${dayStyle}" data-date="${dateStr}">${day}</div>`;
            }
        }
        
        container.innerHTML = html;
        
        // 重新初始化图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    setupMonthNavigation() {
        const prevBtn = document.getElementById('calendar-prev-month');
        const nextBtn = document.getElementById('calendar-next-month');
        
        if (prevBtn) {
            prevBtn.onclick = () => {
                this.currentMonth--;
                if (this.currentMonth < 0) {
                    this.currentMonth = 11;
                    this.currentYear--;
                }
                this.generateCalendar();
                this.setupDateClick();
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                this.currentMonth++;
                if (this.currentMonth > 11) {
                    this.currentMonth = 0;
                    this.currentYear++;
                }
                this.generateCalendar();
                this.setupDateClick();
            };
        }
    },

    /**
     * 设置日期点击事件
     */
    setupDateClick() {
        const container = document.getElementById('calendar-container');
        if (!container) return;

        const dateElements = container.querySelectorAll('[data-date]');
        dateElements.forEach(element => {
            element.onclick = async () => {
                const dateStr = element.dataset.date;
                if (!dateStr) return;

                // 如果点击的是已选中的日期，不处理
                if (this.selectedDate === dateStr) {
                    return;
                }

                // 更新选中的日期
                const previousSelectedDate = this.selectedDate;
                this.selectedDate = dateStr;

                // 只更新选中状态的样式，不重新生成整个日历
                this.updateSelectedDateStyle(previousSelectedDate, dateStr);

                // 显示加载状态
                this.showLoadingState();

                // 加载该日期的概念墙和关键词
                try {
                    await Promise.all([
                        this.loadConcepts(dateStr),
                        this.loadKeywords(dateStr)
                    ]);
                } finally {
                    // 隐藏加载状态
                    this.hideLoadingState();
                }
            };
        });
    },

    /**
     * 更新选中日期的样式（不重新生成整个日历）
     */
    updateSelectedDateStyle(previousDate, newDate) {
        const container = document.getElementById('calendar-container');
        if (!container) return;

        // 移除之前的选中样式
        if (previousDate) {
            const previousElement = container.querySelector(`[data-date="${previousDate}"]`);
            if (previousElement) {
                const isCompleted = this.completedDates.includes(previousDate);
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const isToday = previousDate === todayStr;

                // 恢复原始样式
                previousElement.className = 'flex items-center justify-center rounded text-sm transition-colors cursor-pointer ';
                if (isCompleted) {
                    previousElement.className += 'bg-green-500 text-white font-semibold';
                    previousElement.innerHTML = '<i data-lucide="check-circle" width="18" height="18" stroke-width="2.5"></i>';
                } else if (isToday) {
                    previousElement.className += 'bg-blue-100 text-blue-800 font-semibold border border-blue-500';
                    previousElement.textContent = new Date(previousDate).getDate();
                } else {
                    previousElement.className += 'hover:bg-gray-100 text-gray-700';
                    previousElement.textContent = new Date(previousDate).getDate();
                }
            }
        }

        // 添加新的选中样式
        const newElement = container.querySelector(`[data-date="${newDate}"]`);
        if (newElement) {
            const isCompleted = this.completedDates.includes(newDate);
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const isToday = newDate === todayStr;

            // 应用选中样式
            newElement.className = 'flex items-center justify-center rounded text-sm transition-colors cursor-pointer bg-purple-500 text-white font-semibold border-2 border-purple-700';
            if (isCompleted) {
                newElement.innerHTML = '<i data-lucide="check-circle" width="18" height="18" stroke-width="2.5"></i>';
                newElement.title = '已完成（已选中）';
            } else {
                newElement.textContent = new Date(newDate).getDate();
                newElement.title = '已选中';
            }

            // 重新初始化图标
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },

    /**
     * 显示加载状态
     */
    showLoadingState() {
        const conceptsContainer = Utils.getElement('concept-wall-list');
        const keywordsContainer = Utils.getElement('selected-keywords-list');
        
        if (conceptsContainer) {
            conceptsContainer.style.opacity = '0.5';
            conceptsContainer.style.pointerEvents = 'none';
        }
        
        if (keywordsContainer) {
            keywordsContainer.style.opacity = '0.5';
            keywordsContainer.style.pointerEvents = 'none';
        }
    },

    /**
     * 隐藏加载状态
     */
    hideLoadingState() {
        const conceptsContainer = Utils.getElement('concept-wall-list');
        const keywordsContainer = Utils.getElement('selected-keywords-list');
        
        if (conceptsContainer) {
            conceptsContainer.style.opacity = '1';
            conceptsContainer.style.pointerEvents = 'auto';
        }
        
        if (keywordsContainer) {
            keywordsContainer.style.opacity = '1';
            keywordsContainer.style.pointerEvents = 'auto';
        }
    },
    
    async markTodayCompletion() {
        // 此方法已不再需要，因为完成日期标记已在 generateCalendar 中处理
        // 保留此方法以避免破坏现有调用
    }
};

/**
 * 显示/隐藏密码
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('login-password');
    const eyeIcon = document.getElementById('password-eye-icon');
    
    if (passwordInput && eyeIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.setAttribute('data-lucide', 'eye-off');
        } else {
            passwordInput.type = 'password';
            eyeIcon.setAttribute('data-lucide', 'eye');
        }
        // 重新初始化图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

/**
 * 显示账号弹窗
 */
function showAccountModal() {
    AccountModal.init();
    AccountModal.show();
}

/**
 * 关闭账号弹窗
 */
function closeAccountModal() {
    AccountModal.hide();
}

