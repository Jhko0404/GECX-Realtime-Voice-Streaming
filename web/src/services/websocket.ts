import { SessionResponse, WebSocketFrame, RcaReport, TelemetryMetric } from '../types';

export interface WebSocketServiceCallbacks {
  onReady: (sessionId: string) => void;
  onSTT: (transcript: string, isFinal: boolean) => void;
  onAgentOutput: (text: string, audio?: string, turnCompleted?: boolean) => void;
  onBargeIn: () => void;
  onTelemetry: (metric: TelemetryMetric) => void;
  onDisconnected: (rcaReport: RcaReport) => void;
  onError: (error: string) => void;
  onFrame: (frame: WebSocketFrame) => void;
}

export class StreamingWebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketServiceCallbacks;
  public isConnected: boolean = false;
  public currentSessionId: string = '';

  private hasReceivedExplicitRcaReport = false;

  constructor(callbacks: WebSocketServiceCallbacks) {
    this.callbacks = callbacks;
  }

  async startSession(): Promise<SessionResponse> {
    this.hasReceivedExplicitRcaReport = false;
    const res = await fetch('/api/v1/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'gecx-web-console' }),
    });

    if (!res.ok) {
      throw new Error(`Failed to start session: ${res.statusText}`);
    }

    const data: SessionResponse = await res.json();
    this.currentSessionId = data.session_id;
    return data;
  }

  connect(wsEndpoint: string, ticket: string): Promise<void> {
    this.hasReceivedExplicitRcaReport = false;
    return new Promise((resolve, reject) => {
      let url: string;
      if (wsEndpoint && (wsEndpoint.startsWith('ws://') || wsEndpoint.startsWith('wss://'))) {
        const delimiter = wsEndpoint.includes('?') ? '&' : '?';
        url = `${wsEndpoint}${delimiter}ticket=${encodeURIComponent(ticket)}`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.host;
        // Google Cloud API Gateway does not support WebSocket passthrough; route to Cloud Run BFF
        if (host.includes('gateway.dev')) {
          host = 'gecx-streaming-bff-cwljmdzpfa-uc.a.run.app';
        }
        url = `${protocol}//${host}${wsEndpoint}?ticket=${encodeURIComponent(ticket)}`;
      }

      console.log('[StreamingWebSocketService] Connecting WebSocket to:', url);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emitFrame('TX', 'SYSTEM', 'WebSocket Handshake Connected', 0, { url });
        resolve();
      };

      this.ws.onerror = (err) => {
        this.callbacks.onError('WebSocket connection error');
        reject(err);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const sizeBytes = event.data.length;

          if (payload.event === 'session_ready') {
            this.callbacks.onReady(payload.sessionId);
            this.emitFrame('RX', 'SYSTEM', `Session Ready (${payload.sessionId})`, sizeBytes, payload);
          } else if (payload.recognitionResult) {
            const transcript = payload.recognitionResult.transcript;
            const isFinal = !!payload.recognitionResult.isFinal;
            this.callbacks.onSTT(transcript, isFinal);
            this.emitFrame('RX', 'STT_TRANSCRIPT', `STT: "${transcript}" (final=${isFinal})`, sizeBytes, payload);
          } else if (payload.sessionOutput) {
            const text = payload.sessionOutput.text || '';
            const audio = payload.sessionOutput.audio;
            const turnCompleted = !!payload.sessionOutput.turnCompleted;
            this.callbacks.onAgentOutput(text, audio, turnCompleted);
            this.emitFrame('RX', 'AGENT_OUTPUT', `Agent: "${text}"`, sizeBytes, payload);
          } else if (payload.interruptionSignal) {
            this.callbacks.onBargeIn();
            this.emitFrame('RX', 'INTERRUPT', 'Barge-In Interruption Signal', sizeBytes, payload);
          } else if (payload.telemetry) {
            this.callbacks.onTelemetry(payload.telemetry);
          } else if (payload.event === 'disconnected' && payload.rca_report) {
            this.hasReceivedExplicitRcaReport = true;
            this.callbacks.onDisconnected(payload.rca_report);
            this.emitFrame('RX', 'SYSTEM', `Disconnected (Code: ${payload.rca_report.socket_close_info.raw_close_code})`, sizeBytes, payload);
          } else if (payload.event === 'error') {
            this.callbacks.onError(payload.message || 'Server error');
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.emitFrame('RX', 'SYSTEM', `WebSocket Closed (Code ${event.code}: ${event.reason})`, 0, {
          code: event.code,
          reason: event.reason,
        });

        // If no explicit rca_report was received beforehand from backend, synthesize fallback
        if (!this.hasReceivedExplicitRcaReport && event.code !== 1000 && event.code !== 1001) {
          this.callbacks.onDisconnected({
            trace_id: `tr-${Date.now()}`,
            session_id: this.currentSessionId,
            timestamp: new Date().toISOString(),
            epoch_ms: Date.now(),
            elapsed_session_sec: 0,
            event_type: 'SOCKET_DISCONNECTED',
            source_layer: 'BFF_UPSTREAM_GECX',
            payload_metrics: {
              total_audio_chunks_sent: 0,
              total_bytes_sent: 0,
              total_chunks_received: 0,
              total_bytes_received: 0,
              average_chunk_interval_ms: 50,
              last_chunk_sent_before_ms: 0,
              last_silence_duration_sec: 0,
              mean_audio_rms_db: -100,
            },
            socket_close_info: {
              raw_close_code: event.code,
              close_code_name: event.code === 1006 ? 'CLOSE_ABNORMAL (No Close Frame Received)' : `CLOSE_CODE_${event.code}`,
              close_reason: event.reason || 'Peer connection terminated unexpectedly',
            },
          });
        }
      };
    });
  }

  sendAudioChunk(base64Audio: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      realtimeInput: {
        audio: base64Audio,
      },
    };
    const jsonStr = JSON.stringify(payload);
    this.ws.send(jsonStr);

    this.emitFrame('TX', 'AUDIO_CHUNK', '50ms Audio Chunk (1600B)', jsonStr.length, payload);
  }

  private emitFrame(direction: 'TX' | 'RX', type: any, summary: string, sizeBytes: number, payload: any) {
    const frame: WebSocketFrame = {
      id: `f-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString().substring(11, 23),
      direction,
      type,
      summary,
      sizeBytes,
      payload,
    };
    this.callbacks.onFrame(frame);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
      this.isConnected = false;
    }
  }
}
