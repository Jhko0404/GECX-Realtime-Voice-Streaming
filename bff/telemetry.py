import math
import time
import base64
import structlog
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

logger = structlog.get_logger("gecx.telemetry")

RFC_6455_CLOSE_CODES = {
    1000: "CLOSE_NORMAL",
    1001: "CLOSE_GOING_AWAY",
    1002: "CLOSE_PROTOCOL_ERROR",
    1003: "CLOSE_UNSUPPORTED",
    1005: "CLOSED_NO_STATUS",
    1006: "CLOSE_ABNORMAL (Disconnection without Close Frame)",
    1007: "CLOSE_UNSUPPORTED_DATA",
    1008: "CLOSE_POLICY_VIOLATION",
    1009: "CLOSE_TOO_LARGE",
    1010: "CLOSE_MANDATORY_EXTENSION",
    1011: "CLOSE_SERVER_ERROR",
    1012: "CLOSE_SERVICE_RESTART",
    1013: "CLOSE_TRY_AGAIN_LATER",
    1014: "CLOSE_BAD_GATEWAY",
    1015: "CLOSE_TLS_HANDSHAKE_FAIL"
}

def calculate_audio_rms_and_db(base64_audio: str) -> tuple[float, float]:
    """Calculates RMS and decibels (dB FS) from base64-encoded LINEAR16 PCM audio."""
    try:
        raw_bytes = base64.b64decode(base64_audio)
        if len(raw_bytes) < 2:
            return 0.0, -100.0
        
        # 16-bit signed integer count
        num_samples = len(raw_bytes) // 2
        sum_squares = 0.0
        
        for i in range(0, len(raw_bytes) - 1, 2):
            sample = int.from_bytes(raw_bytes[i:i+2], byteorder='little', signed=True)
            sum_squares += sample * sample

        rms = math.sqrt(sum_squares / num_samples)
        # Avoid log of zero with small epsilon
        db = 20.0 * math.log10((rms + 1e-7) / 32768.0)
        return rms, max(-100.0, db)
    except Exception:
        return 0.0, -100.0

class SocketCloseInfo(BaseModel):
    raw_close_code: int
    close_code_name: str
    close_reason: str
    grpc_status_code: Optional[str] = None
    gcp_error_details: Optional[Dict[str, Any]] = None

class ChunkPayloadMetrics(BaseModel):
    total_audio_chunks_sent: int = 0
    total_bytes_sent: int = 0
    total_chunks_received: int = 0
    total_bytes_received: int = 0
    average_chunk_interval_ms: float = 0.0
    last_chunk_sent_before_ms: float = 0.0
    last_silence_duration_sec: float = 0.0
    mean_audio_rms_db: float = -100.0

class DiagnosticTraceEvent(BaseModel):
    trace_id: str
    session_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    epoch_ms: int
    elapsed_session_sec: float
    event_type: str
    source_layer: str
    payload_metrics: ChunkPayloadMetrics
    socket_close_info: Optional[SocketCloseInfo] = None

class SessionTelemetryTracker:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.start_time = time.time()
        self.last_chunk_time = self.start_time
        self.total_chunks_sent = 0
        self.total_bytes_sent = 0
        self.total_chunks_received = 0
        self.total_bytes_received = 0
        self.silence_start_time: Optional[float] = None
        self.current_silence_sec = 0.0
        self.latest_rms_db = -100.0

    def record_client_chunk(self, base64_audio: str) -> Dict[str, Any]:
        now = time.time()
        chunk_interval_ms = (now - self.last_chunk_time) * 1000.0
        self.last_chunk_time = now
        
        try:
            raw_size = len(base64.b64decode(base64_audio))
        except Exception:
            raw_size = (len(base64_audio) * 3) // 4

        self.total_chunks_sent += 1
        self.total_bytes_sent += raw_size

        rms, db = calculate_audio_rms_and_db(base64_audio)
        self.latest_rms_db = db

        if db < -50.0:  # Silence threshold
            if self.silence_start_time is None:
                self.silence_start_time = now
            self.current_silence_sec = now - self.silence_start_time
        else:
            self.silence_start_time = None
            self.current_silence_sec = 0.0

        elapsed_sec = now - self.start_time

        metric = {
            "session_id": self.session_id,
            "elapsed_sec": round(elapsed_sec, 3),
            "seq": self.total_chunks_sent,
            "bytes_sent": self.total_bytes_sent,
            "chunk_interval_ms": round(chunk_interval_ms, 2),
            "rms_db": round(db, 1),
            "silence_sec": round(self.current_silence_sec, 2),
        }
        return metric

    def record_server_output(self, payload_size: int):
        self.total_chunks_received += 1
        self.total_bytes_received += payload_size

    def create_disconnect_report(self, close_code: int, reason: str, gcp_error: Optional[Dict[str, Any]] = None) -> DiagnosticTraceEvent:
        now = time.time()
        elapsed_sec = now - self.start_time
        code_name = RFC_6455_CLOSE_CODES.get(close_code, f"UNKNOWN_CODE_{close_code}")

        close_info = SocketCloseInfo(
            raw_close_code=close_code,
            close_code_name=code_name,
            close_reason=reason or "Remote peer disconnected",
            gcp_error_details=gcp_error
        )

        metrics = ChunkPayloadMetrics(
            total_audio_chunks_sent=self.total_chunks_sent,
            total_bytes_sent=self.total_bytes_sent,
            total_chunks_received=self.total_chunks_received,
            total_bytes_received=self.total_bytes_received,
            average_chunk_interval_ms=50.0,
            last_chunk_sent_before_ms=round((now - self.last_chunk_time) * 1000.0, 2),
            last_silence_duration_sec=round(self.current_silence_sec, 2),
            mean_audio_rms_db=round(self.latest_rms_db, 1)
        )

        event = DiagnosticTraceEvent(
            trace_id=f"tr-{int(now*1000)}",
            session_id=self.session_id,
            epoch_ms=int(now * 1000),
            elapsed_session_sec=round(elapsed_sec, 3),
            event_type="SOCKET_DISCONNECTED",
            source_layer="BFF_UPSTREAM_GECX",
            payload_metrics=metrics,
            socket_close_info=close_info
        )

        logger.info("gecx_disconnection_observed", **event.model_dump())
        return event
