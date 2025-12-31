#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI教学实验系统 - 启动脚本

统一启动入口：自动启动后端服务器并打开前端页面
遵循PEP 8代码规范
"""

import os
import sys
import time
import subprocess
import webbrowser
import socket
from pathlib import Path


# 项目配置常量
BACKEND_PORT = 3000
FRONTEND_FILE = "src/frontend/cplus.html"
BACKEND_SCRIPT = "src/backend/server.js"
STARTUP_DELAY = 2
PORT_CHECK_TIMEOUT = 5


def check_nodejs():
    """
    检查 Node.js 是否已安装
    
    Returns:
        bool: Node.js 是否已安装
    """
    try:
        result = subprocess.run(
            ['node', '--version'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=PORT_CHECK_TIMEOUT
        )
        if result.returncode == 0:
            print(f"✓ Node.js 已安装: {result.stdout.strip()}")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    print("✗ 未检测到 Node.js，请先安装 Node.js (https://nodejs.org/)")
    return False


def check_port(port):
    """
    检查端口是否被占用
    
    Args:
        port (int): 要检查的端口号
        
    Returns:
        bool: 端口是否可用（True表示可用）
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    return result != 0


def start_backend():
    """
    启动后端服务器
    
    Returns:
        subprocess.Popen: 后端进程对象，失败返回None
    """
    if not os.path.exists(BACKEND_SCRIPT):
        print(f"✗ 错误：找不到 {BACKEND_SCRIPT}")
        return None

    if not check_port(BACKEND_PORT):
        print(f"✗ 错误：端口 {BACKEND_PORT} 已被占用")
        print(f"  请关闭占用该端口的程序，或修改 server.js 中的端口号")
        return None

    print(f"正在启动后端服务器 (端口 {BACKEND_PORT})...")
    try:
        backend_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'src',
            'backend'
        )
        backend_script_name = os.path.basename(BACKEND_SCRIPT)
        # 不重定向输出，让服务器日志直接显示在终端
        process = subprocess.Popen(
            ['node', backend_script_name],
            stdout=None,  # 直接输出到终端
            stderr=None,  # 直接输出到终端
            text=True,
            encoding='utf-8',
            errors='replace',
            cwd=backend_dir
        )

        time.sleep(STARTUP_DELAY)

        if process.poll() is None:
            print(f"✓ 后端服务器已启动 (PID: {process.pid})")
            print("  服务器日志将直接显示在下方")
            print()
            return process
        else:
            # 进程已退出，说明启动失败
            print("✗ 后端服务器启动失败")
            print("  请查看上方的错误信息")
            return None

    except Exception as e:
        print(f"✗ 启动后端服务器时出错: {e}")
        return None


def open_frontend():
    """
    打开前端页面
    
    Returns:
        bool: 是否成功打开
    """
    frontend_path = os.path.abspath(FRONTEND_FILE)

    if not os.path.exists(frontend_path):
        print(f"✗ 错误：找不到 {FRONTEND_FILE}")
        return False

    print("正在打开前端页面...")
    try:
        file_url = f'file:///{frontend_path.replace(os.sep, "/")}'
        webbrowser.open(file_url)
        print("✓ 前端页面已打开")
        return True
    except Exception as e:
        print(f"✗ 打开前端页面时出错: {e}")
        return False


def monitor_backend(process):
    """
    监控后端进程
    
    Args:
        process (subprocess.Popen): 后端进程对象
    """
    try:
        process.wait()
        print("\n后端服务器已停止")
    except KeyboardInterrupt:
        pass


def shutdown_backend(process):
    """
    安全关闭后端服务器
    
    Args:
        process (subprocess.Popen): 后端进程对象
    """
    print("\n\n正在关闭服务器...")
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
    print("服务器已关闭")


def main():
    """主函数"""
    print("=" * 50)
    print("AI教学实验系统 - 启动程序")
    print("=" * 50)
    print()

    if not check_nodejs():
        input("\n按 Enter 键退出...")
        sys.exit(1)

    print()

    backend_process = start_backend()
    if not backend_process:
        input("\n按 Enter 键退出...")
        sys.exit(1)

    print()

    print("等待服务器就绪...")
    time.sleep(1)

    if not open_frontend():
        print("警告：无法自动打开浏览器，请手动打开 cplus.html")

    print()
    print("=" * 50)
    print("系统已启动！")
    print("=" * 50)
    print(f"后端服务器: http://localhost:{BACKEND_PORT}")
    print(f"前端页面: {os.path.abspath(FRONTEND_FILE)}")
    print()
    print("提示：")
    print("  - 关闭此窗口将停止后端服务器")
    print("  - 按 Ctrl+C 可以安全退出")
    print()

    try:
        monitor_backend(backend_process)
    except KeyboardInterrupt:
        shutdown_backend(backend_process)
        print("\n感谢使用！")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n程序已中断")
        sys.exit(0)
    except Exception as e:
        print(f"\n发生错误: {e}")
        input("\n按 Enter 键退出...")
        sys.exit(1)
