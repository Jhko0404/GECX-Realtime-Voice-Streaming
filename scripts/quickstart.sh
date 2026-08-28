#!/usr/bin/env bash
# ==============================================================================
# GECX Real-Time Voice Streaming - 통합 원클릭 자동 배포 (Quickstart)
# ==============================================================================
# - 사용법: ./scripts/quickstart.sh [PROJECT_ID] [APP_ID] [REGION]
# - 동작:
#   1. GCP 프로젝트 및 필수 API 활성화 (Cloud Run, API Gateway, Artifact Registry, GECX)
#   2. 서비스 계정(BFF SA, Gateway SA) 및 IAM 최소 권한(Least Privilege) 자동 프로비저닝
#   3. Docker Multi-Stage Container 빌드 & Private Cloud Run BFF 배포
#   4. Google Cloud API Gateway Ingress 구성 & 라우팅 배포
#   5. 최종 배포 완료 검증 및 Gateway 접속 URL 안내
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo -e "${CYAN}==================================================================${NC}"
echo -e "${CYAN}🚀 [GECX Voice Streaming] Google Cloud 통합 원클릭 자동 배포${NC}"
echo -e "${CYAN}==================================================================${NC}"

# 1. 인자 처리 및 환경변수 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null || true)
fi

PROJECT_ID="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
APP_ID="${2:-${APP_ID:-}}"
REGION="${3:-${REGION:-us-central1}}"
LOCATION="${LOCATION:-us}"

if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" = "your-gcp-project-id" ]; then
    echo -e "${RED}❌ GCP Project ID가 지정되지 않았습니다.${NC}"
    echo -e "사용법: ./scripts/quickstart.sh [PROJECT_ID] [APP_ID] [REGION]"
    exit 1
fi

if [ -z "${APP_ID}" ] || [ "${APP_ID}" = "your-gecx-app-id" ]; then
    echo -e "${YELLOW}⚠️ CXAS App ID가 입력되지 않았습니다. 기본 Mock/Sandbox App ID를 사용합니다.${NC}"
    APP_ID="your-gecx-app-id"
fi

echo -e "📌 [배포 설정 정보]"
echo -e "  • GCP Project ID : ${GREEN}${PROJECT_ID}${NC}"
echo -e "  • CXAS App ID    : ${GREEN}${APP_ID}${NC}"
echo -e "  • Target Region  : ${GREEN}${REGION}${NC}"
echo -e "  • Location       : ${GREEN}${LOCATION}${NC}"
echo ""

# 2. 필수 API 활성화
echo -e "${BLUE}Step 1/4: 필수 Google Cloud API 활성화 점검...${NC}"
gcloud services enable \
    run.googleapis.com \
    apigateway.googleapis.com \
    servicemanagement.googleapis.com \
    servicecontrol.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    ces.googleapis.com \
    --project="${PROJECT_ID}" --quiet

echo -e "  ${GREEN}✔ 모든 필수 API 활성화 완료${NC}\n"

# 3. Cloud Run 비공개 BFF 배포
echo -e "${BLUE}Step 2/4: Private Cloud Run BFF 배포 진행...${NC}"
export PROJECT_ID="${PROJECT_ID}"
export APP_ID="${APP_ID}"
export REGION="${REGION}"
export LOCATION="${LOCATION}"

chmod +x scripts/deploy_cloudrun.sh
./scripts/deploy_cloudrun.sh

echo -e "  ${GREEN}✔ Private Cloud Run BFF 배포 완료${NC}\n"

# 4. API Gateway Ingress 배포
echo -e "${BLUE}Step 3/4: Google Cloud API Gateway Ingress 배포 진행...${NC}"
chmod +x scripts/deploy_gateway.sh
./scripts/deploy_gateway.sh

echo -e "  ${GREEN}✔ API Gateway Ingress 배포 완료${NC}\n"

# 5. 배포 완료 확인 및 요약
echo -e "${CYAN}==================================================================${NC}"
echo -e "${GREEN}🎉 [배포 성공] GECX Real-Time Voice Streaming 콘솔 배포 완료!${NC}"
echo -e "${CYAN}==================================================================${NC}"

GATEWAY_HOSTNAME=$(gcloud api-gateway gateways describe gecx-agent-gateway \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(defaultHostname)" 2>/dev/null || echo "")

if [ -n "${GATEWAY_HOSTNAME}" ]; then
    echo -e "🌐 **프로덕션 접속 엔드포인트**:"
    echo -e "   👉 ${GREEN}https://${GATEWAY_HOSTNAME}${NC}"
    echo ""
    echo -e "🔍 **상태 진단 엔드포인트**:"
    echo -e "   👉 ${CYAN}https://${GATEWAY_HOSTNAME}/api/v1/health${NC}"
else
    echo -e "ℹ️ Gateway 배포가 완료되었으나 호스트네임 조회가 지연될 수 있습니다."
    echo -e "   gcloud api-gateway gateways list --location=${REGION} 명령으로 확인하세요."
fi
echo -e "${CYAN}==================================================================${NC}"
