# Cloud Agent — 云原生 AI 编程助手

浏览器里的 AI 开发者。打开网页，输入需求，云沙箱自动完成从写代码到部署的全流程。

## 快速开始

### 1. 设置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入你的 OpenAI API Key
```

### 2. 启动（无需 Docker）

```bash
# 终端 1：启动后端
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# 终端 2：启动前端
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173

### 3. 使用 Docker 沙箱（可选）

```bash
# 构建沙箱镜像
docker build -t cloud-agent-sandbox sandbox/

# 启动完整服务
docker compose up
```

## 架构

```
Frontend (React + Vite) ──WebSocket── Backend (FastAPI) ──Sandbox (Local/Docker)
      │                          │                            │
  Monaco Editor              Agent Loop                  Workspace dir
  xterm.js Terminal          Tool Registry               /tmp/agent-workspaces/
  Chat Panel                 LLM Client (OpenAI)
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + TailwindCSS |
| 后端 | Python FastAPI + OpenAI SDK |
| 沙箱 | Docker 容器 (per-session) / 本地 subprocess (dev) |
| 通信 | WebSocket (NDJSON 事件流) |

## 项目结构

```
cloud-agent/
├── frontend/          # React 前端
├── backend/           # FastAPI 后端
├── sandbox/           # Docker 沙箱镜像
├── docker-compose.yml # Docker 编排
└── Makefile           # 开发快捷指令
```
