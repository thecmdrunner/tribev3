#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting TRIBE v2 services...${NC}"

# -------------------------------------------------------------------
# 1. Start Python inference API (port 8000)
# -------------------------------------------------------------------
echo -e "${YELLOW}[1/2] Starting Python API on :8000${NC}"

if [ ! -d "$DIR/.venv" ]; then
  echo "Error: Python venv not found at $DIR/.venv"
  echo "Run: uv venv --python 3.11 .venv && uv pip install -e '.[plotting]'"
  exit 1
fi

"$DIR/.venv/bin/uvicorn" scripts.api.main:app \
  --host 0.0.0.0 --port 8000 \
  --log-level info &
API_PID=$!

# -------------------------------------------------------------------
# 2. Start Next.js frontend (port 3000)
# -------------------------------------------------------------------
echo -e "${YELLOW}[2/2] Starting Next.js frontend on :3000${NC}"

# Ensure fnm/node is on PATH
export PATH="$HOME/.local/share/fnm:$PATH"
if command -v fnm &>/dev/null; then
  eval "$(fnm env)"
fi

if ! command -v node &>/dev/null; then
  echo "Error: Node.js not found. Install via: fnm install 22"
  kill $API_PID 2>/dev/null
  exit 1
fi

cd "$DIR/frontend"
# pnpm build && pnpm start --port 3000 &
# pnpm start --port 3000 &
pnpm dev --port 3003 &
FRONTEND_PID=$!
cd "$DIR"

# -------------------------------------------------------------------
# Cleanup on exit
# -------------------------------------------------------------------
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $API_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Frontend:  http://localhost:3000${NC}"
echo -e "${GREEN}  API:       http://localhost:8000${NC}"
echo -e "${GREEN}  API docs:  http://localhost:8000/docs${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Wait for either process to exit
wait
