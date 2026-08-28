# GECX Real-Time Voice Streaming - Troubleshooting and Resolution Guide

본 문서는 **GECX Real-Time Voice Streaming** 시스템 구축 과정에서 발생한 핵심 네트워크, 인증, GECX 업스트림 API 연동, 양방향 오디오 스트리밍 및 턴 제어 이슈들의 원인 분석(RCA)과 구체적인 기술적 해결 방안을 정리한 트러블슈팅 가이드입니다.

---

## 목차
1. [네트워크 및 보안/인증 이슈](#1-네트워크-및-보안인증-이슈)
2. [GECX Upstream API 연동 이슈](#2-gecx-upstream-api-연동-이슈)
3. [오디오 스트리밍 및 장시간 세션 안정성 이슈](#3-오디오-스트리밍-및-장시간-세션-안정성-이슈)
4. [GECX 1007 턴 충돌 및 오디오 스트림 안정성 이슈](#4-gecx-1007-턴-충돌-및-오디오-스트림-안정성-이슈)
5. [대화 흐름 멈춤 및 턴 자동 복구 이슈](#5-대화-흐름-멈춤-및-턴-자동-복구-이슈)
6. [트러블슈팅 종합 매트릭스](#6-트러블슈팅-종합-매트릭스)

---

## 1. 네트워크 및 보안/인증 이슈

### Issue 1.1: Cloud Run WebSocket 직접 진입 시 HTTP 403 Forbidden 거부
* **증상**: 클라이언트가 API Gateway로부터 발급받은 서명 티켓(`?ticket=...`)을 가지고 Cloud Run WebSocket(`wss://.../ws/stream`)에 연결할 때 `HTTP 403 Forbidden`이 반환되는 현상.
* **원인 (Root Cause)**: 
  * Cloud Run이 `--no-allow-unauthenticated`로 배포되어, Google IAM OIDC 토큰이 없는 브라우저의 WebSocket Upgrade 요청을 컨테이너 애플리케이션 진입 전 GCP 인프라 레이어에서 차단함.
* **해결 방법 (Solution)**:
  * Cloud Run에 `allUsers` 대상 `roles/run.invoker` 권한을 부여하고, 실제 인증 및 권한 검증은 애플리케이션의 **단기 서명 JWT 티켓(60초 TTL, `bff/auth.py`)**에서 전담하도록 2계층 보안 아키텍처를 확립.
  ```bash
  gcloud run services add-iam-policy-binding gecx-streaming-bff \
      --region=us-central1 \
      --member="allUsers" \
      --role="roles/run.invoker" \
      --project=your-gcp-project-id --quiet
  ```

---

### Issue 1.2: API Gateway WebSocket 업그레이드 미지원 및 Data Plane 직접 라우팅
* **증상**: 브라우저에서 게이트웨이 도메인(`https://gecx-agent-gateway-xxxxx.uc.gateway.dev/`) 접속 후 세션 연결 시 즉시 `RFC 6455 Close Code 1006` 단절 발생.
* **원인 (Root Cause)**:
  * Google Cloud API Gateway는 REST/HTTP 프록시 전용으로 동작하며, 양방향 스트리밍 프로토콜인 WebSocket (`Upgrade: websocket`)을 지원하지 않음.
  * 프론트엔드가 게이트웨이 호스트로 WebSocket 연결을 시도하면서 게이트웨이 레이어에서 연결이 즉시 강제 종료됨.
* **해결 방법 (Solution)**:
  1. **Control Plane과 Data Plane 엔드포인트 분리**:
     * Control Plane (`POST /api/v1/session/start`)은 보안 게이트웨이를 경유하여 단기 서명된 JWT 티켓 발급.
     * 발급 응답 시 `ws_endpoint`로 Cloud Run의 WSS URL(`wss://gecx-streaming-bff-xxxxx.a.run.app/ws/stream`)을 반환.
  2. **프론트엔드 라우팅 자동화**:
     * `web/src/services/websocket.ts`에서 게이트웨이 도메인 감지 시 Cloud Run WSS 엔드포인트로 자동 라우팅 처리.

---

## 2. GECX Upstream API 연동 이슈

### Issue 2.1: GECX `BidiRunSession` 호출 시 1008 Policy Violation (권한 부족)
* **증상**: Cloud Run BFF에서 `ces.googleapis.com`으로 WebSocket 연결 시 아래 에러와 함께 즉시 연결 종료:
  ```text
  websockets.exceptions.ConnectionClosedError: received 1008 (policy violation) 
  Permission 'ces.sessions.bidiRunSession' denied on resource '//ces.googleapis.com/...'
  ```
* **원인 (Root Cause)**:
  * Cloud Run 실행 서비스 계정(`gecx-bff-sa`)에 기본 `roles/ces.invoker` 권한만 부여되어 있었으나, 실시간 양방향 세션(`BidiRunSession`) 생성에는 Dialogflow 및 Discovery Engine 관리자 권한이 필요함.
* **해결 방법 (Solution)**:
  * `gecx-bff-sa` 서비스 계정에 `roles/dialogflow.admin` 및 `roles/discoveryengine.admin` IAM 역할을 바인딩하여 세션 생성 권한 확보.
  ```bash
  gcloud projects add-iam-policy-binding your-gcp-project-id \
      --member="serviceAccount:gecx-bff-sa@your-gcp-project-id.iam.gserviceaccount.com" \
      --role="roles/dialogflow.admin" --quiet

  gcloud projects add-iam-policy-binding your-gcp-project-id \
      --member="serviceAccount:gecx-bff-sa@your-gcp-project-id.iam.gserviceaccount.com" \
      --role="roles/discoveryengine.admin" --quiet
  ```

---

### Issue 2.2: GECX 초기화 핸드쉐이크 시 `generic::not_found: ExternalException`
* **증상**: IAM 권한 설정 후에도 GECX 연결 직후 아래 에러와 함께 세션 단절:
  ```text
  websockets.exceptions.ConnectionClosedError: received 1008 (policy violation)
  [ORIGINAL ERROR] generic::not_found: com.google.cloud.ai.ces.shared.exceptions.ExternalException
  ```
* **원인 (Root Cause)**:
  * 초기 핸드쉐이크(`SessionConfig`) 페이로드 전송 시 `"deployment": ".../deployments/default"`를 명시했으나, 대상 에이전트 앱에는 `default`라는 별도 배포 버전이 생성되어 있지 않고 초안(Draft/Live) 환경만 존재하여 리소스 Not Found 발생.
* **해결 방법 (Solution)**:
  * `bff/gecx_client.py`에서 `deployment` 필드를 옵셔널하게 처리하도록 변경하여, 명시적인 버전이 없을 경우 기본 에이전트로 자동 라우팅되도록 수정.
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
  if settings.DEPLOYMENT_ID and settings.DEPLOYMENT_ID not in ("default", "draft", ""):
      config_obj["deployment"] = settings.gecx_deployment_resource_path
  ```

---

## 3. 오디오 스트리밍 및 장시간 세션 안정성 이슈

### Issue 3.1: 80~120초 무음 구간 세션 단절 방지 및 Always-On 스트리밍
* **증상**: 음성 대화 도중 사용자가 말을 하지 않는 긴 무음(Silence) 구간이 발생할 때 80~120초 사이에 업스트림 서버에서 `RFC 6455 Close Code 1006` 비정상 단절이 발생할 가능성 존재.
* **원인 (Root Cause)**:
  * GECX VAD 및 에코 캔슬러는 배경 잡음 추적 및 연결 유지를 위해 지속적인 오디오 프레임 유입을 기대하며, 패킷 전송이 중단되면 소켓 유휴 타임아웃으로 간주함.
* **해결 방법 (Solution)**:
  1. **Always-On 스트리밍 정책 적용**: 클라이언트(Web Audio Worklet)에서 무음 구간이어도 앰비언트 프레임을 **50ms(800 샘플, 1,600 바이트)** 주기로 끊김 없이 지속 전송.
  2. **RFC 6455 텔레메트리 체계 구축**: `bff/telemetry.py`를 통해 프레임 레벨 메트릭 및 밀리초 단위 세션 타임라인을 기록하여 단절 원인 실증 분석 체계 완성.

---

## 4. GECX 1007 턴 충돌 및 오디오 스트림 안정성 이슈

### Issue 4.1: 에이전트 발화 중 마이크 오디오 유입 시 `Code 1007 (generic::invalid_argument)` 턴 충돌
* **증상**: 에이전트가 음성(TTS)을 출력하는 동안 사용자의 마이크 소리나 스피커 하울링이 유입될 때 업스트림 WebSocket이 즉시 `Code 1007`로 강제 단절됨.
* **원인 (Root Cause)**:
  * Google Cloud CES의 턴 상태 머신은 `Agent Turn` 진행 중 클라이언트로부터 음성 유효 오디오 패킷이 들어올 경우, 상태 충돌로 판단하여 `generic::invalid_argument` 예외를 발생시키고 세션을 종료함.
* **해결 방법 (Solution)**:
  1. **Turn-Gated Safe Mode 상태 머신 구현 (`App.tsx`)**:
     * 에이전트 발화 시작 시 `turnState`를 `AGENT_TURN`으로 전환하고, 마이크 입력 신호를 100% 게이트(차단)하여 서버로 음성 신호가 유입되지 않도록 방어.
  2. **150ms 템포럴 안정화 버퍼**:
     * 에이전트 음성 출력이 끝난 후 즉시 마이크를 열지 않고, 150ms의 안정화 지연을 두어 CES 엔진의 내부 버퍼가 완전히 정리된 후 `USER_TURN`으로 전환.

---

### Issue 4.2: 마이크 게이트 시 스트림 완전 단절로 인한 `Code 1007 (generic::failed_precondition)` 발생
* **증상**: Turn-Gated 모드 적용 후 마이크 입력을 차단했을 때, 수 초 후 `generic::failed_precondition` 예외와 함께 단절됨.
* **원인 (Root Cause)**:
  * GECX `BidiRunSession`은 16kHz 오디오 프레임이 4초 이상 완전히 끊기면(0 Byte Stream Starvation), 오디오 디코더 상태 머신에서 스트림 고갈로 인한 `failed_precondition` 예외를 발생시킴.
* **해결 방법 (Solution)**:
  * **연속 50ms 묵음 패킷(Silent PCM Frame) 전송 보장 (`audio_recorder.ts`)**:
    * 마이크가 게이트된 상태(`AGENT_TURN`)에서도 패킷 송신을 멈추지 않고, **초당 20회(50ms 주기)의 안전한 묵음(Int16 zeros, -∞ dBFS) 패킷**을 지속 전송.
    * GECX 서버는 스트림 공백 없이 정상 작동하며, 묵음 데이터이므로 턴 충돌(1007)도 방지됨.

---

## 5. 대화 흐름 멈춤 및 턴 자동 복구 이슈

### Issue 5.1: 긴 안내 멘트 수신 후 다음 사용자 발화 시 대화 멈춤 현상
* **증상**: 에이전트의 긴 안내 음성 후 사용자가 말을 시작했으나 화면에 STT가 뜨지 않고 세션 진행이 멈추는 현상.
* **원인 (Root Cause)**:
  * 클라이언트의 턴 복구 로직이 GECX 서버의 명시적인 `turnCompleted: true` 수신 여부에만 종속되어 있어, 서버 패킷 플래그 타이밍이 어긋났을 때 `AGENT_TURN`에 갇혀 마이크가 Mute 상태로 유지됨.
* **해결 방법 (Solution)**:
  1. **스피커 무음 기준 자동 턴 복구 (`App.tsx`)**:
     * 서버의 `turnCompleted` 신호 도착 여부와 상관없이, 브라우저 스피커의 TTS 오디오 재생이 완료되면(`AudioPlayer.setOnPlaybackEnded`) 150ms 후 무조건 `USER_TURN`으로 안전 복구.
  2. **Barge-In 플러시 콜백 안정화 (`audio_player.ts`)**:
     * 오디오 소스 강제 중단(`stop`) 시 불필요한 이벤트가 발생하지 않도록 리소스 정리 로직 강화.

---

## 6. 트러블슈팅 종합 매트릭스

| 분류 | 이슈 코드/증상 | 근본 원인 | 해결 방안 | 적용 결과 |
| :--- | :--- | :--- | :--- | :--- |
| **보안** | WebSocket 403 Forbidden | Cloud Run IAM 미인증 차단 | `allUsers` 권한 + 60s 서명 JWT 티켓 | 2계층 보안 체계 확립 |
| **네트워크** | Gateway WebSocket 1006 | API Gateway WebSocket 미지원 | Control/Data Plane 엔드포인트 분리 라우팅 | 실환경 스트리밍 안정화 |
| **GECX** | 1008 Policy Violation | Service Account IAM 권한 부족 | `dialogflow.admin` 바인딩 | BidiRunSession 권한 확보 |
| **GECX** | 1008 Not Found | deployment 파라미터 불일치 | deployment ID 옵셔널화 | Draft/Live 자동 연결 |
| **스트리밍** | 80~120s 침묵 단절 | 무음 시 패킷 전송 중단 | 50ms Always-On + 텔레메트리 로깅 | 무손실 연속 스트리밍 보장 |
| **Barge-In** | 1007 Invalid Argument | 에이전트 음성 중 마이크 유입 | Turn-Gated Safe Mode + 150ms 갭 | 턴 충돌(1007) 방지 |
| **스트림** | 1007 Failed Precondition | 장시간 마이크 차단(스트림 고갈) | 50ms 묵음 패킷(-∞ dBFS) 지속 전송 | 스트림 고갈 원천 차단 |
| **대화 흐름** | 대화 멈춤 (Freeze) | 서버 턴 완료 플래그 종속 | 스피커 재생 완료 기준 자동 턴 복구 | 연속 대화 세션 안정화 |
