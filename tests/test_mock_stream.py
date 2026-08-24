import time
import json
import base64
import threading
import asyncio
import unittest
from bff.config import settings
from tests.mock_gecx_server import MockGECXServer
from fastapi.testclient import TestClient
from bff.main import app

class TestMockStreamingE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_port = 8769
        settings.MOCK_GECX_ENDPOINT = f"ws://127.0.0.1:{cls.mock_port}"
        cls.mock_server = MockGECXServer(
            host="127.0.0.1",
            port=cls.mock_port,
            disconnect_delay_sec=10.0,
            close_code=1006
        )

        def run_mock():
            cls.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(cls.loop)
            cls.loop.run_until_complete(cls.mock_server.start())
            cls.loop.run_forever()

        cls.thread = threading.Thread(target=run_mock, daemon=True)
        cls.thread.start()
        time.sleep(0.3)  # Wait for server to bind

    @classmethod
    def tearDownClass(cls):
        settings.MOCK_GECX_ENDPOINT = ""
        if hasattr(cls, "loop") and cls.loop.is_running():
            cls.loop.call_soon_threadsafe(cls.loop.stop)

    def test_control_plane_session_start(self):
        client = TestClient(app)
        response = client.post("/api/v1/session/start", json={"client_id": "test-client"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("session_id", data)
        self.assertIn("session_ticket", data)
        self.assertEqual(data["ws_endpoint"], "/ws/stream")
        self.assertEqual(data["audio_config"]["sample_rate_hertz"], 16000)

    def test_websocket_proxy_with_mock_gecx(self):
        client = TestClient(app)
        res = client.post("/api/v1/session/start", json={"client_id": "test-client"})
        ticket = res.json()["session_ticket"]

        with client.websocket_connect(f"/ws/stream?ticket={ticket}") as websocket:
            # 1. First frame is session_ready
            msg1 = websocket.receive_json()
            self.assertEqual(msg1.get("event"), "session_ready")

            # 2. Server output greeting from mock GECX
            msg2 = websocket.receive_json()
            self.assertIn("sessionOutput", msg2)
            self.assertIn("Mock GECX Server", msg2["sessionOutput"]["text"])

            # 3. Send audio chunk
            dummy_audio = base64.b64encode(b"\x00\x00" * 800).decode("utf-8")
            websocket.send_text(json.dumps({
                "realtimeInput": {"audio": dummy_audio}
            }))

            # Clean exit
            websocket.close()

if __name__ == "__main__":
    unittest.main()
