export type ConnectionState = 'IDLE' | 'CONNECTING' | 'LIVE' | 'DISCONNECTED' | 'ERROR';

export interface AudioConfig {
  sampleRate: number;
  chunkDurationMs: number;
}

export interface SessionResponse {
  session_id: string;
  session_ticket: string;
  ws_endpoint: string;
  ticket_ttl_seconds: number;
  app_resource_path: string;
  audio_config: {
    encoding: string;
    sample_rate_hertz: number;
    chunk_duration_ms: number;
  };
}

export interface TelemetryMetric {
  session_id: string;
  elapsed_sec: number;
  seq: number;
  bytes_sent: number;
  chunk_interval_ms: number;
  rms_db: number;
  silence_sec: number;
}

export interface WebSocketFrame {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  type: 'AUDIO_CHUNK' | 'STT_TRANSCRIPT' | 'AGENT_OUTPUT' | 'INTERRUPT' | 'SYSTEM';
  summary: string;
  sizeBytes: number;
  payload: any;
}

export interface RcaReport {
  trace_id: string;
  session_id: string;
  timestamp: string;
  epoch_ms: number;
  elapsed_session_sec: number;
  event_type: string;
  source_layer: string;
  payload_metrics: {
    total_audio_chunks_sent: number;
    total_bytes_sent: number;
    total_chunks_received: number;
    total_bytes_received: number;
    average_chunk_interval_ms: number;
    last_chunk_sent_before_ms: number;
    last_silence_duration_sec: number;
    mean_audio_rms_db: number;
  };
  socket_close_info: {
    raw_close_code: number;
    close_code_name: string;
    close_reason: string;
    grpc_status_code?: string;
    gcp_error_details?: any;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isFinal?: boolean;
  latencyMs?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AUDIO';
  tag: string;
  message: string;
  details?: any;
}

