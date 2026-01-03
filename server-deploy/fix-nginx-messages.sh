#!/bin/bash

# 快速修复 Nginx 配置，添加 /messages 路由

NGINX_CONFIG="/etc/nginx/sites-available/ai-teaching-lab"

if [ ! -f "$NGINX_CONFIG" ]; then
    echo "错误: Nginx 配置文件不存在: $NGINX_CONFIG"
    exit 1
fi

echo "正在更新 Nginx 配置..."

# 备份原配置
cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# 检查是否已包含 messages
if grep -q "messages|" "$NGINX_CONFIG"; then
    echo "配置已包含 messages，无需更新"
else
    # 更新配置：在 location 正则表达式中添加 messages
    sed -i 's|location ~ \^/(login|verify|chat|progress|admin|topics|events|keywords|concepts)|location ~ ^/(login|verify|chat|progress|messages|admin|topics|events|keywords|concepts)|g' "$NGINX_CONFIG"
    
    # 如果是更精确的正则表达式（fix.sh 中的格式）
    sed -i 's|location ~ \^/(login|verify|chat|progress|admin/users|admin/set-progress|admin/set-quota|admin/reset-status|admin/trigger-daily-reset|topics/current|events/track|keywords/save|keywords/delete|keywords/list|concepts/save|concepts/list)\$|location ~ ^/(login|verify|chat|progress|messages|admin/users|admin/set-progress|admin/set-quota|admin/reset-status|admin/trigger-daily-reset|topics/current|events/track|keywords/save|keywords/delete|keywords/list|concepts/save|concepts/list)$|g' "$NGINX_CONFIG"
    
    echo "配置已更新"
fi

# 测试配置
if nginx -t > /dev/null 2>&1; then
    systemctl reload nginx
    echo "✓ Nginx 配置已重载"
    echo ""
    echo "请清除浏览器缓存并刷新页面测试"
else
    echo "✗ Nginx 配置测试失败"
    nginx -t
    echo ""
    echo "正在恢复备份..."
    cp "${NGINX_CONFIG}.backup."* "$NGINX_CONFIG" 2>/dev/null || true
    exit 1
fi

