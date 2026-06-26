#!/bin/bash
set -e

# ============================================================
# Cloud Agent — 腾讯云一键部署脚本
# 用法: bash deploy.sh
# 前置: 购买腾讯云轻量服务器 (建议 2核2G 以上, Ubuntu 22.04)
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

REPO_URL="https://github.com/yanlibiao/cloud-agent.git"
INSTALL_DIR="/opt/cloud-agent"
DOMAIN="${1:-localhost}"

# ----- 1. 系统依赖 -----
log "更新系统包..."
apt-get update -qq

log "安装依赖: Python3, Node.js, nginx, git, supervisor..."
apt-get install -y -qq python3 python3-pip python3-venv nodejs npm nginx git supervisor curl

# ----- 2. 拉取代码 -----
log "拉取最新代码到 $INSTALL_DIR ..."
rm -rf "$INSTALL_DIR"
git clone --depth=1 "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ----- 3. 后端安装 -----
log "配置 Python 虚拟环境..."
python3 -m venv venv
source venv/bin/activate

log "安装 Python 依赖..."
cd backend
pip install --quiet -e ".[dev]"
cd ..

# ----- 4. 前端构建 -----
log "安装前端依赖并构建..."
cd frontend
npm install --silent
npx vite build
cd ..

# ----- 5. 配置 .env -----
if [ ! -f backend/.env ]; then
  warn "backend/.env 不存在，正在创建..."
  cat > backend/.env << 'ENVEOF'
# LLM (必填: 至少填一个)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# 如果使用 DeepSeek，注释上面三行，取消下面注释:
# OPENAI_API_KEY=your-deepseek-api-key-here
# OPENAI_BASE_URL=https://api.deepseek.com/v1
# LLM_MODEL=deepseek-chat

# 安全 (务必修改!)
JWT_SECRET=$(openssl rand -hex 32)

# 数据库 (默认 SQLite, 存在 backend/data/ 下)
DATABASE_URL=sqlite+aiosqlite:///./data/cloud_agent.db
ENVEOF
  log "已创建 backend/.env — 请用 vim 编辑填入你的 API Key"
  log "命令: vim $INSTALL_DIR/backend/.env"
fi

# ----- 6. 创建 supervisor 配置 (后端进程守护) -----
log "配置 supervisor..."
cat > /etc/supervisor/conf.d/cloud-agent-backend.conf << SUPEOF
[program:cloud-agent-backend]
command=$INSTALL_DIR/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
directory=$INSTALL_DIR/backend
user=root
autostart=true
autorestart=true
stopwaitsecs=5
stdout_logfile=/var/log/cloud-agent-backend.log
stderr_logfile=/var/log/cloud-agent-backend.err.log
SUPEOF

# ----- 7. 配置 nginx -----
log "配置 nginx..."
cat > /etc/nginx/sites-available/cloud-agent << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # gzip 压缩前端资源
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # 前端静态文件
    root $INSTALL_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket 反向代理
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/cloud-agent /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 检查 nginx 配置
nginx -t || { err "nginx 配置有误，请检查"; exit 1; }

# ----- 8. 启动服务 -----
log "重启 nginx..."
systemctl restart nginx

log "重启 supervisor (启动后端)..."
supervisorctl reread
supervisorctl update
supervisorctl start cloud-agent-backend

# ----- 9. 检查状态 -----
log "检查服务状态..."
sleep 2
if supervisorctl status cloud-agent-backend | grep -q RUNNING; then
  log "后端运行中"
else
  warn "后端未运行，请检查: supervisorctl status cloud-agent-backend"
fi

if systemctl is-active --quiet nginx; then
  log "nginx 运行中"
else
  warn "nginx 异常: systemctl status nginx"
fi

# ----- 10. 输出信息 -----
IP=$(curl -s ifconfig.me 2>/dev/null || echo "你的服务器IP")

echo ""
echo "=============================================="
echo -e "${GREEN}  部署完成!${NC}"
echo "=============================================="
echo ""
echo -e "  访问地址:   ${GREEN}http://$IP${NC}"
echo ""
echo -e "  后端端口:   8000 (仅监听 127.0.0.1, 通过 nginx 代理)"
echo ""
echo -e "  重要路径:"
echo -e "    代码:           $INSTALL_DIR"
echo -e "    .env 配置:      $INSTALL_DIR/backend/.env"
echo -e "    后端日志:       /var/log/cloud-agent-backend.log"
echo ""
echo -e "  ${YELLOW}!!! 部署后必做 !!!${NC}"
echo -e "  1. 编辑 ${YELLOW}$INSTALL_DIR/backend/.env${NC} 填入你的 API Key"
echo -e "  2. 保存后重启后端: ${YELLOW}supervisorctl restart cloud-agent-backend${NC}"
echo ""
echo "=============================================="
