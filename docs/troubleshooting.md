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
      --project=your-gcp-project-id --quiet
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
  gcloud projects add-iam-policy-binding your-gcp-project-id \
      --member="serviceAccount:gecx-bff-sa@your-gcp-project-id.iam.gserviceaccount.com" \
      --role="roles/dialogflow.admin" --quiet

  gcloud projects add-iam-policy-binding your-gcp-project-id \
      --member="serviceAccount:gecx-bff-sa@your-gcp-project-id.iam.gserviceaccount.com" \
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

### 🚨 Issue 5.2: API Gateway WebSocket 업그레이드 미지원 및 Data Plane 직접 라우팅
* **증상**: 브라우저에서 게이트웨이 도메인(`https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev/`) 접속 후 세션 연결 시 즉시 `RFC 6455 Close Code 1006` 단절 발생.
* **원인 (Root Cause)**:
  * Google Cloud API Gateway는 REST/HTTP 프록시 전용으로 동작하며, 양방향 스트리밍 프로토콜인 WebSocket (`Upgrade: websocket`)을 지원하지 않음.
  * 프론트엔드가 게이트웨이 호스트로 WebSocket 연결을 시도하면서 게이트웨이 레이어에서 연결이 즉각 강제 종료됨.
* **해결 방법 (Solution)**:
  1. **Control Plane과 Data Plane 엔드포인트 분리**:
     * Control Plane (`POST /api/v1/session/start`)은 보안 게이트웨이를 경유하여 단기 서명된 JWT 티켓 발급.
     * 발급 응답 시 `ws_endpoint`로 Cloud Run의 WSS URL(`wss://gecx-streaming-bff-cwljmdzpfa-uc.a.run.app/ws/stream`)을 반환.
  2. **프론트엔드 라우팅 자동화**:
     * [`web/src/services/websocket.ts`](../web/src/services/websocket.ts)에서 `gateway.dev` 도메인 감지 시 Cloud Run WSS 엔드포인트로 자동 라우팅.
  3. **연속 5회 E2E 라이브 검증 및 5분 벤치마크 완수**:
     * 실환경 게이트웨이 발급 + Cloud Run WSS 세션 5회 연속 연결 테스트 100% 성공.

---

## 6. GECX 1007 턴 충돌 및 오디오 스트림 안정성 이슈

### 🚨 Issue 6.1: 에이전트 발화 중 마이크 오디오 유입 시 `Code 1007 (generic::invalid_argument)` 턴 충돌
* **증상**: 에이전트가 음성(TTS)을 출력하는 동안 사용자의 마이크 소리(-28 dBFS)나 스피커 하울링이 유입될 때 업스트림 WebSocket이 즉시 `Code 1007`로 강제 단절됨.
* **원인 (Root Cause)**:
  * Google Cloud CES(Conversational Engine Service)의 턴 상태 머신은 `Agent Turn` 진행 중 클라이언트로부터 음성 유효 오디오 패킷이 들어올 경우, 상태 충돌로 판단하여 `generic::invalid_argument` 예외를 발생시키고 세션을 종료함.
* **해결 방법 (Solution)**:
  1. **Turn-Gated Safe Mode 상태 머신 구현 ([`App.tsx`](../web/src/App.tsx), [`types.ts`](../web/src/types.ts))**:
     * 에이전트 발화 시작 시 `turnState`를 `AGENT_TURN`으로 전환하고, 마이크 입력 신호를 100% 게이트(차단)하여 서버로 음성 신호가 유입되지 않도록 방어.
  2. **150ms 템포럴 안정화 버퍼**:
     * 에이전트 음성 출력이 끝난 후 즉시 마이크를 열지 않고, 150ms의 안정화 지연을 두어 CES 엔진의 내부 버퍼가 완전히 정리된 후 `USER_TURN`으로 전환.
  3. **동적 턴 상태 UI 및 제어 스위치 ([`Visualizer.tsx`](../web/src/components/Visualizer.tsx), [`ControlDeck.tsx`](../web/src/components/ControlDeck.tsx))**:
     * "Agent Speaking (Mic Muted)" ➔ "Your Turn - Speak Now (Listening)" 뱃지 표시 및 Google 4-Color 파형 연동.

---

### 🚨 Issue 6.2: 마이크 게이트 시 스트림 완전 단절로 인한 `Code 1007 (generic::failed_precondition)` 발생
* **증상**: Turn-Gated 모드 적용 후 긴 문장을 말하거나 마이크 입력을 차단했을 때, `last_chunk_sent_before_ms: 4812ms` 후 `generic::failed_precondition: com.google.cloud.ai.ces.shared.exception`과 함께 단절됨.
* **원인 (Root Cause)**:
  * GECX `BidiRunSession`은 16kHz 오디오 프레임이 4초 이상 완전히 끊기면(0 Byte Stream Starvation), 오디오 디코더 상태 머신에서 스트림 고갈로 인한 `failed_precondition` 예외를 발생시킴.
* **해결 방법 (Solution)**:
  * **연속 50ms 묵음 패킷(Silent PCM Frame) 전송 보장 ([`audio_recorder.ts`](../web/src/audio/audio_recorder.ts))**:
    * 마이크가 게이트된 상태(`AGENT_TURN`)에서도 패킷 송신을 멈추지 않고, **초당 20회(50ms 주기)의 안전한 묵음(Int16 zeros, -∞ dBFS) 패킷**을 지속 전송.
    * GECX 서버는 스트림 공백 없이 100% 정상 작동하며, 묵음 데이터이므로 턴 충돌(1007)도 완벽히 방지됨.

---

## 7. 대화 흐름 멈춤(Freeze) 및 턴 자동 복구 이슈

### 🚨 Issue 7.1: 긴 안내 멘트 수신 후 다음 사용자 발화 시 대화 멈춤 현상
* **증상**: 에이전트의 긴 안내(예: 334자 고지서 내역) 후 사용자가 말을 시작했으나 화면에 STT가 뜨지 않고 세션 진행이 멈춤.
* **원인 (Root Cause)**:
  * 클라이언트의 턴 복구 로직이 GECX 서버의 명시적인 `turnCompleted: true` 수신 여부에만 종속되어 있어, 사용자가 말하여 오디오를 플러시(`flush()`)했거나 서버 패킷 플래그 타이밍이 어긋났을 때 `AGENT_TURN`에 갇혀 마이크가 영구 Mute 됨.
* **해결 방법 (Solution)**:
  1. **스피커 무음 기준 자동 턴 복구 ([`App.tsx`](../web/src/App.tsx))**:
     * 서버의 `turnCompleted` 신호 도착 여부와 상관없이, 브라우저 스피커의 TTS 오디오 재생이 완료되면(`AudioPlayer.setOnPlaybackEnded`) 150ms 후 무조건 `USER_TURN`으로 안전 복구.
  2. **Barge-In 플러시 콜백 안정화 ([`audio_player.ts`](../web/src/audio/audio_player.ts))**:
     * 오디오 소스 강제 중단(`stop`) 시 고스트 `onended` 이벤트가 발생하지 않도록 `source.onended = null` 정리.

---

## 8. TTFT(Time-To-First-Token) 가속 및 실시간 스트리밍 UX 이슈

### 🚨 Issue 8.1: A2A 음성 스트리밍 환경에서 텍스트 덩어리 출력으로 인한 지연 체감
* **증상**: GECX 백엔드가 334자의 전체 텍스트 전사를 첫 패킷에 한 번에 내려보내고 음성은 16초 동안 천천히 재생되어, 텍스트가 스트리밍이 아니라 다 끝난 후 늦게 나오는 것처럼 느껴짐.
* **원인 (Root Cause)**:
  * GECX `BidiRunSession`은 오디오는 50ms씩 쪼개어 보내지만 텍스트는 문장/블록 단위로 전송하므로, 음성 재생 시간과 텍스트 노출 타이밍 간의 불일치 발생.
* **해결 방법 (Solution)**:
  1. **Sub-second TTFT 정밀 측정 파이프라인**:
     * 사용자 발화 완료(`isFinal: true`)부터 에이전트 첫 패킷 도달까지의 밀리초(ms)를 계산하여 `TelemetryStrip.tsx` 및 대화창 뱃지에 `TTFT: 280ms ⚡ Sub-second` 실시간 표출.
  2. **30ms 고속 단어 스트리머 구현 ([`ChatWindow.tsx`](../web/src/components/ChatWindow.tsx) `ProgressiveAgentText`)**:
     * 첫 패킷 도착 즉시 단어 단위로 쪼개어 30ms 간격으로 실시간 타이핑 커서와 함께 '두두두둑' 출력하여 극대화된 실시간 대화 UX 제공.

---

## 9. CX Agent Studio 프롬프트 엔지니어링 이슈

### 🚨 Issue 9.1: "안녕" 인사 시 "말씀이 잘 들리지 않았습니다" 에러 멘트 오작동
* **증상**: 사용자가 "안녕"이라고 인사했을 때 에이전트가 "안녕하세요... 말씀하신 내용이 잘 들리지 않았습니다"라고 오작동.
* **원인 (Root Cause)**:
  * 프롬프트의 Intent Detection에 단순 인사/스몰톡에 대한 명시적 분기 규칙이 없어, LLM이 '인식 실패'로 오판하여 Exception Handling을 발동함.
* **해결 방법 (Solution)**:
  * **프롬프트 턴 제어 최적화**:
    * 첫인사는 `First Turn Only`로 단 1회 한정.
    * "안녕/반가워" 등 스몰톡 시 친절하게 맞인사 후 본 질문으로 유도하는 `Intent_Classification` 규칙 보강.
    * 중복 번호 및 모호한 라우팅 단계 명확화.

---

## 📊 트러블슈팅 종합 매트릭스 (Master Matrix)

| 영역 | 이슈 코드/증상 | 근본 원인 | 해결 방안 | 적용 결과 |
| :--- | :--- | :--- | :--- | :--- |
| **인프라** | API Gateway 배포 멈춤 | 비대화형 CLI 프롬프트 블로킹 | `--quiet` 플래그 추가 | 자동화 배포 완수 |
| **인프라** | Cloud Build 92MB 지연 | wav/venv 업로드 과다 | `.dockerignore` 구성 | 컨텍스트 99% 절감 |
| **보안** | WebSocket 403 Forbidden | Cloud Run IAM 미인증 차단 | `allUsers` 권한 + 60s 서명 JWT 티켓 | 2계층 보안 확립 |
| **런타임** | `websockets` NameError | 모듈 임포트 누락 | `import websockets` 추가 | 백엔드 크래시 방지 |
| **GECX** | 1008 Policy Violation | Service Account 권한 부족 | `dialogflow.admin` 바인딩 | BidiRunSession 권한 획득 |
| **GECX** | 1008 Not Found | deployment 파라미터 불일치 | deployment ID 옵셔널화 | Draft/Live 자동 연결 |
| **스트리밍**| 80~120s 침묵 단절 | 무음 시 패킷 전송 중단 | 50ms Always-On + RCA 로깅 | 5분(300s) 연속 전송 |
| **네트워크**| Gateway WebSocket 1006 | API Gateway WS 미지원 | Control/Data Plane WSS 분리 라우팅 | 5회 연속 100% E2E 검증 |
| **Barge-In**| 1007 Invalid Argument | 에이전트 음성 중 마이크 유입 | **Turn-Gated Safe Mode + 150ms 갭** | **턴 충돌 제로 달성** |
| **스트림** | 1007 Failed Precondition | 4.8초 마이크 드롭(고갈) | **50ms 묵음 패킷(-∞ dBFS) 지속 전송** | **스트림 고갈 원천 차단** |
| **대화 흐름**| 대화 멈춤 (Freeze) | 서버 턴 완료 플래그 종속 | **스피커 무음 기준 자동 턴 복구** | **연속 대화 완벽 복구** |
| **UX/TTFT** | 텍스트 덩어리 지연 체감 | 문장 단위 텍스트 전송 | **30ms 단어 스트리머 ('두두두둑')** | **Sub-second TTFT 체감** |
| **프롬프트**| 인사 오작동/인식 실패 | 스몰톡 분류 누락 | **First-Turn 전용 + 스몰톡 규칙** | **자연스러운 음성 대화** |


