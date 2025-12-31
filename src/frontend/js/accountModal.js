/**
 * 账号信息弹窗管理模块
 */

const AccountModal = {
    modal: null,
    currentYear: null,
    currentMonth: null,
    completedDates: [], // 存储所有完成日期
    
    init() {
        this.modal = document.getElementById('account-modal');
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
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
                
                // 生成日历
                this.generateCalendar();
                
                // 绑定月份切换按钮
                this.setupMonthNavigation();
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
            
            let dayClass = 'flex items-center justify-center rounded text-sm transition-colors ';
            let dayStyle = 'aspect-ratio: 1; min-height: 0; padding: 0.25rem; width: 100%; height: 100%; ';
            
            if (isCompleted) {
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
            };
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

