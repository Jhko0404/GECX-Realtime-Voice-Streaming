#!/usr/bin/env python3
"""
10-Scenario Audio Dataset Automated Streaming Benchmark Runner
Streams 10 5-minute 16kHz LINEAR16 WAV audio files in 50ms chunks (20Hz)
to test live/mock GECX streaming stability, 80~120s timeout detection, and STT performance.
"""
import os
import sys
import time
import wave
import json
import base64
import asyncio
import httpx
import websockets
from datetime import datetime

DATASET_DIR = "tests/audio_dataset"
DEFAULT_HOST = "https://gecx-agent-gateway-47lgs0mq.uc.gateway.dev"

async def run_scenario_stream(wav_path: str, target_host: str, scenario_meta: dict, speed_factor: float = 1.0) -> dict:
    """Streams a single 5-minute WAV file in 50ms chunks to the GECX streaming endpoint."""
    scenario_id = os.path.basename(wav_path).replace(".wav", "")
    print("\n" + "=" * 65)
    print(f"▶️  [시나리오 시작] {scenario_id} ({scenario_meta.get('title', 'Test')})")
    print(f"👉 Target Host: {target_host}")
    print(f"👉 File Path:   {wav_path}")
    print("=" * 65)

    # 1. Start Control Plane Session
    print("[1/3] Requesting session start & ephemeral ticket...")
    async with httpx.AsyncClient() as client:
        start_url = f"{target_host}/api/v1/session/start"
        try:
            res = await client.post(start_url, json={"client_id": f"bench-{scenario_id}"}, timeout=15.0)
            if res.status_code != 200:
                print(f"❌ Session start failed: {res.status_code} - {res.text}")
                return {"scenario_id": scenario_id, "status": "SESSION_START_FAILED", "error": res.text}
            data = res.json()
        except Exception as e:
            print(f"❌ HTTP error: {e}")
            return {"scenario_id": scenario_id, "status": "CONNECTION_FAILED", "error": str(e)}

    session_id = data["session_id"]
    ticket = data["session_ticket"]
    ws_endpoint = data.get("ws_endpoint", "/ws/stream")

    # Resolve WebSocket URL (Cloud Run direct or Gateway)
    # If gateway host is uc.gateway.dev, we connect to Cloud Run host directly or via host header
    if ws_endpoint.startswith("ws://") or ws_endpoint.startswith("wss://"):
        delim = "&" if "?" in ws_endpoint else "?"
        ws_url = f"{ws_endpoint}{delim}ticket={ticket}"
    elif "gateway.dev" in target_host:
        ws_url = f"wss://{cloud_run_host}{ws_endpoint}?ticket={ticket}"
    else:
        clean_host = target_host.replace("https://", "").replace("http://", "")
        ws_url = f"{ws_protocol}://{clean_host}{ws_endpoint}?ticket={ticket}"

    print(f"✔ Session Created: {session_id}")
    print(f"✔ Target WSS URL:  {ws_url}")

    # 2. Read WAV Audio frames
    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        total_audio_sec = n_frames / framerate
        raw_pcm_data = wf.readframes(n_frames)

    # 50ms chunk = 800 samples * 2 bytes = 1600 bytes
    chunk_size = 1600
    total_chunks = len(raw_pcm_data) // chunk_size
    print(f"[2/3] Loaded {total_audio_sec:.1f}s Audio ({total_chunks} Chunks, {len(raw_pcm_data) / 1024 / 1024:.2f} MB)")

    # 3. Stream Chunks over WebSocket
    print("[3/3] Streaming 50ms chunks over WebSocket...")
    start_time = time.time()
    chunks_sent = 0
    stt_count = 0
    agent_outputs = 0
    close_code = 1000
    close_reason = "Normal Completion"
    disconnect_elapsed = 0.0

    try:
        async with websockets.connect(ws_url, ping_interval=10, ping_timeout=5) as ws:
            # Receive session ready
            try:
                first_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"✔ Handshake ACK: {first_msg[:80]}...")
            except asyncio.TimeoutError:
                print("⚠️  Handshake timeout, proceeding...")

            async def send_audio():
                nonlocal chunks_sent
                for i in range(total_chunks):
                    chunk_bytes = raw_pcm_data[i * chunk_size : (i + 1) * chunk_size]
                    chunk_b64 = base64.b64encode(chunk_bytes).decode("utf-8")
                    payload = {"realtimeInput": {"audio": chunk_b64}}
                    await ws.send(json.dumps(payload))
                    chunks_sent += 1

                    if chunks_sent % 100 == 0:  # Every 5 seconds
                        cur_elapsed = time.time() - start_time
                        audio_pos = chunks_sent * 0.05
                        print(f"  ⏱️  [Chunk {chunks_sent:5d}/{total_chunks}] Elapsed: {cur_elapsed:5.1f}s | Audio Pos: {audio_pos:5.1f}s")

                    # Exact 50ms pacing adjusted by speed_factor
                    await asyncio.sleep(0.050 / speed_factor)

            async def receive_stream():
                nonlocal stt_count, agent_outputs
                async for raw in ws:
                    msg = json.loads(raw)
                    if "recognitionResult" in msg:
                        stt_count += 1
                    if "sessionOutput" in msg:
                        agent_outputs += 1

            await asyncio.gather(send_audio(), receive_stream())

    except websockets.exceptions.ConnectionClosed as e:
        close_code = e.code
        close_reason = e.reason or "Closed by remote peer"
        disconnect_elapsed = time.time() - start_time
        print(f"\n⚠️  [세션 단절 감지] 단절 시점: {disconnect_elapsed:.2f}초 | RFC 6455 Close Code: {close_code} | Reason: {close_reason}")
    except Exception as e:
        print(f"\n❌ Streaming exception: {e}")
        close_reason = str(e)

    total_elapsed = time.time() - start_time
    if disconnect_elapsed == 0.0:
        disconnect_elapsed = total_elapsed

    # RCA Diagnosis
    rca_result = "NORMAL_COMPLETED_300S"
    if close_code == 1006 or close_code != 1000:
        if 75.0 <= disconnect_elapsed <= 125.0:
            rca_result = "CONFIRMED_GECX_80_120S_TIMEOUT (Abnormal Server Drop 1006)"
        else:
            rca_result = f"DISCONNECTED_AT_{int(disconnect_elapsed)}S (Code: {close_code})"

    result = {
        "scenario_id": scenario_id,
        "title": scenario_meta.get("title", ""),
        "total_audio_duration_sec": total_audio_sec,
        "actual_streamed_sec": round(disconnect_elapsed, 2),
        "total_chunks_sent": chunks_sent,
        "total_bytes_sent": chunks_sent * chunk_size,
        "stt_packets_received": stt_count,
        "agent_outputs_received": agent_outputs,
        "close_code": close_code,
        "close_reason": close_reason,
        "rca_diagnosis": rca_result
    }

    print(f"📊 [결과] {scenario_id}: Chunks {chunks_sent}/{total_chunks}, Time {disconnect_elapsed:.1f}s, Code {close_code} ({rca_result})")
    return result

async def main():
    target_host = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_HOST
    scenario_arg = sys.argv[2] if len(sys.argv) > 2 else "all"  # "all" or specific index 1-10
    speed_arg = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0

    print("=" * 70)
    print("🚀 GECX 10-Scenario Audio Dataset Automated Benchmark Suite")
    print(f"👉 Target Host:    {target_host}")
    print(f"👉 Mode:           {scenario_arg}")
    print(f"👉 Speed Factor:   {speed_arg}x")
    print("=" * 70)

    # Load Scenarios
    from generate_audio_dataset import SCENARIOS
    scenarios_to_run = SCENARIOS if scenario_arg == "all" else [s for s in SCENARIOS if scenario_arg in s["id"]]

    all_results = []
    for sc in scenarios_to_run:
        wav_file = os.path.join(DATASET_DIR, f"{sc['id']}.wav")
        if not os.path.exists(wav_file):
            print(f"❌ File not found: {wav_file}. Run scripts/generate_audio_dataset.py first.")
            continue

        res = await run_scenario_stream(wav_file, target_host, sc, speed_factor=speed_arg)
        all_results.append(res)

    # Save summary report
    report_path = f"benchmark_results_{int(time.time())}.json"
    summary_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "target_host": target_host,
        "total_scenarios_tested": len(all_results),
        "results": all_results
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 70)
    print("🏁 BENCHMARK RUN COMPLETED")
    print("=" * 70)
    print(f"✔ Full Benchmark JSON Report: {report_path}")
    for r in all_results:
        print(f"• {r.get('scenario_id')}: {r.get('actual_streamed_sec')}s | Chunks: {r.get('total_chunks_sent')} | Code: {r.get('close_code')} | {r.get('rca_diagnosis')}")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
