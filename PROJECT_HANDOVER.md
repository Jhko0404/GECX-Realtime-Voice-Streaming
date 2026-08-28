# 📘 GECX Real-Time Voice Streaming - 프로젝트 인수인계 및 영구 가이드 (Handover & Roadmap)

> **이 문서는 본 프로젝트의 아키텍처, 실행 방법, 클라우드 리소스 매핑, 해결된 트러블슈팅 이력, 향후 개선 과제를 완벽하게 정리한 마스터 인수인계 문서입니다.**  
> 나중에 새 대화 세션에서 이 문서를 읽는 AI 어시스턴트(또는 개발자)는 이 문서 하나만으로 프로젝트의 모든 맥락을 파악하고 즉시 개발을 이어갈 수 있습니다.

---

## 📌 1. 프로젝트 개요 및 핵심 정체성 (Project Identity)

* **프로젝트명**: `GECX-Real-Time-Voice-Streaming` (GECX Real-Time Voice Streaming & Telemetry Console)
* **목적**: Google Cloud Customer Engagement Suite (CES / GECX)의 **Gemini A2A 실시간 양방향 음성 스트리밍(`BidiRunSession`)**을 안정적으로 중계하는 초저지연 BFF(Backend-for-Frontend) 게이트웨이 및 Google Material 3 디자인 기반 웹 콘솔 구축.
* **주요 특징**:
  * **Control Plane / Data Plane 분리**: REST API Gateway를 통한 60초 단기 서명 JWT 티켓 발급 후 Cloud Run WSS 직접 연결.
  * **Code 1007 턴 충돌 제로 (`Turn-Gated Safe Mode`)**: 에이전트 음성 출력 중 마이크 음성 유입을 게이트하고 50ms 묵음 패킷을 유지하여 1007 에러 완전 차단.
  * **초저지연 TTFT & 30ms 타자기 스트리밍**: 사용자 발화 종료 즉시 반응 및 30ms 단어 단위 '두두두둑' 텍스트 표출 (`ProgressiveAgentText`).
  * **마이크로초 텔레메트리 & 5-Hypothesis RCA 모달**: RFC 6455 웹소켓 종료 코드 실시간 감지 및 자동 원인 분석 리포트 제공.

---

## ⚡ 2. 원클릭 실행 및 테스트 방법 (Quick Start)

### 2.1 로컬 개발 환경 실행
```bash
cd .

# 1. 환경 설정 (가상환경 및 npm 의존성 최초 1회)
./scripts/setup_env.sh

# 2. 로컬 원클릭 실행 (Frontend 빌드 + FastAPI 구동)
./scripts/run_local.sh
# 👉 브라우저 접속: http://localhost:8080
```

### 2.2 로컬 Mock 서버 기반 테스트 (GCP 연동 없이 단절/스트리밍 검증)
```bash
# 90초 후 1006 비정상 단절을 시뮬레이션하는 Mock GECX 모드로 실행
./scripts/run_local.sh --mock 90
```

### 2.3 단위 및 통합 테스트 실행
```bash
# Python 11개 단위/통합 테스트 전체 수행
.venv/bin/python -m unittest discover tests -v

# Frontend TypeScript 및 Vite 프로덕션 빌드 검증
(cd web && npm run build)
```

### 2.4 Google Cloud 배포
```bash
# Cloud Run BFF 비공개 배포
./scripts/deploy_cloudrun.sh

# API Gateway 배포
./scripts/deploy_gateway.sh
```

---

## 🗺️ 3. 환경 변수 및 클라우드 리소스 맵 (Cloud Resources)

| 항목 | 리소스 값 / ID | 설명 |
| :--- | :--- | :--- |
| **GCP Project** | `your-gcp-project-id` | Google Cloud 프로젝트 ID |
| **Region / Location** | `us-central1` / `us` | Cloud Run 및 GECX 리전 |
| **GECX App ID** | `your-gecx-app-id` | 코웨이 요금/청구 전문 AI 가상 상담원 App |
| **Cloud Run Service** | `gecx-streaming-bff` | BFF WebSocket 프록시 & SPA 서빙 컨테이너 |
| **Cloud Run URL** | `https://gecx-streaming-bff-cwljmdzpfa-uc.a.run.app` | Cloud Run 비공개/직접 WSS 엔드포인트 |
| **API Gateway URL** | `https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev` | Control Plane REST 엔드포인트 |
| **BFF Service Account** | `gecx-bff-sa@your-gcp-project-id.iam.gserviceaccount.com` | `roles/dialogflow.admin`, `roles/ces.invoker` |
| **Audio Spec** | `16kHz, 16-bit Mono, Linear16 PCM` | 50ms 프레임 (800 샘플, 1600 Bytes) |

---

## 📂 4. 핵심 코드베이스 파일 색인 (File Map)

### 🔹 Backend (BFF - FastAPI)
* [`bff/main.py`](bff/main.py): FastAPI 서버 진입점, `/api/v1/session/start` REST 엔드포인트, `/ws/stream` WebSocket 양방향 프록시 루프.
* [`bff/gecx_client.py`](bff/gecx_client.py): Google `ces.googleapis.com` BidiRunSession gRPC/WSS 업스트림 클라이언트 및 ADC OAuth 토큰 인증.
* [`bff/auth.py`](bff/auth.py): 60초 TTL 단기 서명 JWT 세션 티켓 발급 및 검증.
* [`bff/telemetry.py`](bff/telemetry.py): 마이크로초 프레임 텔레메트리, RMS/dBFS 음성 감지, RFC 6455 Close Code 분석기.
* [`bff/config.py`](bff/config.py): 환경 변수 및 GCP 리소스 경로 빌더.

### 🔹 Frontend (Web Console - React + Vite + TailwindCSS)
* [`web/src/App.tsx`](web/src/App.tsx): 메인 상태 관리자, `USER_TURN` ↔ `AGENT_TURN` 안전 상태 머신, TTFT 실시간 측정 파이프라인.
* [`web/src/audio/audio_recorder.ts`](web/src/audio/audio_recorder.ts): AudioWorklet 기반 16kHz 리샘플링, 연속 50ms 무음 패킷(`getSilentChunkBase64`) 생성.
* [`web/src/audio/audio_player.ts`](web/src/audio/audio_player.ts): Web Audio 재생 큐, `setOnPlaybackEnded` 스피커 무음 감지, Barge-In 즉시 플러시(`flush`).
* [`web/src/components/ChatWindow.tsx`](web/src/components/ChatWindow.tsx): 실시간 STT 전사 및 **30ms 고속 단어 타자기 (`ProgressiveAgentText`)**.
* [`web/src/components/Visualizer.tsx`](web/src/components/Visualizer.tsx): Google Gemini 4-Color 실시간 오실로스코프 및 턴 상태 동적 뱃지.
* [`web/src/components/TelemetryStrip.tsx`](web/src/components/TelemetryStrip.tsx): TTFT(ms), Cadence Interval, Audio RMS Level, Silence Duration 4-Card 대시보드.
* [`web/src/components/ControlDeck.tsx`](web/src/components/ControlDeck.tsx): PTT Hotkey (Spacebar), Turn-Gated / Full-Duplex 모드 전환 스위치.
* [`web/src/components/RcaModal.tsx`](web/src/components/RcaModal.tsx): 세션 단절 시 5-Hypothesis 자동 진단 리포트 팝업.

### 🔹 Documentation & Guides
* [`docs/troubleshooting.md`](docs/troubleshooting.md): 전체 9개 핵심 이슈 및 마스터 해결 매트릭스.
* [`docs/sdd.md`](docs/sdd.md): 엔터프라이즈 솔루션 설계서 (Solution Design Document).
* [`docs/tdd.md`](docs/tdd.md): 오디오 버퍼 연산 및 보안 수학 상세 설계서 (Technical Design Document).
* [`docs/BidiRunSession.md`](docs/BidiRunSession.md): GECX `BidiRunSession` 프로토콜 스펙 정리.

---

## 🛠️ 5. 해결된 핵심 기술 과제 및 설계 결정 (Key Learnings)

1. **Code 1007 `generic::invalid_argument` 턴 충돌 방어**:
   * *원인*: 에이전트 음성 출력 중 사용자 마이크 오디오나 스피커 하울링이 유입되어 GECX 상태 머신 충돌.
   * *해결*: `Turn-Gated Safe Mode`로 에이전트 발화 중 마이크를 게이트하고, 음성 종료 후 **150ms 템포럴 안정화 버퍼**를 두어 안전하게 전환.
2. **Code 1007 `generic::failed_precondition` 스트림 고갈 방어**:
   * *원인*: 마이크 게이트 시 4초 이상 오디오 전송이 완전히 끊기면(0 Byte) GECX 오디오 디코더가 스트림 고갈로 세션 종료.
   * *해결*: 게이트 상태에서도 **초당 20회(50ms)의 무음 패킷(Int16 zeros, -∞ dBFS)**을 지속 전송하여 세션 생명선 유지.
3. **긴 발화 후 대화 멈춤 (Freeze) 해결**:
   * *원인*: 서버의 `turnCompleted: true` 신호 수신에만 의존하여 사용자가 말을 가로채거나 플래그가 누락되면 `AGENT_TURN`에 영구 고립.
   * *해결*: 브라우저 스피커 출력 완료(`AudioPlayer.setOnPlaybackEnded`) 시 150ms 후 무조건 `USER_TURN`으로 자동 복구.
4. **체감 지연 해결 및 Sub-second TTFT 타자기 스트리밍**:
   * *원인*: GECX A2A 엔진이 334자 텍스트를 한 번에 내려보내어 텍스트가 늦게 나오는 것처럼 체감됨.
   * *해결*: 수신된 텍스트를 30ms 단위로 순차 출력하는 **`ProgressiveAgentText` 타자기 효과** 구현 및 실제 TTFT(ms) 메트릭 시각화.

---

## 🚀 6. 향후 개선 과제 및 로드맵 (Future Roadmap)

이후 프로젝트를 재개할 때 다음 기능들을 순차적으로 발전시킬 수 있습니다:

* **[ ] Roadmap 1: CX Agent Studio 프롬프트 배포 및 다중 서브 에이전트 실연동**
  * `docs/troubleshooting.md`의 최적화된 프롬프트를 Agent Studio에 적용하고, `Billing Agent` 및 `purifier_faq_agent` 호전환 E2E 시나리오 테스트.
* **[ ] Roadmap 2: WebRTC / gRPC 양방향 직접 스트리밍 지원**
  * WebSocket 프록시 외에 브라우저 WebRTC DataChannel을 통한 초저지연 오디오 전송 파이프라인 확장.
* **[ ] Roadmap 3: 다국어(Korean/English/Japanese) 실시간 자동 언어 감지**
  * 사용자 발화 언어에 따라 클라이언트 UI 및 STT 언어 설정을 동적으로 스위칭.
* **[ ] Roadmap 4: VAD 실시간 튜너 UI 제공**
  * 웹 콘솔에서 Start of Speech(SOS) 및 End of Speech(EOS) 임계치를 슬라이더로 조절하며 실시간 벤치마킹하는 튜닝 패널 추가.

---

## 🤖 7. AI 어시스턴트 재개 가이드 (For Next AI Session)

다음 세션에서 이 프로젝트를 다시 시작할 때는 다음과 같이 요청하면 됩니다:

> *"[`PROJECT_HANDOVER.md`](PROJECT_HANDOVER.md)를 읽고 프로젝트 맥락을 파악한 뒤, Roadmap [N]번 작업을 진행해줘."*

AI 어시스턴트는 이 핸드오버 문서를 바탕으로 즉시 모든 상태 머신 규칙, 클라우드 엔드포인트, 오디오 파이프라인을 복원하여 작업을 이어가게 됩니다.
