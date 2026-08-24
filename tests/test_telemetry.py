import time
import base64
import unittest
from bff.telemetry import SessionTelemetryTracker, RFC_6455_CLOSE_CODES

class TestTelemetryTracker(unittest.TestCase):
    def test_chunk_recording_and_metrics(self):
        tracker = SessionTelemetryTracker(session_id="sess-telemetry-test")
        
        # Send 5 speech chunks (sine-like audio)
        speech_bytes = b"\x10\x20" * 800
        b64_speech = base64.b64encode(speech_bytes).decode("utf-8")

        for _ in range(5):
            metric = tracker.record_client_chunk(b64_speech)
            self.assertEqual(metric["session_id"], "sess-telemetry-test")
            self.assertGreater(metric["seq"], 0)
            self.assertEqual(metric["silence_sec"], 0.0)

        self.assertEqual(tracker.total_chunks_sent, 5)
        self.assertEqual(tracker.total_bytes_sent, 5 * len(speech_bytes))

    def test_silence_detection(self):
        tracker = SessionTelemetryTracker(session_id="sess-silence-test")
        silence_bytes = b"\x00\x00" * 800
        b64_silence = base64.b64encode(silence_bytes).decode("utf-8")

        time.sleep(0.05)
        metric = tracker.record_client_chunk(b64_silence)
        self.assertLess(metric["rms_db"], -50.0)

    def test_disconnect_report_generation(self):
        tracker = SessionTelemetryTracker(session_id="sess-rca-test")
        tracker.record_client_chunk(base64.b64encode(b"\x12\x34" * 800).decode("utf-8"))
        tracker.record_server_output(payload_size=512)

        report = tracker.create_disconnect_report(
            close_code=1006,
            reason="Abrupt connection drop"
        )

        self.assertEqual(report.session_id, "sess-rca-test")
        self.assertEqual(report.event_type, "SOCKET_DISCONNECTED")
        self.assertEqual(report.socket_close_info.raw_close_code, 1006)
        self.assertIn("CLOSE_ABNORMAL", RFC_6455_CLOSE_CODES[1006])
        self.assertEqual(report.payload_metrics.total_audio_chunks_sent, 1)
        self.assertEqual(report.payload_metrics.total_chunks_received, 1)

if __name__ == "__main__":
    unittest.main()
