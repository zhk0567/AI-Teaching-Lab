#!/bin/bash
# AI教学实验系统 - 快速部署脚本
# 适用于 Ubuntu 22.04

# 注意：不使用 set -e，因为某些步骤（如 MySQL 修复）可能需要多次尝试

echo "=========================================="
echo "AI教学实验系统 - 快速部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_DIR="/var/www/ai-teaching-lab"
BACKEND_DIR="$PROJECT_DIR/src/backend"
FRONTEND_DIR="$PROJECT_DIR/src/frontend"
DB_NAME="ai_teaching_lab"
DB_USER="root"
PM2_APP_NAME="ai-teaching-backend"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}错误: 请使用 root 用户运行此脚本${NC}"
    exit 1
fi

# 函数：打印信息
info() {
    echo -e "${GREEN}[信息]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 函数：检查命令是否存在
check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 函数：停止现有服务
stop_existing_services() {
    info "停止现有服务..."
    
    # 停止 PM2 服务
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        info "停止 PM2 服务: $PM2_APP_NAME"
        pm2 stop $PM2_APP_NAME > /dev/null 2>&1 || true
        pm2 delete $PM2_APP_NAME > /dev/null 2>&1 || true
    fi
    
    # 停止 Nginx（如果需要重启）
    if systemctl is-active --quiet nginx; then
        info "停止 Nginx 服务"
        systemctl stop nginx > /dev/null 2>&1 || true
    fi
}

# 函数：修复 MySQL 进程冲突
fix_mysql_process_conflict() {
    info "检查 MySQL 进程状态..."
    
    # 检查是否有多个 MySQL 服务器进程
    MYSQLD_COUNT=$(ps aux | grep -E "mysqld[^_]" | grep -v grep | wc -l)
    
    if [ "$MYSQLD_COUNT" -gt 2 ]; then
        warn "检测到多个 MySQL 进程，可能存在冲突"
        
        # 停止 systemctl 管理的 MySQL
        systemctl stop mysql 2>/dev/null || true
        
        # 强制停止所有 MySQL 相关进程
        pkill -9 mysqld 2>/dev/null || true
        pkill -9 mysqld_safe 2>/dev/null || true
        pkill -9 -f "sudo mysql" 2>/dev/null || true
        sleep 3
        
        # 确认进程已停止
        if ps aux | grep -E "mysqld|mysqld_safe" | grep -v grep; then
            warn "仍有 MySQL 进程在运行，强制终止..."
            pkill -9 -f mysqld
            sleep 2
        fi
        
        # 清理锁文件
        info "清理 MySQL 锁文件..."
        rm -f /var/lib/mysql/*.pid 2>/dev/null
        rm -f /var/lib/mysql/ibdata1.lock 2>/dev/null
        rm -f /var/run/mysqld/*.pid 2>/dev/null
        rm -f /var/run/mysqld/*.sock* 2>/dev/null
        rm -f /tmp/mysql.sock* 2>/dev/null
        
        # 确保目录存在且权限正确
        mkdir -p /var/run/mysqld
        chown mysql:mysql /var/run/mysqld 2>/dev/null || true
        
        info "MySQL 进程冲突已清理"
    fi
    
    # 确保 MySQL 服务运行
    if ! systemctl is-active --quiet mysql; then
        info "启动 MySQL 服务..."
        systemctl start mysql
        
        # 等待 MySQL 启动（最多等待30秒）
        MAX_WAIT=30
        WAITED=0
        while [ $WAITED -lt $MAX_WAIT ]; do
            if systemctl is-active --quiet mysql; then
                info "MySQL 服务已启动"
                sleep 2
                break
            fi
            sleep 1
            WAITED=$((WAITED + 1))
        done
        
        # 如果仍然没有启动，检查错误
        if ! systemctl is-active --quiet mysql; then
            error "MySQL 启动超时，检查错误日志..."
            tail -20 /var/log/mysql/error.log 2>/dev/null || true
            return 1
        fi
    else
        info "MySQL 服务已在运行"
    fi
    
    return 0
}

# 函数：修复 MySQL 认证问题
fix_mysql_auth() {
    info "检查 MySQL 认证配置..."
    
    # 测试数据库连接
    if mysql -u root -pTeaching2026 -e "SELECT 1;" > /dev/null 2>&1; then
        info "MySQL 连接正常，无需修复"
        return 0
    fi
    
    warn "检测到 MySQL 认证问题，开始修复..."
    
    # 方法1：尝试使用 sudo mysql
    if sudo mysql -e "SELECT 1;" > /dev/null 2>&1; then
        info "使用 sudo mysql 修复认证..."
        sudo mysql <<'MYSQL_EOF'
ALTER USER 'root'@'localhost' IDENTIFIED BY 'Teaching2026';
FLUSH PRIVILEGES;
MYSQL_EOF
        
        # 验证修复
        if mysql -u root -pTeaching2026 -e "SELECT 1;" > /dev/null 2>&1; then
            info "MySQL 认证修复成功（方法1）"
            return 0
        fi
    fi
    
    # 方法2：使用跳过权限表方式
    warn "方法1失败，尝试跳过权限表方式..."
    
    # 创建必要的目录
    mkdir -p /var/run/mysqld
    chown mysql:mysql /var/run/mysqld 2>/dev/null || true
    
    # 停止 MySQL
    systemctl stop mysql 2>/dev/null || true
    sleep 2
    
    # 停止可能还在运行的 MySQL 进程
    pkill -9 mysqld 2>/dev/null || true
    pkill -9 mysqld_safe 2>/dev/null || true
    sleep 2
    
    # 以跳过权限表模式启动
    info "以跳过权限表模式启动 MySQL..."
    mysqld_safe --skip-grant-tables --skip-networking > /dev/null 2>&1 &
    sleep 8
    
    # 修改认证方式
    mysql -u root <<'MYSQL_EOF' 2>/dev/null || true
USE mysql;
UPDATE user SET authentication_string='', plugin='mysql_native_password' WHERE User='root' AND Host='localhost';
FLUSH PRIVILEGES;
EXIT;
MYSQL_EOF
    
    # 停止跳过权限表的 MySQL
    pkill -9 mysqld 2>/dev/null || true
    pkill -9 mysqld_safe 2>/dev/null || true
    sleep 2
    
    # 正常启动 MySQL
    systemctl start mysql
    sleep 3
    
    # 设置密码
    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'Teaching2026';" 2>/dev/null || true
    
    # 验证修复
    if mysql -u root -pTeaching2026 -e "SELECT 1;" > /dev/null 2>&1; then
        info "MySQL 认证修复成功（方法2）"
        return 0
    else
        error "MySQL 认证修复失败，请手动修复"
        return 1
    fi
}

# 函数：确保数据库存在
ensure_database() {
    info "确保数据库存在..."
    
    if mysql -u root -pTeaching2026 -e "USE $DB_NAME;" > /dev/null 2>&1; then
        info "数据库 $DB_NAME 已存在"
    else
        info "创建数据库 $DB_NAME..."
        mysql -u root -pTeaching2026 <<MYSQL_EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
MYSQL_EOF
        info "数据库创建完成"
    fi
}

# 步骤0：停止现有服务
stop_existing_services

# 步骤1：更新系统
info "步骤1: 更新系统包..."
apt update -qq
apt upgrade -y -qq

# 步骤2：安装 Node.js
if ! check_command node; then
    info "步骤2: 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
    apt install -y nodejs > /dev/null 2>&1
    info "Node.js 版本: $(node --version)"
else
    info "Node.js 已安装: $(node --version)"
fi

# 步骤3：安装 MySQL
if ! check_command mysql; then
    info "步骤3: 安装 MySQL..."
    apt install -y mysql-server > /dev/null 2>&1
    systemctl start mysql
    systemctl enable mysql > /dev/null 2>&1
    info "MySQL 已安装"
else
    info "MySQL 已安装"
    # 如果 MySQL 已安装，确保服务运行
    if ! systemctl is-active --quiet mysql; then
        info "启动 MySQL 服务..."
        systemctl start mysql
        sleep 3
    fi
fi

# 步骤4：安装 Nginx
if ! check_command nginx; then
    info "步骤4: 安装 Nginx..."
    apt install -y nginx > /dev/null 2>&1
    systemctl start nginx
    systemctl enable nginx > /dev/null 2>&1
    info "Nginx 已安装"
else
    info "Nginx 已安装"
fi

# 步骤5：安装 PM2
if ! check_command pm2; then
    info "步骤5: 安装 PM2..."
    npm install -g pm2 > /dev/null 2>&1
    info "PM2 已安装"
else
    info "PM2 已安装"
fi

# 步骤6：创建项目目录
info "步骤6: 创建项目目录..."
mkdir -p $PROJECT_DIR
info "项目目录: $PROJECT_DIR"

# 步骤7：检查项目文件
info "步骤7: 检查项目文件..."
if [ ! -f "$BACKEND_DIR/package.json" ]; then
    error "未找到项目文件！请先将项目文件上传到 $PROJECT_DIR"
    echo "可以使用以下命令上传："
    echo "  scp -r /本地项目路径/* root@服务器IP:$PROJECT_DIR/"
    exit 1
fi
info "项目文件检查通过"

# 步骤8：安装后端依赖
info "步骤8: 安装后端依赖..."
cd $BACKEND_DIR
if [ ! -d "node_modules" ]; then
    npm install
    info "依赖安装完成"
else
    info "依赖已存在，跳过安装"
fi

# 步骤9：修复 MySQL 并配置数据库
info "步骤9: 配置 MySQL 数据库..."

# 首先修复 MySQL 进程冲突
if ! fix_mysql_process_conflict; then
    error "MySQL 进程冲突修复失败"
    warn "请手动检查 MySQL 状态: systemctl status mysql"
    warn "查看错误日志: tail -50 /var/log/mysql/error.log"
    exit 1
fi

# 修复 MySQL 认证问题
if ! fix_mysql_auth; then
    error "MySQL 认证修复失败，请手动修复后重新运行脚本"
    echo "参考: server-deploy/MySQL修复指南.txt"
    exit 1
fi

# 确保数据库存在
ensure_database

# 步骤10：初始化数据库
info "步骤10: 初始化数据库..."
cd $BACKEND_DIR
if [ -f "init-db.js" ]; then
    if node init-db.js 2>/dev/null; then
        info "数据库表初始化成功"
    else
        warn "数据库表可能已存在，继续..."
    fi
fi
if [ -f "init-topics.js" ]; then
    if node init-topics.js 2>/dev/null; then
        info "任务配置初始化成功"
    else
        warn "任务配置可能已存在，继续..."
    fi
fi

# 步骤11：检查配置文件（已预配置，跳过手动修改）
info "步骤11: 检查配置文件..."
if [ -f "$BACKEND_DIR/db.js" ]; then
    if grep -q "password: 'Teaching2026'" "$BACKEND_DIR/db.js" 2>/dev/null; then
        info "数据库配置已正确"
    else
        warn "数据库配置可能需要检查: $BACKEND_DIR/db.js"
    fi
fi

if [ -f "$FRONTEND_DIR/js/config.js" ]; then
    if grep -q "http://113.47.7.91" "$FRONTEND_DIR/js/config.js" 2>/dev/null; then
        info "前端 API 配置已正确"
    else
        warn "前端 API 配置可能需要检查: $FRONTEND_DIR/js/config.js"
    fi
fi

# 步骤12：配置 Nginx
info "步骤13: 配置 Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/ai-teaching-lab"
if [ ! -f "$NGINX_CONFIG" ]; then
    cat > $NGINX_CONFIG << 'EOF'
server {
    listen 80;
    server_name 113.47.7.91;  # 修改为你的域名或IP

    # 静态文件（优先匹配，使用正则确保优先级）
    location ~ \.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/ai-teaching-lab/src/frontend;
        try_files $uri =404;
        expires 1h;
        add_header Cache-Control "public";
    }

    # 前端静态文件目录
    location / {
        root /var/www/ai-teaching-lab/src/frontend;
        index cplus.html;
        try_files $uri $uri/ /cplus.html;
    }

    # 后端 API 代理
    location ~ ^/(login|verify|chat|progress|messages|admin|topics|events|keywords|concepts) {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 流式响应支持
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
EOF
    info "Nginx 配置文件已创建: $NGINX_CONFIG"
    
    # 启用配置
    ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/ai-teaching-lab
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    if nginx -t; then
        systemctl reload nginx
        info "Nginx 配置已启用"
    else
        error "Nginx 配置测试失败，请检查配置文件"
        exit 1
    fi
else
    info "Nginx 配置文件已存在"
fi

# 步骤13：配置防火墙
info "步骤14: 配置防火墙..."
if check_command ufw; then
    ufw allow 22/tcp > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    info "防火墙规则已配置（UFW）"
    warn "请确保华为云安全组也开放了相应端口"
elif check_command firewall-cmd; then
    firewall-cmd --permanent --add-port=22/tcp > /dev/null 2>&1
    firewall-cmd --permanent --add-port=80/tcp > /dev/null 2>&1
    firewall-cmd --permanent --add-port=443/tcp > /dev/null 2>&1
    firewall-cmd --reload > /dev/null 2>&1
    info "防火墙规则已配置（firewalld）"
else
    warn "未检测到防火墙工具，请手动配置防火墙"
fi

# 步骤14：启动服务
info "步骤14: 启动服务..."

# 启动 Nginx
info "启动 Nginx..."
systemctl start nginx
systemctl enable nginx > /dev/null 2>&1
if systemctl is-active --quiet nginx; then
    info "Nginx 启动成功"
else
    error "Nginx 启动失败，请检查: systemctl status nginx"
fi

# 启动后端服务
info "启动后端服务..."
cd $BACKEND_DIR

# 确保服务已停止（双重保险）
pm2 stop $PM2_APP_NAME > /dev/null 2>&1 || true
pm2 delete $PM2_APP_NAME > /dev/null 2>&1 || true

# 启动服务
pm2 start server.js --name $PM2_APP_NAME
pm2 save

# 设置开机自启
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || warn "PM2 开机自启配置可能需要手动执行"

info "后端服务已启动"
pm2 status

# 步骤15：验证服务
info "步骤15: 验证服务..."
sleep 5

# 检查后端服务
info "检查后端服务..."
if curl -s http://localhost:3000/topics/current > /dev/null 2>&1; then
    info "✓ 后端服务运行正常"
else
    warn "后端服务可能未正常启动"
    warn "查看日志: pm2 logs $PM2_APP_NAME"
    warn "检查数据库连接是否正常"
fi

# 检查 Nginx
if systemctl is-active --quiet nginx; then
    info "✓ Nginx 运行正常"
else
    error "Nginx 未运行，请检查: systemctl status nginx"
fi

# 检查数据库连接
info "检查数据库连接..."
if mysql -u root -pTeaching2026 -e "USE $DB_NAME; SELECT 1;" > /dev/null 2>&1; then
    info "✓ 数据库连接正常"
else
    warn "数据库连接可能有问题，请检查配置"
fi

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "访问地址："
echo "  前端页面: http://113.47.7.91/cplus.html"
echo "  管理员页面: http://113.47.7.91/admin.html"
echo ""
echo "常用命令："
echo "  查看后端日志: pm2 logs $PM2_APP_NAME"
echo "  重启后端: pm2 restart $PM2_APP_NAME"
echo "  重启 Nginx: systemctl restart nginx"
echo "  查看 Nginx 日志: tail -f /var/log/nginx/error.log"
echo ""
echo "请确保："
echo "1. 数据库密码已正确配置"
echo "2. 前端 API 地址已修改"
echo "3. 华为云安全组已开放 80、443 端口"
echo ""

