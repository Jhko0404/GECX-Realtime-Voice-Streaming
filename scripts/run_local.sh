#!/usr/bin/env bash
# ==============================================================================
# GECX Real-Time Voice Streaming - 로컬 원클릭 실행 스크립트
# ==============================================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

# 1. Check Python virtualenv
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}⚠️  Python 가상환경이 없습니다. setup_env.sh를 먼저 실행합니다...${NC}"
    ./scripts/setup_env.sh
fi

source .venv/bin/activate

# 2. Check Mock Mode argument
MOCK_MODE=false
DISCONNECT_DELAY=90

for arg in "$@"; do
    if [ "$arg" == "--mock" ]; then
        MOCK_MODE=true
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
        DISCONNECT_DELAY="$arg"
    fi
done

if [ "$MOCK_MODE" = true ]; then
    echo -e "${BLUE}======================================================${NC}"
    echo -e "${YELLOW}🧪 [MOCK MODE] 로컬 Mock GECX 서버를 시작합니다... (단절 타이머: ${DISCONNECT_DELAY}초)${NC}"
    echo -e "${BLUE}======================================================${NC}"
    python3 tests/mock_gecx_server.py "${DISCONNECT_DELAY}" 1006 &
    MOCK_PID=$!
    export MOCK_GECX_ENDPOINT="ws://127.0.0.1:8765"

    cleanup() {
        echo -e "\n${YELLOW}🛑 서버를 종료합니다...${NC}"
        kill $MOCK_PID 2>/dev/null || true
        kill $BACKEND_PID 2>/dev/null || true
        exit 0
    }
    trap cleanup SIGINT SIGTERM
fi

# 3. Ensure frontend is built
if [ ! -d "web/dist" ]; then
    echo -e "${BLUE}📦 프론트엔드 빌드 중...${NC}"
    (cd web && npm run build)
fi

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🚀 GECX Streaming API BFF 콘솔을 구동합니다!${NC}"
echo -e "👉 웹 콘솔 접속 주소: ${BLUE}http://localhost:8080${NC}"
echo -e "👉 API 헬스체크:       ${BLUE}http://localhost:8080/health${NC}"
echo -e "${BLUE}======================================================${NC}\n"

# 4. Start FastAPI
uvicorn bff.main:app --host 0.0.0.0 --port 8080 --log-level info
