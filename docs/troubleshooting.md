# 🛠️ GECX 실시간 음성 스트리밍 시스템 - 트러블슈팅 및 해결 가이드 (Troubleshooting Guide)

본 문서는 **GECX Real-Time Voice Streaming** 아키텍처의 설계, 백엔드(BFF) 구현, GCP 클라우드 배포(Cloud Run / API Gateway), GECX 양방향 스트리밍(`BidiRunSession`) 연동 과정에서 발생한 핵심 이슈들과 그 해결 방안을 체계적으로 정리한 트러블슈팅 보고서입니다.

---

## 📑 목차
1. [인프라 및 자동화 배포 이슈](#1-인프라-및-자동화-배포-이슈)
2. [네트워크 및 보안/인증 이슈](#2-네트워크-및-보안인증-이슈)
3. [백엔드 애플리케이션 및 런타임 이슈](#3-백엔드-애플리케이션-및-런타임-이슈)
4. [GECX Upstream API 연동 이슈](#4-gecx-upstream-api-연동-이슈)
5. [오디오 스트리밍 및 장시간 세션 안정성 이슈](#5-오디오-스트리밍-및-장시간-세션-안정성-이슈)

---

## 1. 인프라 및 자동화 배포 이슈

### 🚨 Issue 1.1: API Gateway 비대화형 배포 블로킹 현상
* **증상**: `./scripts/deploy_gateway.sh` 실행 시 API Config 및 Gateway 생성 단계에서 스크립트가 멈추고 진행되지 않음.
* **원인 (Root Cause)**: `gcloud api-gateway` CLI 명령어가 비대화형(Non-interactive) 환경에서도 기본적으로 사용자 확인 프롬프트(`Y/n`)를 대기함.
* **해결 방법 (Solution)**:
  * [`scripts/deploy_gateway.sh`](../scripts/deploy_gateway.sh) 내 모든 `gcloud api-gateway` 명령어에 `--quiet` 옵션을 추가하여 무중단 자동화 배포 완료.
  ```bash
  gcloud api-gateway api-configs create "${CONFIG_ID}" \
      --api="${API_ID}" \
      --openapi-spec="${SPEC_FILE}" \
      --backend-auth-service-account="${GATEWAY_SA_EMAIL}" \
      --project="${PROJECT_ID}" \
      --quiet
  ```

---

### 🚨 Issue 1.2: Cloud Build 컨텍스트 업로드 용량 과다 및 빌드 지연
* **증상**: Cloud Run 컨테이너 빌드 시 업로드 용량이 92.4MB에 달해 빌드 시작까지 불필요한 네트워크 지연 발생.
* **원인 (Root Cause)**: 테스트용 5분 오디오 데이터셋(`tests/audio_dataset/*.wav`, 약 91MB) 및 가상환경(`.venv`)이 컨테이너 빌드 컨텍스트에 포함됨.
* **해결 방법 (Solution)**:
  * 루트 디렉토리에 [`.dockerignore`](../.dockerignore) 파일을 생성하여 불필요한 파일 제외.
  * 빌드 컨텍스트 크기를 **92.4MB $\rightarrow$ 948KB로 99% 절감**하여 빌드 속도 극대화.
  ```dockerignore
  .git/
  .venv/
  __pycache__/
  tests/
  node_modules/
  *.wav
  *.log
  ```

---

## 2. 네트워크 및 보안/인증 이슈

### 🚨 Issue 2.1: Cloud Run WebSocket 직접 진입 시 HTTP 403 Forbidden 거부
* **증상**: 클라이언트가 API Gateway로부터 발급받은 서명 티켓(`?ticket=...`)을 가지고 Cloud Run WebSocket(`wss://.../ws/stream`)에 연결할 때 `HTTP 403 Forbidden` 반환.
* **원인 (Root Cause)**: 
  * Cloud Run이 `--no-allow-unauthenticated`로 배포되어, Google IAM 토큰이 없는 브라우저의 WebSocket Upgrade 요청을 컨테이너 애플리케이션 진입 전 인프라 레이어에서 차단함.
* **해결 방법 (Solution)**:
  * Cloud Run에 `allUsers` 대상 `roles/run.invoker` 권한을 부여하고, 실제 인증 및 권한 검증은 애플리케이션의 **단기 서명 JWT 티켓(60초 TTL, `bff/auth.py`)**에서 전담하도록 2계층 보안 아키텍처 확립.
  ```bash
  gcloud run services add-iam-policy-binding gecx-streaming-bff \
      --region=us-central1 \
      --member="allUsers" \
      --role="roles/run.invoker" \
      --project=gemeni-workshop --quiet
  ```

---

## 3. 백엔드 애플리케이션 및 런타임 이슈

### 🚨 Issue 3.1: 예외 처리 블록의 `NameError: name 'websockets' is not defined`
* **증상**: WebSocket 스트림 연결 해제 시 백엔드 컨테이너에서 `NameError`가 발생하며 비정상 종료.
* **원인 (Root Cause)**: 
  * [`bff/main.py`](../bff/main.py)의 `gecx_to_client_loop`에서 `websockets.exceptions.ConnectionClosed` 예외를 캐치하도록 작성되었으나, 상단에 `import websockets` 임포트 구문이 누락됨.
* **해결 방법 (Solution)**:
  * [`bff/main.py`](../bff/main.py) 상단에 `import websockets`를 추가하고 컨테이너 재배포.

---

## 4. GECX Upstream API 연동 이슈

### 🚨 Issue 4.1: GECX `BidiRunSession` 호출 시 1008 Policy Violation (권한 부족)
* **증상**: Cloud Run BFF에서 `ces.googleapis.com`으로 WebSocket 연결 시 아래 에러와 함께 즉시 연결 종료:
  ```
  websockets.exceptions.ConnectionClosedError: received 1008 (policy violation) 
  Permission 'ces.sessions.bidiRunSession' denied on resource '//ces.googleapis.com/...'
  ```
* **원인 (Root Cause)**:
  * Cloud Run 실행 서비스 계정(`gecx-bff-sa`)에 기본 `roles/ces.invoker` 권한만 부여되어 있었으나, 실시간 양방향 세션(`BidiRunSession`) 생성에는 Dialogflow / Discovery Engine Admin 권한이 필요함.
* **해결 방법 (Solution)**:
  * `gecx-bff-sa` 서비스 계정에 `roles/dialogflow.admin` 및 `roles/discoveryengine.admin` IAM 역할을 바인딩.
  ```bash
  gcloud projects add-iam-policy-binding gemeni-workshop \
      --member="serviceAccount:gecx-bff-sa@gemeni-workshop.iam.gserviceaccount.com" \
      --role="roles/dialogflow.admin" --quiet

  gcloud projects add-iam-policy-binding gemeni-workshop \
      --member="serviceAccount:gecx-bff-sa@gemeni-workshop.iam.gserviceaccount.com" \
      --role="roles/discoveryengine.admin" --quiet
  ```

---

### 🚨 Issue 4.2: GECX 초기화 핸드쉐이크 시 `generic::not_found: ExternalException`
* **증상**: IAM 권한 설정 후에도 GECX 연결 직후 아래 에러와 함께 세션 단절:
  ```
  websockets.exceptions.ConnectionClosedError: received 1008 (policy violation)
  [ORIGINAL ERROR] generic::not_found: com.google.cloud.ai.ces.shared.exceptions.ExternalException
  ```
* **원인 (Root Cause)**:
  * 초기 핸드쉐이크(`SessionConfig`) 페이로드 전송 시 `"deployment": ".../deployments/default"`를 명시했으나, 대상 에이전트 앱에는 `default`라는 별도 배포 버전이 생성되어 있지 않고 초안(Draft) 환경만 존재하여 리소스 Not Found 발생.
* **해결 방법 (Solution)**:
  * [`bff/gecx_client.py`](../bff/gecx_client.py)에서 `deployment` 필드를 옵셔널하게 처리하도록 변경하여, 명시적인 버전이 없을 경우 기본 에이전트(Draft/Live)로 자동 라우팅되도록 수정.
  ```python
  # bff/gecx_client.py
  config_obj = {
      "session": f"{settings.gecx_app_resource_path}/sessions/{self.session_id}",
      "inputAudioConfig": {
          "audioEncoding": "LINEAR16",
          "sampleRateHertz": 16000,
          "enableEchoCancellation": True
      },
      "outputAudioConfig": {
          "audioEncoding": "LINEAR16",
          "sampleRateHertz": 16000
      }
  }
  # default나 draft인 경우 deployment 파라미터 생략하여 기본 앱 연결
  if settings.DEPLOYMENT_ID and settings.DEPLOYMENT_ID not in ("default", "draft", ""):
      config_obj["deployment"] = settings.gecx_deployment_resource_path
  ```

---

## 5. 오디오 스트리밍 및 장시간 세션 안정성 이슈

### 🚨 Issue 5.1: 80~120초 무음 구간 세션 단절 방지 및 Always-On 스트리밍
* **증상**: 음성 상담 도중 사용자가 말을 하지 않는 긴 침묵(Silence) 구간이 발생할 때 80~120초 사이에 업스트림 서버에서 `RFC 6455 Close Code 1006` 비정상 단절이 발생할 가능성 존재.
* **원인 (Root Cause)**:
  * GECX VAD 및 에코 캔슬러는 배경 잡음 추적 및 연결 유지를 위해 지속적인 오디오 프레임 유입을 기대하며, 패킷 전송이 중단되면 타임아웃으로 간주함.
* **해결 방법 (Solution)**:
  1. **Always-On 스트리밍 정책 적용**: 클라이언트(Web Audio Worklet) 및 합성기에서 무음 구간이어도 -48 dBFS 수준의 앰비언트 프레임을 **50ms(800 샘플, 1,600 바이트)** 주기로 끊김 없이 지속 전송.
  2. **RFC 6455 텔레메트리 & RCA 진단 체계 구축**: [`bff/telemetry.py`](../bff/telemetry.py)를 통해 80~120초 구간 단절 시 `GECX_80_120S_TIMEOUT`으로 즉각 분류하고 복구 가이드를 제공하는 진단 모달 연동.
  3. **실환경 5분 스트리밍 실증**: 10종의 5분(300초 / 6,000 청크) 합성 음성 데이터셋으로 벤치마크를 수행하여 무손실 연속 스트리밍 검증 완료.

---

## 📊 트러블슈팅 요약 매트릭스

| 영역 | 이슈 요약 | 근본 원인 | 해결 방안 | 적용 결과 |
| :--- | :--- | :--- | :--- | :---: |
| **인프라** | API Gateway 비대화형 대기 | CLI 확인 프롬프트 블로킹 | `--quiet` 플래그 추가 | 자동화 배포 완수 |
| **인프라** | Cloud Build 용량 과다 | 대용량 wav 파일 업로드 | `.dockerignore` 구성 | 빌드 컨텍스트 99% 절감 |
| **보안** | WebSocket 403 Forbidden | Cloud Run IAM 미인증 차단 | `allUsers` 권한 + JWT 티켓 인가 | 2계층 보안 확립 |
| **런타임** | `websockets` NameError | 모듈 임포트 누락 | `import websockets` 추가 | 런타임 크래시 해결 |
| **GECX** | 1008 Policy Violation | Service Account 권한 부족 | `dialogflow.admin` 바인딩 | API 세션 권한 획득 |
| **GECX** | 1008 Not Found | 불일치하는 deployment ID | deployment 파라미터 옵셔널화 | 초안/라이브 자동 연동 |
| **스트리밍**| 80~120s 침묵 단절 위험 | 무음 시 패킷 전송 중단 | 50ms Always-On + RCA 로깅 | 5분(300s) 연속 전송 성공 |
