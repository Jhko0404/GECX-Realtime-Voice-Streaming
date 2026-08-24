import os
import json
import uuid
import asyncio
import structlog
import websockets
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from bff.config import settings
from bff.auth import create_session_ticket, verify_session_ticket
from bff.telemetry import SessionTelemetryTracker, RFC_6455_CLOSE_CODES
from bff.gecx_client import GECXStreamingClient

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger("gecx.bff")

app = FastAPI(
    title="GECX Streaming API BFF Gateway",
    description="Backend-for-Frontend & Diagnostic Telemetry Gateway for GECX BidiRunSession",
    version="1.0.0"
)

# CORS middleware for Web Client Ingress
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for latest session telemetry traces
recent_telemetry_logs: Dict[str, Any] = {}

class SessionStartRequest(BaseModel):
    client_id: Optional[str] = "web-client"
    app_id: Optional[str] = None
    sample_rate: Optional[int] = 16000

class SessionStartResponse(BaseModel):
    session_id: str
    session_ticket: str
    ws_endpoint: str
    ticket_ttl_seconds: int
    app_resource_path: str
    audio_config: Dict[str, Any]

@app.get("/health")
@app.get("/healthz")
async def health_check():
    return {"status": "UP", "service": settings.SERVICE_NAME, "project": settings.PROJECT_ID}

@app.post("/api/v1/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest, request: Request):
    """Control Plane: Initiates a new session and returns a signed JWT ticket."""
    session_id = f"sess-{uuid.uuid4()}"
    ticket = create_session_ticket(session_id=session_id)
    
    # Determine appropriate WebSocket endpoint
    ws_endpoint = "/ws/stream"
    host_header = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if "gateway.dev" in host_header or os.getenv("K_SERVICE"):
        ws_endpoint = "wss://gecx-streaming-bff-cwljmdzpfa-uc.a.run.app/ws/stream"
    
    response = SessionStartResponse(
        session_id=session_id,
        session_ticket=ticket,
        ws_endpoint=ws_endpoint,
        ticket_ttl_seconds=60,
        app_resource_path=settings.gecx_app_resource_path,
        audio_config={
            "encoding": "LINEAR16",
            "sample_rate_hertz": 16000,
            "chunk_duration_ms": 50
        }
    )
    logger.info("session_started_control_plane", session_id=session_id, ws_endpoint=ws_endpoint)
    return response

@app.get("/api/v1/telemetry/{session_id}")
async def get_session_telemetry(session_id: str):
    """Retrieves recorded RCA and diagnostic traces for a session."""
    if session_id in recent_telemetry_logs:
        return recent_telemetry_logs[session_id]
    raise HTTPException(status_code=404, detail="Session telemetry not found")

@app.websocket("/ws/stream")
async def websocket_streaming_endpoint(
    websocket: WebSocket,
    ticket: Optional[str] = Query(None)
):
    """Data Plane: Validates session ticket, connects to GECX BidiRunSession, and proxies audio/text."""
    # 1. Authorize JWT ticket (allow bypass if mock mode is on)
    claims = None
    if ticket:
        claims = verify_session_ticket(ticket)
    elif settings.MOCK_GECX_ENDPOINT:
        claims = {"sub": f"sess-mock-{uuid.uuid4()}"}

    if not claims:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or Expired Session Ticket")
        logger.warning("websocket_rejected_invalid_ticket")
        return

    session_id = claims.get("sub", f"sess-{uuid.uuid4()}")
    await websocket.accept()
    logger.info("client_websocket_accepted", session_id=session_id)

    telemetry = SessionTelemetryTracker(session_id=session_id)
    gecx_client = GECXStreamingClient(session_id=session_id, telemetry=telemetry)

    # 2. Notify client that session is ready
    await websocket.send_json({
        "event": "session_ready",
        "sessionId": session_id,
        "audioConfig": {
            "sampleRate": 16000,
            "chunkDurationMs": 50
        }
    })

    # 3. Connect to GECX Upstream
    try:
        await gecx_client.connect_and_handshake()
    except Exception as e:
        logger.error("gecx_upstream_handshake_failed", error=str(e), session_id=session_id)
        await websocket.send_json({
            "event": "error",
            "message": f"Upstream GECX connection failed: {str(e)}"
        })
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="GECX Handshake Failed")
        return

    # 4. Bidirectional Streaming Tasks
    async def client_to_gecx_loop():
        """Reads audio chunks from client (text JSON or binary PCM) and forwards to GECX."""
        try:
            while True:
                message = await websocket.receive()
                if "text" in message and message["text"]:
                    try:
                        payload = json.loads(message["text"])
                    except json.JSONDecodeError:
                        continue

                    if "realtimeInput" in payload and "audio" in payload["realtimeInput"]:
                        base64_audio = payload["realtimeInput"]["audio"]
                        metrics = telemetry.record_client_chunk(base64_audio)
                        await gecx_client.send_audio_chunk(base64_audio)
                        if metrics["seq"] % 10 == 0:
                            await websocket.send_json({"telemetry": metrics})
                elif "bytes" in message and message["bytes"]:
                    import base64
                    raw_bytes = message["bytes"]
                    base64_audio = base64.b64encode(raw_bytes).decode("utf-8")
                    metrics = telemetry.record_client_chunk(base64_audio)
                    await gecx_client.send_audio_chunk(base64_audio)
                    if metrics["seq"] % 10 == 0:
                        await websocket.send_json({"telemetry": metrics})
                elif message.get("type") == "websocket.disconnect":
                    break
        except WebSocketDisconnect:
            logger.info("client_disconnected_cleanly", session_id=session_id)
        except Exception as e:
            logger.warning("client_loop_exception", error=str(e), session_id=session_id)

    async def gecx_to_client_loop():
        """Reads recognitionResult and sessionOutput from GECX and forwards to client."""
        try:
            async for server_msg in gecx_client.receive_stream():
                await websocket.send_json(server_msg)
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning("upstream_closed_in_loop", code=e.code, reason=e.reason, session_id=session_id)
            # Create RCA report
            disconnect_report = telemetry.create_disconnect_report(
                close_code=e.code,
                reason=e.reason
            )
            recent_telemetry_logs[session_id] = disconnect_report.model_dump()
            
            # Send disconnect diagnosis to client before closing
            try:
                await websocket.send_json({
                    "event": "disconnected",
                    "rca_report": disconnect_report.model_dump()
                })
            except Exception:
                pass
            
            await websocket.close(code=e.code if e.code in [1000, 1001] else 1006, 
                                  reason=e.reason or "Upstream Disconnected")
        except Exception as e:
            logger.error("upstream_loop_error", error=str(e), session_id=session_id)

    try:
        await asyncio.gather(
            client_to_gecx_loop(),
            gecx_to_client_loop()
        )
    finally:
        await gecx_client.close()
        logger.info("session_finished", session_id=session_id)

# Serve Web Frontend static files if built
web_dist = Path(__file__).parent.parent / "web" / "dist"
if web_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(web_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = web_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(web_dist / "index.html")
