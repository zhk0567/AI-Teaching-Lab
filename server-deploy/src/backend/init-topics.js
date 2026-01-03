/**
 * 初始化每日任务配置数据
 * 将当前真实的任务配置数据填入数据库
 */

const db = require('./db');
const Topics = require('./models/topics');

/**
 * 初始化任务配置数据
 */
async function initTopics() {
    try {
        await db.createPool();

        // 第1天的任务配置：C++ 指针与内存
        const day1Config = {
            day_id: 1,
            topic_name: 'C++ 指针与内存',
            concept_definition: `指针是C++中一个重要的概念，它存储了另一个变量的内存地址。

**基本概念：**
- 指针变量存储的是地址，而不是值本身
- 使用 \`*\` 符号声明指针：\`int* ptr;\`
- 使用 \`&\` 符号获取变量的地址：\`ptr = &var;\`
- 使用 \`*\` 符号解引用指针，访问指针指向的值：\`*ptr = 10;\`

**内存管理：**
- 栈内存：局部变量自动分配和释放
- 堆内存：使用 \`new\` 分配，\`delete\` 释放
- 指针可以帮助我们动态管理内存

**常见应用：**
- 动态数组
- 函数参数传递（引用传递）
- 数据结构（链表、树等）`,
            available_templates: {
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
            }
        };

        // 第2天的任务配置：C++ 向量 (Vectors)
        const day2Config = {
            day_id: 2,
            topic_name: 'C++ 向量 (Vectors)',
            concept_definition: `向量（vector）是C++标准库中最常用的容器之一，提供了动态数组的功能。

**基本概念：**
- \`std::vector\` 是一个动态数组，可以自动调整大小
- 使用 \`#include <vector>\` 头文件
- 声明：\`std::vector<int> vec;\` 或 \`vector<int> vec;\`（使用 using namespace std;）

**常用操作：**
- \`push_back()\`: 在末尾添加元素
- \`size()\`: 获取元素个数
- \`at()\` 或 \`[]\`: 访问元素
- \`begin()\` 和 \`end()\`: 迭代器

**优势：**
- 自动管理内存
- 支持动态扩容
- 提供丰富的成员函数`,
            available_templates: {
                start: {
                    text: "请用一个生活中的例子来解释 C++ 中向量的基本概念。",
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
            }
        };

        // 第3天的任务配置：C++ 字符串处理
        const day3Config = {
            day_id: 3,
            topic_name: 'C++ 字符串处理',
            concept_definition: `C++提供了两种主要的字符串类型：C风格字符串和std::string。

**std::string（推荐）：**
- \`#include <string>\`
- 自动管理内存，无需手动分配
- 支持丰富的字符串操作函数
- 可以像数组一样访问字符

**常用操作：**
- \`length()\` 或 \`size()\`: 获取字符串长度
- \`find()\`: 查找子字符串
- \`substr()\`: 提取子字符串
- \`+=\`: 字符串连接
- \`compare()\`: 字符串比较

**C风格字符串：**
- 字符数组，以 \`\\0\` 结尾
- 需要手动管理内存
- 使用 \`<cstring>\` 中的函数操作`,
            available_templates: {
                start: {
                    text: "请用一个生活中的例子来解释 C++ 中字符串处理的基本概念。",
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
            }
        };

        // 第4天的任务配置：C++ 函数与参数传递
        const day4Config = {
            day_id: 4,
            topic_name: 'C++ 函数与参数传递',
            concept_definition: `函数是C++中组织代码的基本单元，参数传递方式影响程序的效率和正确性。

**参数传递方式：**
1. **值传递（Pass by Value）**
   - 复制参数的值
   - 函数内修改不影响原变量
   - 适用于小数据类型

2. **引用传递（Pass by Reference）**
   - 使用 \`&\` 符号
   - 不复制，直接操作原变量
   - 可以修改原变量，效率高

3. **指针传递（Pass by Pointer）**
   - 传递变量的地址
   - 可以修改原变量
   - 需要解引用操作

**函数重载：**
- 同一函数名可以有多个版本
- 参数类型或数量不同
- 编译器根据参数自动选择`,
            available_templates: {
                start: {
                    text: "请用一个生活中的例子来解释 C++ 中函数与参数传递的基本概念。",
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
            }
        };

        // 第5天的任务配置：C++ 类与对象
        const day5Config = {
            day_id: 5,
            topic_name: 'C++ 类与对象',
            concept_definition: `类是C++面向对象编程的核心，用于封装数据和行为。

**基本概念：**
- **类（Class）**: 定义对象的模板
- **对象（Object）**: 类的实例
- **成员变量**: 类的数据
- **成员函数**: 类的行为

**访问控制：**
- \`public\`: 公开访问
- \`private\`: 仅类内访问
- \`protected\`: 类内和派生类访问

**构造函数与析构函数：**
- 构造函数：对象创建时自动调用
- 析构函数：对象销毁时自动调用
- 用于初始化和清理资源

**封装：**
- 将数据和行为组合在一起
- 隐藏实现细节
- 提供接口供外部使用`,
            available_templates: {
                start: {
                    text: "请用一个生活中的例子来解释 C++ 中类与对象的基本概念。",
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
            }
        };

        // 第6天的任务配置：C++ 继承与多态
        const day6Config = {
            day_id: 6,
            topic_name: 'C++ 继承与多态',
            concept_definition: `继承和多态是面向对象编程的重要特性，用于代码复用和扩展。

**继承（Inheritance）：**
- 子类继承父类的成员
- 使用 \`:\` 语法：\`class Child : public Parent\`
- 可以添加新成员或重写父类方法
- 实现代码复用

**多态（Polymorphism）：**
- 同一接口，不同实现
- 通过虚函数（virtual）实现
- 运行时根据对象类型调用相应方法
- 提高代码灵活性

**虚函数：**
- 使用 \`virtual\` 关键字
- 子类可以重写（override）
- 通过基类指针调用时，执行子类版本

**抽象类：**
- 包含纯虚函数的类
- 不能直接实例化
- 作为接口使用`,
            available_templates: {
                start: {
                    text: "请用一个生活中的例子来解释 C++ 中继承与多态的基本概念。",
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
            }
        };

        // 第7天的任务配置：C++ 文件操作
        const day7Config = {
            day_id: 7,
            topic_name: 'C++ 文件操作',
            concept_definition: `C++提供了文件流类来处理文件读写操作。

**文件流类：**
- \`ifstream\`: 输入文件流（读文件）
- \`ofstream\`: 输出文件流（写文件）
- \`fstream\`: 文件流（读写）
- 需要包含 \`<fstream>\` 头文件

**基本操作：**
1. **打开文件**
   - \`open(filename, mode)\`
   - 模式：\`ios::in\`, \`ios::out\`, \`ios::app\` 等

2. **读写操作**
   - 使用 \`<<\` 和 \`>>\` 运算符
   - 或使用 \`getline()\` 读取整行

3. **关闭文件**
   - \`close()\` 方法
   - 析构函数会自动关闭

**错误处理：**
- 检查文件是否成功打开
- 使用 \`is_open()\` 方法
- 处理文件不存在等情况`,
            available_templates: {
                start: {
                    text: "请用一个生活中的例子来解释 C++ 中文件操作的基本概念。",
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
            }
        };

        // 批量插入或更新所有配置
        await Topics.upsert(day1Config);
        console.log('✓ 已初始化第1天的任务配置：C++ 指针与内存');
        
        await Topics.upsert(day2Config);
        console.log('✓ 已初始化第2天的任务配置：C++ 向量 (Vectors)');
        
        await Topics.upsert(day3Config);
        console.log('✓ 已初始化第3天的任务配置：C++ 字符串处理');
        
        await Topics.upsert(day4Config);
        console.log('✓ 已初始化第4天的任务配置：C++ 函数与参数传递');
        
        await Topics.upsert(day5Config);
        console.log('✓ 已初始化第5天的任务配置：C++ 类与对象');
        
        await Topics.upsert(day6Config);
        console.log('✓ 已初始化第6天的任务配置：C++ 继承与多态');
        
        await Topics.upsert(day7Config);
        console.log('✓ 已初始化第7天的任务配置：C++ 文件操作');

        console.log('✓ 任务配置初始化完成（共7天）');
    } catch (error) {
        console.error('初始化任务配置失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本，执行初始化
if (require.main === module) {
    initTopics()
        .then(() => {
            console.log('任务配置初始化成功');
            process.exit(0);
        })
        .catch((error) => {
            console.error('任务配置初始化失败:', error);
            process.exit(1);
        });
}

module.exports = { initTopics };

