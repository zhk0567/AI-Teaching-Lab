#!/bin/bash
# Comprehensive backend service test script

echo "=========================================="
echo "Backend Service Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test MySQL connection
echo "1. Testing MySQL connection..."
if mysql -u root -pTeaching2026 -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MySQL connection OK${NC}"
else
    echo -e "${RED}✗ MySQL connection failed${NC}"
    exit 1
fi

# Test database
echo "2. Testing database..."
if mysql -u root -pTeaching2026 -e "USE ai_teaching_lab; SELECT COUNT(*) FROM daily_topics;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database and tables exist${NC}"
else
    echo -e "${YELLOW}⚠ Database or tables missing${NC}"
fi

# Check backend service status
echo "3. Backend service status..."
pm2 status | grep ai-teaching-backend

# Test /topics/current endpoint
echo "4. Testing /topics/current endpoint..."
RESPONSE=$(curl -s http://localhost:3000/topics/current 2>&1)
if echo "$RESPONSE" | grep -q "topic_name\|topic_id"; then
    echo -e "${GREEN}✓ Endpoint OK, database connected${NC}"
elif echo "$RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗ Endpoint returned error${NC}"
    echo "Response: $RESPONSE" | head -3
else
    echo -e "${RED}✗ Endpoint not responding${NC}"
fi

# Test /login endpoint
echo "5. Testing /login endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' 2>&1)
if echo "$RESPONSE" | grep -q "success\|token"; then
    echo -e "${GREEN}✓ Login endpoint OK${NC}"
elif echo "$RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠ Login endpoint returned: $RESPONSE${NC}" | head -3
else
    echo -e "${RED}✗ Login endpoint not responding${NC}"
fi

# Test /verify endpoint
echo "6. Testing /verify endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"test"}' 2>&1)
if echo "$RESPONSE" | grep -q "error\|success"; then
    echo -e "${GREEN}✓ Verify endpoint accessible${NC}"
else
    echo -e "${RED}✗ Verify endpoint not responding${NC}"
fi

# Test Nginx proxy
echo "7. Testing Nginx proxy..."
RESPONSE=$(curl -s http://localhost/topics/current 2>&1)
if echo "$RESPONSE" | grep -q "topic_name\|topic_id"; then
    echo -e "${GREEN}✓ Nginx proxy OK${NC}"
elif echo "$RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠ Nginx proxy returned: $RESPONSE${NC}" | head -3
else
    echo -e "${RED}✗ Nginx proxy failed${NC}"
fi

# Test static files
echo "8. Testing static files..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost/admin.html | grep -q "200"; then
    echo -e "${GREEN}✓ admin.html accessible${NC}"
else
    echo -e "${RED}✗ admin.html not accessible${NC}"
fi

echo ""
echo "=========================================="
echo "Test completed"
echo "=========================================="

