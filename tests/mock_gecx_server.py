import asyncio
import json
import time
import base64
import websockets
import sys

class MockGECXServer:
    def __init__(self, host="127.0.0.1", port=8765, disconnect_delay_sec=90.0, close_code=1006):
        self.host = host
        self.port = port
        self.disconnect_delay_sec = disconnect_delay_sec
        self.close_code = close_code
        self.server = None
        self.is_running = False

    async def handle_connection(self, websocket):
        start_time = time.time()
        print(f"[Mock GECX] New connection established. Disconnect timer: {self.disconnect_delay_sec}s (Code: {self.close_code})")

        try:
            # 1. Expect initial Handshake message
            init_msg = await websocket.recv()
            config_data = json.loads(init_msg)
            session_path = config_data.get("config", {}).get("session", "unknown")
            print(f"[Mock GECX] Received SessionConfig: {session_path}")

            # Send initial confirmation / dummy greetings
            greeting_msg = {
                "sessionOutput": {
                    "text": "안녕하세요! 무엇을 도와드릴까요? (Mock GECX Server)",
                    "audio": base64.b64encode(b"\x00\x00" * 400).decode("utf-8"),
                    "turnCompleted": False
                }
            }
            await websocket.send(json.dumps(greeting_msg))

            chunk_count = 0
            while True:
                elapsed = time.time() - start_time
                if elapsed >= self.disconnect_delay_sec:
                    print(f"[Mock GECX] Disconnect delay reached ({elapsed:.2f}s). Terminating with Code {self.close_code}!")
                    if self.close_code == 1006:
                        # Abrupt TCP reset simulation
                        websocket.transport.close()
                    else:
                        await websocket.close(code=self.close_code, reason="Simulated GECX Server Timeout")
                    break

                # Process incoming audio chunks
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    payload = json.loads(msg)
                    if "realtimeInput" in payload and "audio" in payload["realtimeInput"]:
                        chunk_count += 1
                        # Every 10 chunks (~0.5s), emit simulated STT recognition
                        if chunk_count % 10 == 0:
                            stt_msg = {
                                "recognitionResult": {
                                    "transcript": f"테스트 음성 발화 수신 중 ({chunk_count}청크)",
                                    "isFinal": False
                                }
                            }
                            await websocket.send(json.dumps(stt_msg))
                        
                        # Every 60 chunks (~3s), emit LLM response
                        if chunk_count % 60 == 0:
                            llm_msg = {
                                "sessionOutput": {
                                    "text": f"네, 말씀하신 내용을 정상 처리하였습니다. (경과: {elapsed:.1f}초)",
                                    "audio": base64.b64encode(b"\x00\x00" * 400).decode("utf-8"),
                                    "turnCompleted": True
                                }
                            }
                            await websocket.send(json.dumps(llm_msg))
                except asyncio.TimeoutError:
                    continue
        except websockets.exceptions.ConnectionClosed:
            print("[Mock GECX] Client disconnected.")
        except Exception as e:
            print(f"[Mock GECX] Error: {e}")

    async def start(self):
        self.server = await websockets.serve(self.handle_connection, self.host, self.port)
        self.is_running = True
        print(f"[Mock GECX] Server running on ws://{self.host}:{self.port}")

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.is_running = False
            print("[Mock GECX] Server stopped.")

if __name__ == "__main__":
    delay = float(sys.argv[1]) if len(sys.argv) > 1 else 90.0
    code = int(sys.argv[2]) if len(sys.argv) > 2 else 1006
    
    mock = MockGECXServer(disconnect_delay_sec=delay, close_code=code)
    loop = asyncio.get_event_loop()
    loop.run_until_complete(mock.start())
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        loop.run_until_complete(mock.stop())
