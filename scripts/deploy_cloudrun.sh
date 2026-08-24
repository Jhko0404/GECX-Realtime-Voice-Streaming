#!/usr/bin/env bash
# ==============================================================================
# GECX Real-Time Voice Streaming - Google Cloud Run 비공개 배포 스크립트
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
echo -e "${BLUE}🚀 Google Cloud Run 비공개(Private) 배포를 시작합니다...${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Load .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null || true)
fi

PROJECT_ID=${PROJECT_ID:-"gemeni-workshop"}
REGION=${REGION:-"us-central1"}
LOCATION=${LOCATION:-"us"}
APP_ID=${APP_ID:-"83281339-6a20-482e-8064-4cf96c678d76"}
SERVICE_NAME=${SERVICE_NAME:-"gecx-streaming-bff"}
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo -e "👉 GCP Project ID:  ${GREEN}${PROJECT_ID}${NC}"
echo -e "👉 Region:          ${GREEN}${REGION}${NC}"
echo -e "👉 Cloud Run Name:  ${GREEN}${SERVICE_NAME}${NC}"
echo -e "👉 CXAS App ID:     ${GREEN}${APP_ID}${NC}\n"

# 2. Service Accounts & IAM Setup
BFF_SA="gecx-bff-sa@${PROJECT_ID}.iam.gserviceaccount.com"
GATEWAY_SA="gecx-gateway-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo -e "${BLUE}🔑 서비스 어카운트 및 IAM 권한 점검 중...${NC}"

# Create BFF Service Account if not exists
if ! gcloud iam service-accounts describe "${BFF_SA}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "  ${YELLOW}➕ BFF 서비스 계정 생성: ${BFF_SA}${NC}"
    gcloud iam service-accounts create gecx-bff-sa \
        --display-name="GECX Streaming BFF Service Account" \
        --project="${PROJECT_ID}"
fi

# Assign roles to BFF SA
echo -e "  ${GREEN}✔ BFF SA에 roles/ces.invoker 및 roles/logging.logWriter 부여...${NC}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${BFF_SA}" \
    --role="roles/ces.invoker" \
    --condition=None --quiet 2>/dev/null || true

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${BFF_SA}" \
    --role="roles/logging.logWriter" \
    --condition=None --quiet 2>/dev/null || true

# Create Gateway Service Account if not exists
if ! gcloud iam service-accounts describe "${GATEWAY_SA}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "  ${YELLOW}➕ Gateway 서비스 계정 생성: ${GATEWAY_SA}${NC}"
    gcloud iam service-accounts create gecx-gateway-sa \
        --display-name="GECX Agent Gateway Invoker Account" \
        --project="${PROJECT_ID}"
fi

# 3. Build Container via Cloud Build
echo -e "\n${BLUE}🐳 Cloud Build를 통해 컨테이너 이미지를 빌드합니다...${NC}"
gcloud builds submit --tag "${IMAGE_NAME}" --project="${PROJECT_ID}" .

# 4. Deploy to Cloud Run (Private Ingress)
echo -e "\n${BLUE}🚀 Cloud Run에 비공개 서비스로 배포합니다...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --service-account="${BFF_SA}" \
    --no-allow-unauthenticated \
    --timeout=3600 \
    --concurrency=80 \
    --cpu=1 \
    --memory=1Gi \
    --set-env-vars="PROJECT_ID=${PROJECT_ID},LOCATION=${LOCATION},APP_ID=${APP_ID},REGION=${REGION},SERVICE_NAME=${SERVICE_NAME}" \
    --quiet

# 5. Grant run.invoker to Gateway SA & allUsers (for direct WebSocket ingress with JWT ticket)
echo -e "\n${BLUE}🔒 API Gateway(gecx-gateway-sa) 및 Data Plane WebSocket(allUsers)에 roles/run.invoker를 부여합니다...${NC}"
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${GATEWAY_SA}" \
    --role="roles/run.invoker" \
    --quiet

gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --quiet

# 6. Retrieve Service URL
RUN_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 Cloud Run 비공개 배포가 성공적으로 완료되었습니다!${NC}"
echo -e "👉 비공개 Service URL: ${BLUE}${RUN_URL}${NC}"
echo -e "다음 단계로 API Gateway를 배포하세요:"
echo -e "👉 ${BLUE}./scripts/deploy_gateway.sh${NC}"
echo -e "${BLUE}======================================================${NC}"
