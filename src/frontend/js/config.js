/**
 * 配置和常量定义
 * 遵循阿里代码规范
 */

// API 配置
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000',
    BACKEND_PORT: 3000
};

// 实验组别配置
const GROUP_CONFIG = {
    GROUP1: {
        NAME: 'group1',
        MAX_TURNS: 2,
        LABEL: '基础概念学习（限制2次）'
    },
    GROUP2: {
        NAME: 'group2',
        TARGET_TURNS: 6,
        LABEL: '深度探索（目标6轮）'
    }
};

// Prompt 模板数据
const PROMPTS = {
    start: {
        text: "请用一个生活中的例子来解释 C++ 中指针的基本概念。",
        label: "开始学习定义"
    },
    options: [
        {
            icon: "help-circle",
            label: "询问符号（安全阀）",
            text: "我看到你使用了符号 []，它在这里具体起什么作用？"
        },
        {
            icon: "terminal",
            label: "添加步骤（构建）",
            text: "如何修改这段代码来处理 []？"
        },
        {
            icon: "refresh-cw",
            label: "改变变量（变体）",
            text: "如果我把 [] 改成 [] 会发生什么？"
        }
    ]
};

// 占位符验证配置
const PLACEHOLDER_CONFIG = {
    MIN_LEFT_PANEL_WIDTH: 320,
    MAX_LEFT_PANEL_WIDTH_RATIO: 0.7
};

