import math
import struct
import base64
import unittest
from bff.telemetry import calculate_audio_rms_and_db

class TestAudioDSP(unittest.TestCase):
    def test_silence_audio_rms_and_db(self):
        # 800 samples of 16-bit 0 (silence, 50ms at 16kHz = 1600 bytes)
        raw_silence = b"\x00\x00" * 800
        self.assertEqual(len(raw_silence), 1600)

        b64_silence = base64.b64encode(raw_silence).decode("utf-8")
        rms, db = calculate_audio_rms_and_db(b64_silence)

        self.assertAlmostEqual(rms, 0.0, places=2)
        self.assertLess(db, -90.0)

    def test_sine_wave_audio_rms_and_db(self):
        # Generate 800 samples of a 440Hz sine wave at full scale amplitude (32767)
        num_samples = 800
        sample_rate = 16000
        freq = 440.0
        amplitude = 16000.0  # -6 dB approximately

        raw_bytes = bytearray()
        for i in range(num_samples):
            val = int(amplitude * math.sin(2 * math.pi * freq * i / sample_rate))
            raw_bytes.extend(struct.pack("<h", val))

        self.assertEqual(len(raw_bytes), 1600)
        b64_audio = base64.b64encode(raw_bytes).decode("utf-8")
        rms, db = calculate_audio_rms_and_db(b64_audio)

        # Expected RMS for sine wave is amplitude / sqrt(2)
        expected_rms = amplitude / math.sqrt(2)
        self.assertAlmostEqual(rms, expected_rms, delta=200)
        self.assertGreater(db, -10.0)
        self.assertLess(db, -3.0)

    def test_invalid_payload_fallback(self):
        rms, db = calculate_audio_rms_and_db("invalid-base64-???")
        self.assertEqual(rms, 0.0)
        self.assertEqual(db, -100.0)

if __name__ == "__main__":
    unittest.main()
