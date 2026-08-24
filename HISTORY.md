# 📅 Project Progress History (진행 이력)

> **프로젝트명**: GECX Real-Time Voice Streaming & Telemetry Console  
> **GitHub Repository**: [https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming](https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming)

---

## ⏱️ 타임라인별 작업 진행 요약

| 일시 (Time) | 단계 (Phase) | 주요 진행 내용 및 산출물 |
| :--- | :--- | :--- |
| **08-24 07:30 ~ 08:00** | **요구사항 분석** | • GECX `BidiRunSession` 스트리밍 공식 API 사양 분석 (`BidiRunSession.md`)<br>• 현업의 80~120초 소켓 단절 이슈 및 STT 0.3초 저지연 요구사항 파악 (`meeting_note.md`) |
| **08-24 08:00 ~ 08:55** | **시스템 설계 (SDD)** | • 제어 플레인(Agent Gateway OIDC)과 데이터 플레인(Cloud Run WSS) 분리 아키텍처 수립<br>• 5대 단절 원인 분석(RCA) 가설 및 텔레메트리 프레임워크 정의<br>• `taste-skill` 기반 2열 콕핏 UI 설계 (`docs/sdd.md`) |
| **08-24 08:55 ~ 09:03** | **기술 상세 설계 (TDD)** | • 50ms (1,600B) 오디오 버퍼 및 16kHz LINEAR16 다운샘플링 DSP 수식 명시<br>• JWT HS256 단기 세션 서명 티켓(60s TTL) 규격 정의 (`docs/tdd.md`) |
| **08-24 09:05 ~ 09:10** | **디렉토리 구조화** | • 평면 폴더 구조를 `docs/`, `bff/`, `web/`, `api_gateway/`, `scripts/`, `tests/`로 모듈화 및 재배치 |
| **08-24 09:10 ~ 09:14** | **백엔드 BFF 구현** | • `bff/auth.py`: JWT 세션 티켓 발급 및 검증<br>• `bff/telemetry.py`: 마이크로초 텔레메트리 로거 & RFC 6455 Close Code 분석기<br>• `bff/gecx_client.py`: GECX BidiRunSession WSS 스트리밍 클라이언트<br>• `bff/main.py`: FastAPI REST 및 WebSocket 프록시 라우터 구현 |
| **08-24 09:14 ~ 09:18** | **React 프론트엔드 구축** | • `web/src/audio/`: Web Audio Worklet 16kHz PCM 다운샘플링 & Barge-in 오디오 재생 큐 구현<br>• `web/src/components/`: Canvas 2D 60FPS 오실로스코프, 실시간 STT 대화창, 프레임 인스펙터, RCA 진단 모달<br>• Vite + Tailwind CSS 프로덕션 빌드 완료 (`web/dist/`) |
| **08-24 09:18 ~ 09:20** | **테스트 및 스크립트 작성** | • `tests/mock_gecx_server.py`: 90초/120초 단절 시뮬레이션 Mock 서버 구축<br>• 단위 및 통합 테스트 11건 100% 통과 (`test_audio`, `test_auth`, `test_telemetry`, `test_mock_stream`)<br>• 운영 스크립트 6종 작성 (`setup_env.sh`, `run_local.sh`, `deploy_cloudrun.sh`, `deploy_gateway.sh`, `stress_test_10m.py`, `cleanup.sh`) |
| **08-24 10:10 ~ 10:33** | **GCP 클라우드 실제 배포 완수** | • **Cloud Run BFF 배포 완료**: `https://gecx-streaming-bff-cwljmdzpfa-uc.a.run.app` (`gecx-bff-sa` IAM 권한 바인딩)<br>• **API Gateway Ingress 배포 완료**: `https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev`<br>• **Live End-to-End 검증 완료**: `POST /api/v1/session/start` 세션 발급 정상 응답 확인 |

---

## 📌 주요 체크포인트 요약

1. **실제 GCP 클라우드 배포 완료 (Live GCP Deployed)**:
   * **공개 Ingress API Gateway**: `https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev`
   * **비공개 Cloud Run BFF**: `https://gecx-streaming-bff-cwljmdzpfa-uc.a.run.app`
   * **세션 시작 API**: `https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev/api/v1/session/start` (JWT 60s TTL 발급 검증 완료)
2. **기술 검증 (Functional Validation)**:
   * 16kHz LINEAR16 50ms 고정 청킹, JWT 60초 티켓 인증, RFC 6455 Close Code 1006 파싱, 11개 단위/통합 테스트 전부 통과 (`Ran 11 tests in 0.401s - OK`).
3. **고객 PoC 데모 (Customer Demo)**:
   * `./scripts/run_local.sh --mock 90` 실행 시 로컬에서 90초 단절 시나리오 및 진단 모달 즉각 시연 가능.
4. **배포 및 전달 (GitHub & Cloud)**:
   * 저장소: [https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming](https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming)
