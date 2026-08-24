#!/usr/bin/env bash
# ==============================================================================
# GECX Real-Time Voice Streaming - 리소스 안전 정리(Cleanup) 스크립트
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${YELLOW}🧹 GECX PoC 리소스 정리를 시작합니다...${NC}"
echo -e "${BLUE}======================================================${NC}"

# Load .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null || true)
fi

PROJECT_ID=${PROJECT_ID:-"gemeni-workshop"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"gecx-streaming-bff"}
GATEWAY_ID=${GATEWAY_ID:-"gecx-agent-gateway"}
API_ID="gecx-streaming-api"

read -p "정말로 [${PROJECT_ID}] 프로젝트의 Cloud Run 및 API Gateway 리소스를 삭제하시겠습니까? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${YELLOW}작업이 취소되었습니다.${NC}"
    exit 0
fi

# 1. Delete API Gateway
echo -e "\n${BLUE}🗑️  API Gateway (${GATEWAY_ID}) 삭제 중...${NC}"
gcloud api-gateway gateways delete "${GATEWAY_ID}" --location="${REGION}" --project="${PROJECT_ID}" --quiet 2>/dev/null || {
    echo -e "${YELLOW}Gateway가 이미 삭제되었거나 존재하지 않습니다.${NC}"
}

# 2. Delete API Resource
echo -e "${BLUE}🗑️  API Gateway API (${API_ID}) 삭제 중...${NC}"
gcloud api-gateway apis delete "${API_ID}" --project="${PROJECT_ID}" --quiet 2>/dev/null || {
    echo -e "${YELLOW}API 리소스가 이미 삭제되었거나 존재하지 않습니다.${NC}"
}

# 3. Delete Cloud Run Service
echo -e "${BLUE}🗑️  Cloud Run 서비스 (${SERVICE_NAME}) 삭제 중...${NC}"
gcloud run services delete "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --quiet 2>/dev/null || {
    echo -e "${YELLOW}Cloud Run 서비스가 이미 삭제되었거나 존재하지 않습니다.${NC}"
}

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 모든 PoC 리소스가 안전하게 정리되었습니다.${NC}"
echo -e "${BLUE}======================================================${NC}"
