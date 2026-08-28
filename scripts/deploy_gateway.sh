#!/usr/bin/env bash
# ==============================================================================
# GECX Real-Time Voice Streaming - Google Cloud API Gateway 배포 스크립트
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}🌐 Google Cloud API Gateway 배포를 시작합니다...${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Load .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null || true)
fi

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" = "your-gcp-project-id" ]; then
    PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
fi
if [ -z "${PROJECT_ID}" ]; then
    echo -e "${RED}❌ GCP Project ID가 설정되지 않았습니다. gcloud config set project [PROJECT_ID] 또는 .env를 확인하세요.${NC}"
    exit 1
fi

REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"gecx-streaming-bff"}
GATEWAY_ID=${GATEWAY_ID:-"gecx-agent-gateway"}
API_ID="gecx-streaming-api"
CONFIG_ID="gecx-cfg-$(date +%Y%m%d%H%M%S)"
GATEWAY_SA="gecx-gateway-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# 2. Get Cloud Run Service Host
echo -e "${BLUE}🔍 Cloud Run 서비스 호스트 주소 조회 중...${NC}"
RUN_HOST=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)" | sed 's|https://||' 2>/dev/null || true)

if [ -z "$RUN_HOST" ]; then
    echo -e "${RED}❌ Cloud Run 서비스를 찾을 수 없습니다. ./scripts/deploy_cloudrun.sh를 먼저 실행해주세요.${NC}"
    exit 1
fi
echo -e "${GREEN}✔ Cloud Run Target Host: ${RUN_HOST}${NC}"

# 3. Generate Temporary OpenAPI Spec with Resolved Backend Host
TEMP_SPEC="/tmp/openapi_spec_resolved.yaml"
sed "s|\${CLOUD_RUN_SERVICE_HOST}|${RUN_HOST}|g" api_gateway/openapi_gateway.yaml > "${TEMP_SPEC}"
echo -e "${GREEN}✔ OpenAPI 명세서에 백엔드 주소 바인딩 완료${NC}"

# 4. Create API Resource if not exists
if ! gcloud api-gateway apis describe "${API_ID}" --project="${PROJECT_ID}" --quiet &>/dev/null; then
    echo -e "\n${BLUE}➕ API Gateway API 리소스 생성: ${API_ID}${NC}"
    gcloud api-gateway apis create "${API_ID}" --project="${PROJECT_ID}" --quiet
fi

# 5. Create API Config
echo -e "\n${BLUE}⚙️  API Config 생성 중 (${CONFIG_ID})...${NC}"
gcloud api-gateway api-configs create "${CONFIG_ID}" \
    --api="${API_ID}" \
    --openapi-spec="${TEMP_SPEC}" \
    --backend-auth-service-account="${GATEWAY_SA}" \
    --project="${PROJECT_ID}" \
    --quiet

# 6. Deploy or Update Gateway
if ! gcloud api-gateway gateways describe "${GATEWAY_ID}" --location="${REGION}" --project="${PROJECT_ID}" --quiet &>/dev/null; then
    echo -e "\n${BLUE}🚀 신규 API Gateway 생성: ${GATEWAY_ID}${NC}"
    gcloud api-gateway gateways create "${GATEWAY_ID}" \
        --api="${API_ID}" \
        --api-config="${CONFIG_ID}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --quiet
else
    echo -e "\n${BLUE}🔄 기존 API Gateway 설정 업데이트 중: ${GATEWAY_ID}${NC}"
    gcloud api-gateway gateways update "${GATEWAY_ID}" \
        --api="${API_ID}" \
        --api-config="${CONFIG_ID}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --quiet
fi

# 7. Get Gateway Hostname
GATEWAY_HOST=$(gcloud api-gateway gateways describe "${GATEWAY_ID}" --location="${REGION}" --project="${PROJECT_ID}" --format="value(defaultHostname)" --quiet)

rm -f "${TEMP_SPEC}"

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 API Gateway 배포가 성공적으로 완료되었습니다!${NC}"
echo -e "👉 공개 Ingress 게이트웨이 주소: ${BLUE}https://${GATEWAY_HOST}${NC}"
echo -e "👉 세션 시작 API (REST):        ${BLUE}https://${GATEWAY_HOST}/api/v1/session/start${NC}"
echo -e "${BLUE}======================================================${NC}"
