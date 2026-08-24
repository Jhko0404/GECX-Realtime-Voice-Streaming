import json
import asyncio
import websockets
import structlog
from typing import AsyncGenerator, Dict, Any, Optional
from bff.config import settings
from bff.telemetry import SessionTelemetryTracker

logger = structlog.get_logger("gecx.client")

class GECXStreamingClient:
    def __init__(self, session_id: str, telemetry: SessionTelemetryTracker):
        self.session_id = session_id
        self.telemetry = telemetry
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False

    async def connect_and_handshake(self) -> None:
        """Establishes upstream WSS connection to GECX and sends initial SessionConfig."""
        url = settings.gecx_websocket_url
        access_token = settings.get_gcp_access_token()

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        logger.info("gecx_upstream_connecting", url=url, session_id=self.session_id)

        # Connect with 3600s ping/pong keepalive
        self.ws = await websockets.connect(
            url,
            additional_headers=headers,
            ping_interval=10,
            ping_timeout=5,
            close_timeout=5
        )
        self.is_connected = True

        # Send Initial SessionConfig Handshake
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

        handshake_payload = {"config": config_obj}

        await self.ws.send(json.dumps(handshake_payload))
        logger.info("gecx_handshake_sent", session=self.session_id)

    async def send_audio_chunk(self, base64_audio: str) -> None:
        """Forwards a 50ms audio chunk to GECX."""
        if not self.ws or not self.is_connected:
            return

        payload = {
            "realtimeInput": {
                "audio": base64_audio
            }
        }
        try:
            await self.ws.send(json.dumps(payload))
        except Exception:
            pass

    async def receive_stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Yields streaming server responses from GECX."""
        if not self.ws:
            return

        try:
            async for raw_message in self.ws:
                try:
                    data = json.loads(raw_message)
                    self.telemetry.record_server_output(len(raw_message))
                    yield data
                except json.JSONDecodeError:
                    continue
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning("gecx_upstream_connection_closed", 
                           code=e.code, reason=e.reason, session_id=self.session_id)
            # Pass the close info to telemetry
            self.telemetry.create_disconnect_report(close_code=e.code, reason=e.reason)
            raise e
        finally:
            self.is_connected = False

    async def close(self, code: int = 1000, reason: str = "Client closed"):
        if self.ws and self.is_connected:
            self.is_connected = False
            try:
                await self.ws.close(code=code, reason=reason)
            except Exception:
                pass
