#!/bin/bash
# Quick fix script for common deployment issues

echo "=========================================="
echo "Quick Fix Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Fix MySQL
info "Step 1: Fixing MySQL..."
systemctl stop mysql 2>/dev/null
pkill -9 mysqld mysqld_safe 2>/dev/null
sleep 3
rm -f /var/lib/mysql/*.pid /var/lib/mysql/ibdata1.lock 2>/dev/null
rm -f /var/run/mysqld/*.pid /var/run/mysqld/*.sock* 2>/dev/null
mkdir -p /var/run/mysqld
chown mysql:mysql /var/run/mysqld 2>/dev/null || true
systemctl start mysql
sleep 5

if systemctl is-active --quiet mysql; then
    info "MySQL started"
    if mysql -u root -pTeaching2026 -e "SELECT 1;" > /dev/null 2>&1; then
        info "MySQL connection OK"
    else
        warn "MySQL connection failed, fixing authentication..."
        sudo mysql <<'EOF' 2>/dev/null
ALTER USER 'root'@'localhost' IDENTIFIED BY 'Teaching2026';
FLUSH PRIVILEGES;
EOF
        mysql -u root -pTeaching2026 -e "SELECT 1;" > /dev/null 2>&1 && info "MySQL auth fixed" || error "MySQL auth fix failed"
    fi
else
    error "MySQL failed to start"
    tail -20 /var/log/mysql/error.log 2>/dev/null
fi

# 2. Fix Nginx configuration
info "Step 2: Fixing Nginx configuration..."
if [ -f /etc/nginx/sites-available/ai-teaching-lab ]; then
    cp /etc/nginx/sites-available/ai-teaching-lab /etc/nginx/sites-available/ai-teaching-lab.bak.$(date +%Y%m%d_%H%M%S)
fi

cat > /etc/nginx/sites-available/ai-teaching-lab << 'EOF'
server {
    listen 80;
    server_name 113.47.7.91;

    # Static files (priority match)
    location ~ \.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/ai-teaching-lab/src/frontend;
        try_files $uri =404;
        expires 1h;
        add_header Cache-Control "public";
    }

    # Frontend directory
    location / {
        root /var/www/ai-teaching-lab/src/frontend;
        index cplus.html;
        try_files $uri $uri/ /cplus.html;
    }

    # Backend API proxy (precise regex)
    location ~ ^/(login|verify|chat|progress|messages|admin/users|admin/set-progress|admin/set-quota|admin/reset-status|admin/trigger-daily-reset|topics/current|events/track|keywords/save|keywords/delete|keywords/list|concepts/save|concepts/list)$ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
EOF

if nginx -t > /dev/null 2>&1; then
    systemctl reload nginx
    info "Nginx configuration updated"
else
    error "Nginx configuration syntax error"
    nginx -t
fi

# 3. Restart backend
info "Step 3: Restarting backend..."
pm2 stop ai-teaching-backend > /dev/null 2>&1
pm2 delete ai-teaching-backend > /dev/null 2>&1
cd /var/www/ai-teaching-lab/src/backend
pm2 start server.js --name ai-teaching-backend
pm2 save
sleep 5

# 4. Verify services
info "Step 4: Verifying services..."
echo ""
echo "Service Status:"
echo "  MySQL: $(systemctl is-active mysql 2>/dev/null || echo 'not running')"
echo "  Backend: $(pm2 list | grep ai-teaching-backend | awk '{print $10}' || echo 'not running')"
echo "  Nginx: $(systemctl is-active nginx 2>/dev/null || echo 'not running')"
echo ""

# 5. Test
info "Step 5: Testing..."
if curl -s http://localhost:3000/topics/current > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API OK${NC}"
else
    echo -e "${RED}✗ Backend API failed${NC}"
    pm2 logs ai-teaching-backend --lines 20 --nostream
fi

if curl -s http://localhost/topics/current > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx proxy OK${NC}"
else
    echo -e "${RED}✗ Nginx proxy failed${NC}"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost/admin.html | grep -q "200"; then
    echo -e "${GREEN}✓ admin.html accessible${NC}"
else
    echo -e "${RED}✗ admin.html not accessible${NC}"
fi

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Frontend: http://113.47.7.91/cplus.html"
echo "  Admin: http://113.47.7.91/admin.html"
echo ""

