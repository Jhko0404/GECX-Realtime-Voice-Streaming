#!/usr/bin/env bash
# ==============================================================================
# GECX Real-Time Voice Streaming - 환경 초기화 및 점검 스크립트
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}🔍 GECX Streaming API 환경 점검 및 초기화를 시작합니다...${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. gcloud CLI 설치 확인
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI가 설치되어 있지 않습니다.${NC}"
    echo "Google Cloud SDK를 먼저 설치해주세요: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
echo -e "${GREEN}✅ gcloud CLI: $(gcloud --version | head -n 1)${NC}"

# 2. gcloud 인증 상태 확인
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo -e "${YELLOW}⚠️  gcloud에 로그인된 활성 계정이 없습니다.${NC}"
    echo -e "👉 아래 명령어로 로그인을 먼저 진행해주세요:"
    echo -e "   ${BLUE}gcloud auth login${NC}"
    echo -e "   ${BLUE}gcloud auth application-default login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ gcloud 활성 계정: ${ACTIVE_ACCOUNT}${NC}"

# 3. .env 파일 확인 및 로드
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}⚠️  .env 파일이 없어 .env.example에서 복사하여 생성합니다.${NC}"
        cp .env.example .env
    else
        echo -e "${RED}❌ .env 및 .env.example 파일이 존재하지 않습니다.${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null || true)

PROJECT_ID=${PROJECT_ID:-"gemeni-workshop"}
echo -e "${GREEN}✅ 대상 GCP 프로젝트 ID: ${PROJECT_ID}${NC}"
gcloud config set project "${PROJECT_ID}" --quiet 2>/dev/null || true

# 4. 필수 GCP API 활성화 점검
echo -e "\n${BLUE}📦 필수 GCP API 활성화 상태 점검 중...${NC}"
REQUIRED_APIS=(
    "ces.googleapis.com"
    "run.googleapis.com"
    "apigateway.googleapis.com"
    "servicecontrol.googleapis.com"
    "servicemanagement.googleapis.com"
    "cloudbuild.googleapis.com"
    "artifactregistry.googleapis.com"
    "iam.googleapis.com"
    "iamcredentials.googleapis.com"
    "logging.googleapis.com"
)

APIS_TO_ENABLE=()
for api in "${REQUIRED_APIS[@]}"; do
    if gcloud services list --enabled --project="${PROJECT_ID}" --filter="config.name:${api}" --format="value(config.name)" 2>/dev/null | grep -q "${api}"; then
        echo -e "  ${GREEN}✔ ${api} (활성화됨)${NC}"
    else
        echo -e "  ${YELLOW}✖ ${api} (비활성화됨)${NC}"
        APIS_TO_ENABLE+=("${api}")
    fi
done

if [ ${#APIS_TO_ENABLE[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  비활성화된 필수 API들을 활성화합니다: ${APIS_TO_ENABLE[*]}${NC}"
    gcloud services enable "${APIS_TO_ENABLE[@]}" --project="${PROJECT_ID}" || {
        echo -e "${YELLOW}⚠️  일부 API 자동 활성화 권한이 부족할 수 있습니다. 관리자에게 활성화를 요청하세요.${NC}"
    }
fi

# 5. Python 가상 환경 확인
echo -e "\n${BLUE}🐍 Python 가상 환경 점검 중...${NC}"
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}⚠️  .venv 가상 환경을 생성합니다...${NC}"
    if command -v uv &> /dev/null; then
        uv venv .venv
        uv pip install -r requirements.txt --python .venv/bin/python
    elif [ -x "$HOME/.local/bin/uv" ]; then
        $HOME/.local/bin/uv venv .venv
        $HOME/.local/bin/uv pip install -r requirements.txt --python .venv/bin/python
    else
        python3 -m venv .venv
        .venv/bin/pip install --upgrade pip
        .venv/bin/pip install -r requirements.txt
    fi
fi
echo -e "${GREEN}✅ Python 가상 환경 준비 완료 (.venv)${NC}"

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 모든 환경 사전 점검 및 초기화가 완료되었습니다!${NC}"
echo -e "로컬 개발 및 테스트 실행:"
echo -e "👉 ${BLUE}./scripts/run_local.sh${NC}"
echo -e "${BLUE}======================================================${NC}"
