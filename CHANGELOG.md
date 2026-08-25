# Changelog

All notable changes to the **GECX Real-Time Voice Streaming & Telemetry Console** project will be documented in this file.

## [1.1.0] - 2026-08-25

### Added & Improved
- **Turn-Gated Safe Mode (Code 1007 Turn Conflict Zero Defense)**:
  - Strict turn state machine (`USER_TURN` vs `AGENT_TURN`) preventing microphone audio leakage during agent speech.
  - Dynamic visualizer turn badges ("Agent Speaking (Mic Muted)" vs "Your Turn - Speak Now (Listening)").
  - Support for `Full-Duplex (Smart Barge-In)` vs `Turn-Gated Safe Mode` toggle switch in `ControlDeck.tsx`.
- **Sub-Second TTFT & 30ms Progressive Word Streamer (Typewriter Effect)**:
  - Real-time TTFT (Time-To-First-Token) measurement pipeline anchored from user STT completion (`isFinal: true`) to first GECX server chunk arrival.
  - `ProgressiveAgentText` component in `ChatWindow.tsx` displaying real-time 30ms/word progressive typing streaming (`두두두둑`) with blinking cursor.
  - Dedicated TTFT (First Token Latency / Sub-second) card in `TelemetryStrip.tsx`.
- **Continuous 50ms Silent PCM Cadence Preservation**:
  - `AudioRecorder.getSilentChunkBase64()` sending continuous 50ms silence frames (-∞ dBFS) during gated turns and barge-in transitions to prevent GECX stream starvation / `generic::failed_precondition` disconnects.
- **Robust Multi-Turn State Stabilization**:
  - Auto user turn transition on Web Audio playback completion + 150ms temporal gap.
  - Barge-In audio player flush cleanup without ghost `onended` events.

## [1.0.0] - 2026-08-24

### Added
- **Solution & Technical Design Documents**:
  - `docs/sdd.md`: Comprehensive enterprise Solution Design Document with Control/Data plane separation and 5-Hypothesis RCA framework.
  - `docs/tdd.md`: Low-level Technical Design Document specifying 50ms audio buffer math, downsampling algorithms, JWT signing claims, and container sizing.
- **Backend-for-Frontend (BFF) Gateway**:
  - `bff/config.py`: Configuration management with GCP IAM Application Default Credentials (ADC) OAuth token auto-refresher.
  - `bff/auth.py`: Ephemeral signed JWT ticket issuer and validator (60s TTL, HS256).
  - `bff/telemetry.py`: Microsecond frame-level logger, RMS/dB audio level calculator, and RFC 6455 close code inspector.
  - `bff/gecx_client.py`: Upstream WebSocket client to GECX `ces.googleapis.com` (BidiRunSession).
  - `bff/main.py`: FastAPI server with REST session endpoint, static SPA serving, and real-time WebSocket streaming proxy.
- **`Leonxlnx/taste-skill` React Web Client**:
  - `web/src/audio/pcm_worklet.js`: AudioWorklet processor for linear interpolation downsampling to 16kHz LINEAR16.
  - `web/src/audio/audio_recorder.ts`: Microphone capture and AudioWorklet manager.
  - `web/src/audio/audio_player.ts`: AudioBuffer playback queue with sub-second Barge-in flush capability.
  - `web/src/components/Visualizer.tsx`: 60 FPS Canvas 2D live audio oscilloscope.
  - `web/src/components/ChatWindow.tsx`: Real-time streaming STT transcription & A2A agent response dialogue.
  - `web/src/components/ControlDeck.tsx`: Streaming control with Spacebar PTT hotkey.
  - `web/src/components/TelemetryStrip.tsx`: Real-time streaming metrics strip.
  - `web/src/components/FrameInspector.tsx`: Live WebSocket frame inspector with filter tabs.
  - `web/src/components/RcaModal.tsx`: RFC 6455 close code & 5-hypothesis disconnect RCA diagnosis modal.
- **Automation & Test Suite**:
  - `tests/mock_gecx_server.py`: Standalone mock GECX server with configurable 90s/120s timeout simulation.
  - `tests/test_audio.py`, `tests/test_auth.py`, `tests/test_telemetry.py`, `tests/test_mock_stream.py`: Full unit & integration test suite.
  - `scripts/setup_env.sh`, `scripts/run_local.sh`, `scripts/deploy_cloudrun.sh`, `scripts/deploy_gateway.sh`, `scripts/stress_test_10m.py`, `scripts/cleanup.sh`.
  - `Dockerfile`: Multi-stage container packaging for Cloud Run.
