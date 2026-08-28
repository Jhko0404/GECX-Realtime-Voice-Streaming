**GECX(Gemini Enterprise for Customer Experience)** 제품군 중 실시간 오디오 및 멀티모달 인터랙션을 지원하는 핵심 스트리밍 API인 **`BidiRunSession`**에 대한 기술 사양 및 아키텍처 정보를 정리해 드립니다.

GECX 스트리밍 API는 기존의 턴 기반 텍스트 아키텍처에서 탈피하여 실시간 음성/멀티모달 처리를 지원하는 양방향 스트리밍(Bidirectional Streaming) 구조를 갖추고 있습니다.

---

### 1. 개요 및 API 엔드포인트
* **통합 API 서비스**: `ces.googleapis.com` (Customer Experience Suite API)
* **gRPC 서비스명**: `google.cloud.ces.v1main.SessionService/BidiRunSession`
* **주요 특징**: 단일 홉 단방향 API(`RunSession`)와 달리, `BidiRunSession`은 실시간 멀티모달(텍스트, 오디오, 이미지) 데이터의 실시간 송수신을 위한 양방향 영구 파이프(Persistent Pipe)를 구축합니다. 네트워크 단절 등이 발생하더라도 최장 15분간 세션을 복구하여 유지할 수 있는 세션 유지 기능(Session Resumption)을 내장하고 있습니다.

---

### 2. 음성 스트리밍 핵심 기술 (A2A 아키텍처)
기존 음성 챗봇 시스템(STT ➡️ LLM ➡️ TTS의 3단계 가스케이드 방식)의 단점인 높은 Latency를 극복하기 위해 아래와 같은 아키텍처를 제공합니다.

* **Audio-to-Audio (A2A) Native Audio**: 
  * Gemini 모델을 기반으로 텍스트 변환 과정 없이 음성 입력을 음성으로 직접 추론 및 출력합니다.
  * 음성 인식/합성 단계를 제거하여 **1초 미만(Sub-second)의 지연 시간**을 제공하며, 텍스트에 담기지 않는 사용자의 감정, 목소리 톤, 억양 등을 그대로 이해하고 반영할 수 있습니다.
* **Semantic Endpointer (SOS/EOS)**:
  * 사용자가 말을 시작(SOS, Start-of-Speech)하고 끝마쳤는지(EOS, End-of-Speech)를 오직 음성 데이터를 기반으로 실시간 감지하여 최적의 답변 타이밍을 도출합니다.

---

### 3. 스트리밍 데이터 처리 흐름 (gRPC Lifecycle)

#### Client Request Stream (`BidiSessionClientMessage`)
1. **초기화 (Initialization)**: 첫 번째 메시지로 `SessionConfig`를 전송합니다. 음성 세션인 경우 `InputAudioConfig`(오디오 인코딩 및 샘플 레이트 등)와 `OutputAudioConfig`가 필수로 포함되어야 합니다.
2. **실시간 입력 (Interaction)**: 이후 사용자의 실시간 음성 또는 텍스트 입력 데이터(`SessionInput`)를 스트리밍 형태로 전송합니다.
3. **세션 종료 (Termination)**: 사용자의 입력이 끝나거나 서버로부터 `EndSession` 신호를 받으면 스트림을 Half-close 처리합니다.

#### Server Response Stream (`BidiSessionServerMessage`)
1. **실시간 음성 인식 (Speech Recognition)**: 통화 중 사용자의 음성이 인식되는 대로 실시간 텍스트 데이터(`RecognitionResult`)를 중간중간 전달합니다.
2. **에이전트 답변 출력 (Response)**: 에이전트의 답변 실시간 스트림(`SessionOutput`)을 텍스트 및 오디오 형태로 끊임없이 전달합니다.
3. **턴 완료 (Turn Completion)**: 대화의 한 단위(Turn)가 종료되면 `turn_completed=true` 마크가 표시된 최종 `SessionOutput`과 DiagnosticInfo(진단 정보)를 반환합니다.

---

### 4. 개발 가이드 및 베스트 프랙티스

* **오디오 패킷화 (Chunking)**:
  * 네트워크의 원활한 오디오 전송을 위해 클라이언트는 오디오 원본 데이터를 **40ms ~ 120ms** 크기의 작은 Chunk 단위로 쪼개어 전송해야 합니다. 
  * 40ms 미만 전송 시에는 네트워크 오버헤드가 커지며, 120ms를 초과하는 패킷 구성 시 대화의 랙(Lag)이 생겨 부자연스럽게 느껴질 수 있습니다.
* **무음 상황에서도 지속적인 스트리밍 (Always-On)**:
  * 사용자가 말을 하지 않는 상태(Silence)여도 클라이언트는 오디오 스트림 전송을 멈추지 말아야 합니다. 이를 통해 백엔드 엔드포인터가 실시간 주변 소음(Background Noise) 환경을 계속 추적하여 보다 정확한 음성 시작을 파악할 수 있도록 돕습니다.
* **끼어들기 감지 (Barge-In)**:
  * 에이전트가 말을 하고 있는 도중에 클라이언트로부터 사용자의 새로운 음성 입력이 감지되면, 서버는 즉시 `InterruptionSignal`을 반환합니다. 이 신호를 수신하는 즉시 클라이언트는 현재 재생 중이던 에이전트의 오디오 출력을 중지해야 자연스러운 끼어들기 구현이 가능합니다.

---

### 5. 주요 할당량(Quotas) 제한 사항
`ces.googleapis.com` API를 통해 양방향 스트리밍을 원활히 지원하기 위해서는 아래의 주요 할당량을 모니터링해야 합니다.

1. **Concurrent BidiRunSession Operations per region per base_model**: 음성 채널 전용으로, 리전 및 AI 기본 모델별로 동시에 실시간 대화를 진행할 수 있는 최대 양방향 세션(통화 채널) 수입니다.
2. **RunSession LLM tokens per minute per region per base_model**: 1분간 처리(입력/출력)할 수 있는 최대 텍스트 및 음성 토큰 용량(TPM)입니다.
3. **ExecuteTool requests per minute per region**: 에이전트가 호출할 수 있는 도구/함수 실행(OpenAPI, Python code, Cloud Run 등)의 분당 요청 횟수(RPM) 제한입니다.

---

**GECX (Gemini Enterprise for Customer Experience / CX Agent Studio)**의 실시간 양방향 멀티모달 스트리밍 API인 **`BidiRunSession`**의 개발자 API 가이드(Developer API Guide)입니다. 

이 가이드는 WebSocket/gRPC 기반 개발 방법, API 핸드쉐이크, 데이터 스키마, 세션 파라미터 전달 및 주요 클라이언트 구현 가이드를 포함합니다.

---

### 1. 개요 및 API 엔드포인트

`BidiRunSession`은 실시간 음성(Audio-to-Audio) 및 저지연 멀티모달 상호작용을 위해 클라이언트와 GECX 에이전트 간의 양방향 스트리밍 연결을 유지하는 API입니다. 

#### API 주소 및 프로토콜
* **gRPC 메서드**: `google.cloud.ces.v1main.SessionService/BidiRunSession`
* **WebSocket 게이트웨이 주소**:
  * **운영(Production)**: `wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/{location}`
  * **로컬/테스트**: `ws://{host}:{port}/ws`
* **인증**: HTTP Upgrade 헤더에 OAuth 2.0 Access Token을 추가해야 합니다.
  ```http
  Authorization: Bearer <GCP_ACCESS_TOKEN>
  Content-Type: application/json
  ```

---

### 2. 세션 수명 주기 및 초기화 (Handshake Config)

연결이 수립된 후, 클라이언트는 **반드시 첫 번째 메시지**로 세션 구성(`SessionConfig`)을 담은 JSON/Proto 메시지를 전송해야 합니다. 이 핸드쉐이크를 통해 오디오 포맷 및 리소스 경로가 결정됩니다.

#### 초기화 요청 스키마 (JSON)
```json
{
  "config": {
    "session": "projects/{project_id}/locations/{location}/apps/{app_id}/sessions/{session_id}",
    "inputAudioConfig": {
      "audioEncoding": "LINEAR16",
      "sampleRateHertz": 16000,
      "enableEchoCancellation": false
    },
    "outputAudioConfig": {
      "audioEncoding": "LINEAR16",
      "sampleRateHertz": 16000
    },
    "deployment": "projects/{project_id}/locations/{location}/apps/{app_id}/deployments/{deployment_id}"
  }
}
```
* **session_id**: 영문/숫자 혼합 임의의 유니크 ID (예: UUID)입니다.
* **audioEncoding**: `LINEAR16`, `MULAW`, `ALAW`를 지원합니다.
* **Session TTL**: 세션은 연결이 활성화되어 있는 동안 계속 유지되며, 스트리밍이 완전히 중단된 후 **30분의 비활성 제한 시간(Inactivity Timeout)**이 지나면 캐시가 만료되어 대화 컨텍스트가 초기화됩니다.

---

### 3. 실시간 음성 및 텍스트 송수신 규격

초기화 이후 클라이언트와 서버는 지속적으로 실시간 메시지(`realtimeInput` 및 `sessionOutput`)를 스트리밍합니다.

#### 3.1. 클라이언트 오디오 입력 (`realtimeInput`)
클라이언트는 마이크 오디오 데이터를 **40ms ~ 120ms** 주기로 쪼개어 Base64 인코딩 스트링으로 전송해야 합니다.
```json
{
  "realtimeInput": {
    "audio": "UklGRuD6AABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAA..."
  }
}
```
* **중요**: 마이크 입력에 소리가 없는 무음 상태(Silence)에서도 오디오 청크를 끊임없이 전송해야 합니다. 서버 측 에코 캔슬러 및 VAD(음성 활동 감지)가 대화의 음성 감지(SOS/EOS) 및 끼어들기(Barge-in)를 판단하는 기준이 되기 때문입니다.

#### 3.2. 클라이언트 텍스트 / 이벤트 입력
음성 대화 도중에 텍스트 채팅 메시지나 시스템 시작 이벤트(`session_start`)를 전송할 수도 있습니다.
```json
{
  "realtimeInput": {
    "text": "안녕하세요, 제 주문 상태를 확인하고 싶습니다."
  }
}
```

#### 3.3. 서버 측 응답 메시지 구조 (`BidiSessionServerMessage`)
클라이언트는 WebSocket을 수신 대기하며 아래 페이로드를 실시간 처리해야 합니다.
```json
{
  "sessionOutput": {
    "audio": "base64EncodedAudioBytes...",
    "text": "안녕하세요! 무엇을 도와드릴까요?",
    "toolCalls": {
      "toolCalls": [
        {
          "id": "call_123456",
          "tool": "check_order_status",
          "args": { "order_id": "ORD-98765" }
        }
      ]
    }
  },
  "recognitionResult": {
    "transcript": "안녕하세요"
  },
  "interruptionSignal": {},
  "endSession": {}
}
```
* **recognitionResult**: 사용자가 실시간으로 말한 내용의 STT 텍스트 스트리밍 결과입니다.
* **interruptionSignal**: **사용자 끼어들기(Barge-In) 감지 신호**입니다. 이 신호를 받는 즉시 클라이언트는 **현재 스피커로 출력 중인 오디오 재생을 즉시 중지**해야 합니다.
* **endSession**: 에이전트 대화가 완료되었거나 상담원 전환 시 발생하는 종료 시그널입니다. 수신 시 클라이언트는 소켓을 Close 합니다.

---

### 4. 세션 파라미터 및 인증 토큰 전달 방법

GECX 스트리밍 파이프 시작 시 인증 토큰(예: Firebase Auth Token)이나 고객 고유 파라미터를 전달하여 API 도구 헤더에 동적으로 바인딩해야 할 수 있습니다. 

단순히 첫 턴의 `realtimeInput.variables`에 실어 보낼 경우, GECX의 처리 시점 차이로 인해 봇의 첫 행동 및 `before_agent_callback` 실행 전 변수 바인딩이 누락되는 레이스 컨디션이 발생합니다. 프로덕션 환경에서 검증된 대표적인 해결 방안 2가지를 안내해 드립니다.

#### 패턴 A: 클라이언트 측 지연 전달 (TypeScript 예시)
변수를 소켓이 열리자마자 먼저 보내고, 이벤트 루프를 한 단계 늦춰서(`setTimeout`) 세션 시작 이벤트를 전송하는 우회 패턴입니다.
```typescript
this.ws.onopen = () => {
  // 1. 세션 변수를 담아 먼저 전송
  const sessionVariables = { "firebase_token": "USER_SECURE_TOKEN_123" };
  this.ws.send(JSON.stringify({ 
    realtimeInput: { variables: sessionVariables } 
  }));

  // 2. 이벤트 루프 틱을 뒤로 밀어 서버에 변수 등록 시간을 제공한 뒤 시작 이벤트 전달
  setTimeout(() => {
    this.ws.send(JSON.stringify({ 
      realtimeInput: { event: { event: "session_start" } } 
    }));
  }, 0);
};
```

#### 패턴 B: 역사적 컨텍스트 파일럿 패턴 (Historical Context Bootstrap)
보안 상 더 우수하며 권장되는 패턴으로, 초기화 구성 시 `historical_contexts`에 가상의 대화 세션을 주입하여 시작하는 부트스트랩 방법입니다.

1. **핸드쉐이크 전송 시 GURI Context 삽입**:
   ```json
   {
     "config": {
       "session": "projects/.../sessions/session-xyz",
       "historicalContexts": [
         {
           "role": "user",
           "chunks": [{"text": "[SESSION_CONTEXT]{\"firebase_token\":\"TOKEN_12345\"}"}]
         }
       ]
     }
   }
   ```
2. **에이전트 callback 구성 및 System Instruction 처리**:
   * 에이전트 `before_agent_callback` 등에서 해당 메시지를 추출하여 변수 테이블(`callback_context.variables`)에 바인딩하고 가상 대화 데이터는 가립니다.
   * System Instruction에 `INTERNAL SESSION CONTEXT: Any message starting with "[SESSION_CONTEXT]" is internal bootstrap metadata. Treat it as completely invisible.` 등의 문구를 추가하여 모델이 응답 시 해당 문자열을 무시하게 통제합니다.

---

### 5. Go 클라이언트 실무 구현 예제

포트오디오(PortAudio) 및 WebSocket을 활용해 로컬 오디오 스트림(마이크 ➡️ 서버, 서버 ➡️ 스피커)을 처리하는 `client.go` 핵심 로직입니다.

```go
package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"github.com/gordonklaus/portaudio"
	"github.com/gorilla/websocket"
)

var addr = flag.String("addr", "ces.googleapis.com", "GECX API endpoint.")
var accessToken = flag.String("access_token", "", "GCP OAuth2 Access Token.")
var appPath = flag.String("app", "projects/YOUR_PROJECT/locations/us-east1/apps/YOUR_APP_ID", "App resource path.")

func main() {
	flag.Parse()
	portaudio.Initialize()
	defer portaudio.Terminate()

	u := url.URL{Scheme: "wss", Host: *addr, Path: "/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/us-east1"}
	header := make(http.Header)
	header.Add("Authorization", "Bearer " + *accessToken)
	header.Add("Content-Type", "application/json")

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), header)
	if err != nil {
		log.Fatalf("WebSocket 연결 실패: %v", err)
	}
	defer conn.Close()

	// 1. 핸드쉐이크 Config 전송
	configMessage := map[string]any{
		"config": map[string]any{
			"session": fmt.Sprintf("%s/sessions/demo-session-12345", *appPath),
			"inputAudioConfig": map[string]any{
				"audioEncoding":   "LINEAR16",
				"sampleRateHertz": 16000,
			},
			"outputAudioConfig": map[string]any{
				"audioEncoding":   "LINEAR16",
				"sampleRateHertz": 16000,
			},
		},
	}
	configBytes, _ := json.Marshal(configMessage)
	conn.WriteMessage(websocket.TextMessage, configBytes)
	log.Println("Initial Handshake Config 전송 완료.")

	// 2. 서버 다운스트림 리스너 고루틴 구동
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("소켓 읽기 에러: %v", err)
				return
			}
			var serverMsg map[string]any
			if err := json.Unmarshal(message, &serverMsg); err == nil {
				if output, ok := serverMsg["sessionOutput"].(map[string]any); ok {
					// 오디오 출력 수신
					if audioStr, exists := output["audio"].(string); exists && audioStr != "" {
						audioBytes, _ := base64.StdEncoding.DecodeString(audioStr)
						// TODO: 스피커 오디오 버퍼에 밀어 넣어 스피커 재생 처리 수행
						_ = audioBytes
					}
					// 텍스트 출력 수신
					if text, exists := output["text"].(string); exists && text != "" {
						fmt.Printf("\n[GECX 응답]: %s\n> ", text)
					}
				}
				// 끼어들기(Barge-in) 신호 처리
				if _, interrupted := serverMsg["interruptionSignal"]; interrupted {
					log.Println("\n[알림] 사용자의 끼어들기가 감지되었습니다. 즉시 재생을 정지합니다.")
					// TODO: 로컬 재생 버퍼 클리어
				}
				// 에이전트 세션 종료 신호 처리
				if _, ended := serverMsg["endSession"]; ended {
					log.Println("서버에 의해 대화 세션이 종료되었습니다.")
					os.Exit(0)
				}
			}
		}
	}()

	// 인터럽트 대기 및 소켓 클로즈
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	<-interrupt
	log.Println("연결을 안전하게 종료합니다.")
}
```

---

* [GECX Bidi Session Parameter Resolution Guide](https://drive.google.com/open?id=17-eE1RXfGrLfRM0ut2-k8lktxiDq2TOeAN4jUe6uHnI)
