#!/usr/bin/env python3
"""
10-Minute Continuous Streaming Stress Test & Socket Timeout Diagnostic Runner
Simulates continuous 50ms LINEAR16 audio streaming to verify 80~120s timeout hypotheses.
"""
import sys
import time
import json
import math
import struct
import base64
import asyncio
import httpx
import websockets
from datetime import datetime

TARGET_HOST = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
DURATION_LIMIT_SEC = float(sys.argv[2]) if len(sys.argv) > 2 else 600.0  # 10 minutes

def generate_50ms_pcm_chunk(seq: int, is_speech: bool = True) -> str:
    """Generates 50ms (800 samples = 1600 bytes) of 16kHz LINEAR16 audio."""
    num_samples = 800
    sample_rate = 16000
    freq = 440.0
    amplitude = 12000.0 if is_speech else 200.0  # Speech vs background ambient noise

    raw_bytes = bytearray()
    for i in range(num_samples):
        sample_val = int(amplitude * math.sin(2 * math.pi * freq * (seq * num_samples + i) / sample_rate))
        raw_bytes.extend(struct.pack("<h", sample_val))

    return base64.b64encode(raw_bytes).decode("utf-8")

async def run_stress_test():
    print("=" * 60)
    print("🔬 GECX 10-Minute Streaming Stress Test & Timeout Diagnostic")
    print(f"👉 Target Host:    {TARGET_HOST}")
    print(f"👉 Target Duration: {DURATION_LIMIT_SEC:.0f} seconds (10 Minutes)")
    print("=" * 60)

    # 1. Start Control Plane Session
    print("\n[Step 1] Requesting session start & ephemeral ticket...")
    async with httpx.AsyncClient() as client:
        start_url = f"{TARGET_HOST}/api/v1/session/start"
        res = await client.post(start_url, json={"client_id": "stress-test-runner"}, timeout=10.0)
        if res.status_code != 200:
            print(f"❌ Session start failed: {res.status_code} - {res.text}")
            return
        data = res.json()

    session_id = data["session_id"]
    ticket = data["session_ticket"]
    ws_endpoint = data["ws_endpoint"]

    ws_protocol = "wss" if TARGET_HOST.startswith("https") else "ws"
    host_clean = TARGET_HOST.replace("https://", "").replace("http://", "")
    ws_url = f"{ws_protocol}://{host_clean}{ws_endpoint}?ticket={ticket}"

    print(f"✔ Session Created: {session_id}")
    print(f"✔ WebSocket URL:  {ws_url}")

    # 2. Open WebSocket Stream
    print("\n[Step 2] Establishing WebSocket connection and streaming audio...")
    start_time = time.time()
    chunks_sent = 0
    stt_received = 0
    agent_outputs_received = 0
    disconnect_reason = "Completed without disconnection"
    close_code = 1000

    try:
        async with websockets.connect(ws_url, ping_interval=10, ping_timeout=5) as ws:
            # Expect session_ready
            first_msg = await ws.recv()
            print(f"✔ Handshake Response: {first_msg}")

            async def send_audio_loop():
                nonlocal chunks_sent
                seq = 0
                while True:
                    elapsed = time.time() - start_time
                    if elapsed >= DURATION_LIMIT_SEC:
                        break

                    # Alternate 4 seconds of speech with 2 seconds of ambient noise
                    is_speech = (int(elapsed) % 6) < 4
                    chunk_b64 = generate_50ms_pcm_chunk(seq, is_speech=is_speech)
                    payload = {"realtimeInput": {"audio": chunk_b64}}
                    await ws.send(json.dumps(payload))
                    chunks_sent += 1
                    seq += 1

                    if seq % 40 == 0:  # Every 2 seconds
                        print(f"  ⏱️  Elapsed: {elapsed:5.1f}s | Chunks: {chunks_sent:5d} | Voice: {'ACTIVE' if is_speech else 'SILENCE'}")

                    await asyncio.sleep(0.050)  # Exact 50ms interval

            async def receive_loop():
                nonlocal stt_received, agent_outputs_received
                async for raw in ws:
                    msg = json.loads(raw)
                    if "recognitionResult" in msg:
                        stt_received += 1
                    if "sessionOutput" in msg:
                        agent_outputs_received += 1

            await asyncio.gather(send_audio_loop(), receive_loop())

    except websockets.exceptions.ConnectionClosed as e:
        close_code = e.code
        disconnect_reason = e.reason or "Closed by remote peer"
        elapsed_at_disconnect = time.time() - start_time
        print(f"\n⚠️  [DISCONNECTION DETECTED] at {elapsed_at_disconnect:.2f} seconds!")
        print(f"👉 RFC 6455 Close Code: {close_code}")
        print(f"👉 Reason:             {disconnect_reason}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")

    total_elapsed = time.time() - start_time

    # 3. RCA Analysis
    rca_diagnosis = "NORMAL_COMPLETION"
    if close_code == 1006:
        if 75.0 <= total_elapsed <= 125.0:
            rca_diagnosis = "CONFIRMED_GECX_80_120S_HARD_TIMEOUT (Server-Side Reset)"
        else:
            rca_diagnosis = "INFRASTRUCTURE_OR_PROXY_IDLE_TIMEOUT"

    report = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "target_host": TARGET_HOST,
        "session_id": session_id,
        "test_duration_target_sec": DURATION_LIMIT_SEC,
        "actual_elapsed_sec": round(total_elapsed, 2),
        "total_audio_chunks_sent": chunks_sent,
        "stt_messages_received": stt_received,
        "agent_outputs_received": agent_outputs_received,
        "close_code": close_code,
        "close_reason": disconnect_reason,
        "rca_diagnosis": rca_diagnosis
    }

    report_file = f"stress_test_report_{int(time.time())}.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print("📊 STRESS TEST & DIAGNOSTIC SUMMARY")
    print("=" * 60)
    print(f"Total Elapsed Time: {total_elapsed:.2f}s")
    print(f"Total Chunks Sent:  {chunks_sent} ({chunks_sent * 1600 / 1024:.1f} KB)")
    print(f"STT Packets Recv:   {stt_received}")
    print(f"Close Code:         {close_code}")
    print(f"RCA Diagnosis:      {rca_diagnosis}")
    print(f"✔ Full JSON Report: {report_file}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_stress_test())
