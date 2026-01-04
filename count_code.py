#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
代码量统计脚本
统计项目中各种文件类型的代码行数
"""

import os
from pathlib import Path
from collections import defaultdict

# 要统计的文件扩展名
EXTENSIONS = ['.py', '.js', '.html', '.css', '.json', '.md', '.sh']

# 要排除的目录
EXCLUDE_DIRS = ['node_modules', '.git', '__pycache__', '.vscode', '.idea']

# 要排除的文件
EXCLUDE_FILES = ['package-lock.json']


def should_exclude(path):
    """检查路径是否应该被排除"""
    path_str = str(path)
    
    # 检查是否在排除目录中
    for exclude_dir in EXCLUDE_DIRS:
        if exclude_dir in path_str:
            return True
    
    # 检查是否是排除的文件
    if os.path.basename(path) in EXCLUDE_FILES:
        return True
    
    return False


def count_lines(file_path):
    """统计文件行数"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return len(f.readlines())
    except Exception:
        return 0


def main():
    """主函数"""
    project_root = Path(__file__).parent
    stats = defaultdict(lambda: {'count': 0, 'lines': 0})
    
    print("正在统计代码量...")
    
    # 遍历所有文件
    for file_path in project_root.rglob('*'):
        if not file_path.is_file():
            continue
        
        if should_exclude(file_path):
            continue
        
        ext = file_path.suffix.lower()
        if ext not in EXTENSIONS:
            continue
        
        lines = count_lines(file_path)
        stats[ext]['count'] += 1
        stats[ext]['lines'] += lines
    
    # 输出统计结果
    print("\n" + "=" * 40)
    print("        项目代码量统计报告")
    print("=" * 40 + "\n")
    
    total_files = 0
    total_lines = 0
    
    # 按扩展名排序输出
    for ext in sorted(stats.keys()):
        count = stats[ext]['count']
        lines = stats[ext]['lines']
        print(f"{ext or '(no extension)'}")
        print(f"  文件数: {count}")
        print(f"  代码行数: {lines}")
        print()
        
        total_files += count
        total_lines += lines
    
    print("-" * 40)
    print("总计:")
    print(f"  文件数: {total_files}")
    print(f"  代码行数: {total_lines}")
    print("=" * 40 + "\n")


if __name__ == "__main__":
    main()

