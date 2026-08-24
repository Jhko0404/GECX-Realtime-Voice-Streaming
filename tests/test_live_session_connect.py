import asyncio
import json
import httpx
import websockets
import time

GATEWAY_URL = "https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev"

async def run_single_session_test(test_idx: int):
    print(f"\n==========================================")
    print(f"▶ [Test #{test_idx}] Starting Live End-to-End Test")
    print(f"==========================================")
    
    # 1. Start session via API Gateway
    start_time = time.time()
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{GATEWAY_URL}/api/v1/session/start",
            json={"client_id": f"e2e-test-runner-{test_idx}"},
            timeout=10.0
        )
        assert res.status_code == 200, f"Session start failed: {res.text}"
        data = res.json()
    
    session_id = data["session_id"]
    ticket = data["session_ticket"]
    ws_endpoint = data["ws_endpoint"]
    control_latency_ms = (time.time() - start_time) * 1000
    
    print(f"  ✔ [Control Plane] Session Created: {session_id}")
    print(f"  ✔ [Control Plane] Endpoint: {ws_endpoint}")
    print(f"  ✔ [Control Plane] Latency: {control_latency_ms:.2f}ms")
    
    # 2. Connect WebSocket to Cloud Run with ticket
    ws_url = f"{ws_endpoint}?ticket={ticket}"
    ws_connect_start = time.time()
    
    async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
        ws_latency_ms = (time.time() - ws_connect_start) * 1000
        print(f"  ✔ [Data Plane] WebSocket Connected: {ws_latency_ms:.2f}ms")
        
        # 3. Wait for session_ready frame
        init_frame_raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
        init_frame = json.loads(init_frame_raw)
        print(f"  ✔ [Handshake] Received Server Event: {init_frame.get('event')}")
        assert init_frame.get("event") == "session_ready", f"Unexpected frame: {init_frame}"
        assert init_frame.get("sessionId") == session_id
        
        # 4. Stream 60 audio chunks (3 seconds of 50ms chunks)
        dummy_pcm = b"\x00\x00" * 800  # 1600 bytes = 50ms at 16kHz 16-bit
        print(f"  ✔ [Streaming] Sending 60 audio chunks (50ms interval)...")
        for chunk_idx in range(60):
            await ws.send(dummy_pcm)
            await asyncio.sleep(0.05)
            
        print(f"  ✔ [Streaming] 60 chunks sent successfully without connection drop!")
        
        # 5. Clean close
        await ws.close(code=1000, reason="Test Completed")
        print(f"  🎉 [Test #{test_idx}] PASSED COMPLETELY!\n")

async def main():
    print("🚀 Running 5 consecutive live session tests to verify connection stability...")
    for i in range(1, 6):
        await run_single_session_test(i)
        await asyncio.sleep(1)
    print("\n========================================================")
    print("🏆 ALL 5 CONSECUTIVE LIVE TESTS PASSED WITH 100% SUCCESS!")
    print("========================================================")

if __name__ == "__main__":
    asyncio.run(main())
