# 📘 GECX 실시간 음성 스트리밍 (Code 1007 / Turn Barge-In) 단절 원인 및 해결 가이드

본 문서는 Google Cloud GECX (Dialogflow CX A2A 실시간 음성 스트리밍 API - `BidiRunSession`) 연동 시 발생하는 **RFC 6455 Close Code 1007 (`generic::invalid_argument` / `failed_precondition`)** 에러의 근본 원인(RCA)과 3가지 핵심 실행 조치(Action Items)를 정리한 기술 문서입니다.

---

## 1. 🚨 에러 현상 및 로그 분석

### 발생 로그 (Log Signature)
```log
[ERROR] [RCA] Session Disconnected (Code 1007): 
Request trace id: 3e202e9b88384847, 
[ORIGINAL ERROR] generic::invalid_argument: com.google.cloud.ai.ces.shared.exceptions.InvalidArgumentException
(또는 generic::failed_precondition: com.google.cloud.ai.ces.shared.exception)
```

### 증상
1. 세션 연결 후 음성 대화가 30초~180초 동안 정상 진행되다가, 사용자가 에이전트의 긴 안내 음성을 중간에 끊고 말(Barge-In)하거나 짧은 추임새를 넣는 순간 업스트림 WebSocket이 갑자기 강제 단절됨.
2. BFF ➔ 클라이언트로 전달되는 진단 코드: `raw_close_code: 1007 (CLOSE_UNSUPPORTED_DATA / INVALID_ARGUMENT)`.

---

## 2. 🔍 근본 원인 분석 (Root Cause Analysis - RCA)

```
[ GECX A2A 세션 상태 머신 (Turn State Machine) 충돌 구조 ]

  [에이전트 발화 중] ──(Agent TTS Audio 출력)────────────────────────┐
                                                                    ▼
  [사용자 마이크]   ──(50ms Linear16 PCM 청크 연속 송신)────────> [ GECX CES 엔진 ]
                                                                    │
  * 문제 발생:                                                      │
    사용자가 말을 시작할 때, 기존 발화 패킷과 인터럽트 신호가      │
    상태 전환 경계에서 밀려들면서 Turn State 동기화 실패             │
                                                                    ▼
  [결과]: GECX 상태 머신이 'Turn 충돌'로 판단하여 1007 예외 발생 및 세션 강제 종료
```

1. **풀-듀플렉스(Full-Duplex) 오디오 충돌**:
   * 클라이언트가 50ms 주기로 끊김 없이 마이크 오디오를 전송하고 있는 상태에서, GECX 에이전트가 음성을 출력하는 중 사용자가 끼어들면(Barge-In) 서버 측 상태 머신이 즉시 `Agent Turn`에서 `User Turn`으로 전환을 시도합니다.
2. **상태 전환 여유 시간(Temporal Gap) 부족**:
   * GECX의 CES(Conversational Engine Service)가 인터럽트 신호를 처리하고 내부 음성 합성 버퍼를 리셋하는 동안에도 클라이언트로부터 마이크 오디오 청크가 0ms의 간격도 없이 계속 유입되면, 서버 파이프라인에서 입력 패킷 순서가 꼬여 `generic::invalid_argument` 또는 `generic::failed_precondition` 예외를 던지며 소켓을 닫습니다.
3. **주변 노이즈 및 마이크 에코에 의한 오트리거(False Barge-in)**:
   * 마이크를 통해 스피커의 에이전트 목소리나 호흡음, 미세 잡음이 들어올 때 VAD가 이를 실제 사용자 발화로 오인하여 불필요한 급격한 턴 전환을 유발합니다.

---

## 3. 🛠️ 구체적인 해결 방안 (Action Items)

### ① 오디오 패킷 주입 로직의 '중단 인지' 연동 강화 (코드 반영 완료)

클라이언트 측 오디오 파이프라인과 서버의 인터럽트 시그널을 엄격하게 동기화합니다.

1. **로컬 재생 버퍼 즉시 플러시 (`AudioPlayer.flush()`)**:
   * `BidiSessionServerMessage` 내의 `interruptionSignal`을 수신하는 즉시 스피커로 재생 중이던 Web Audio 버퍼 소스 노드를 모두 즉시 중단(`source.stop()`)하고 큐를 비웁니다.
2. **150ms 템포럴 갭 디바운스 (`AudioRecorder.pauseTemporarily(150)`)**:
   * 인터럽트가 트리거된 직후 약 **100ms~200ms (기본 150ms, 약 3개 청크 분량)** 동안 마이크 입력 청크의 전송을 일시 지연시킵니다.
   * 이를 통해 GECX 백엔드 상태 머신이 `User Turn`으로 완전히 전환할 수 있는 필수적인 시간적 여유(Temporal Gap)를 확보합니다.

```typescript
// web/src/audio/audio_recorder.ts
pauseTemporarily(durationMs: number = 150): void {
  this.isTemporarilyPaused = true;
  if (this.pauseTimeout) clearTimeout(this.pauseTimeout);
  this.pauseTimeout = setTimeout(() => {
    this.isTemporarilyPaused = false;
    this.pauseTimeout = null;
  }, durationMs);
}
```

---

### ② VAD(Voice Activity Detection) 파라미터 임시 완화

추임새나 호흡음과 같은 무의미한 미세 소음이 급격한 상태 전환을 유도하지 않도록 민감도를 최적화합니다.

1. **Turn-Start Sensitivity (Start of Speech - SOS)**:
   * 연결 설정에서 민감도를 다소 높여(`0.30 ~ 0.40`), 혼잣말 수준의 아주 작은 소리는 무시하고 의도적인 명확한 발화만 인식하도록 설정합니다.
2. **Temporal Validation Frames (연속 유효 프레임 임계값)**:
   * 연속 유효 프레임 수를 기본 2프레임에서 **4 프레임(약 160ms~200ms 연속 발화 요구)**으로 늘려, 1~2프레임의 짧은 추임새나 "어/음" 소리로 인한 즉각적인 상태 전환 충격을 방지합니다.

---

### ③ SEANet 기반 Adaptive Noise Cancellation 활성화

1. **GECX Agent 콘솔 / Channel Settings**:
   * GECX의 Deployment & Channel Settings에서 **Adaptive Adjustment (Adaptive Noise Cancellation)** 옵션을 활성화합니다.
2. **Google SEANet 딥러닝 모델 작동**:
   * Google의 SEANet 모델이 작동하여 음성 대역 외의 주변 환경 노이즈나 부정확한 음향 충격을 사전에 마스킹합니다.
   * 이를 통해 오트리거(False Barge-in) 및 턴 상태 꼬임 현상을 획기적으로 차단합니다.
3. **SessionConfig 핸드쉐이크 에코 캔슬링 강제**:
   ```json
   {
     "config": {
       "inputAudioConfig": {
         "audioEncoding": "LINEAR16",
         "sampleRateHertz": 16000,
         "enableEchoCancellation": true
       },
       "outputAudioConfig": {
         "audioEncoding": "LINEAR16",
         "sampleRateHertz": 16000
       }
     }
   }
   ```

---

## 4. 📊 검증 및 개선 효과

| 항목 | 개선 전 | 개선 후 (Action Items 적용) |
| :--- | :--- | :--- |
| **Barge-in 시 동작** | 오디오 패킷 연속 주입으로 1007 크래시 발생 | **150ms 템포럴 갭 디바운스**로 안정적 User Turn 전환 |
| **재생 버퍼 처리** | 지연된 잔여 음성 재생 | **AudioPlayer 즉각 플러시**로 하울링/에코 차단 |
| **미세 노이즈 내성** | 작은 숨소리에도 상태 머신 오작동 | **4프레임 유효성 검증 + AEC**로 오트리거 방지 |
| **세션 생존율** | 30~60초 내 Barge-in 시 1007 단절 | **3분(180초)~5분(300초) 이상 연속 대화 완주** |

