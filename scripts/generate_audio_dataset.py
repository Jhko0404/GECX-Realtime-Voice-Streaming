#!/usr/bin/env python3
"""
10-Scenario Synthetic 5-Minute Audio Dataset Generator
Generates 10 distinct 5-minute (300-second) 16kHz LINEAR16 PCM WAV files
for continuous GECX streaming stress testing and RCA validation.
"""
import os
import math
import struct
import wave
import numpy as np

OUTPUT_DIR = "tests/audio_dataset"
SAMPLE_RATE = 16000  # 16 kHz
DURATION_SEC = 300   # 5 Minutes (300 seconds)
TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC

SCENARIOS = [
    {
        "id": "scenario_01_weather_travel",
        "title": "서울/제주도 날씨 및 3박 4일 여행 일정 문의",
        "base_freq": 220.0,
        "cadence_pattern": [(0, 8), (12, 20), (24, 35), (42, 50), (60, 75), (85, 95), (105, 120), (130, 150), (165, 185), (200, 225), (240, 265), (280, 298)]
    },
    {
        "id": "scenario_02_appliance_billing",
        "title": "가전 렌탈 정기 요금제 변경 및 할인 문의",
        "base_freq": 195.0,
        "cadence_pattern": [(2, 10), (15, 28), (35, 48), (55, 68), (75, 90), (100, 115), (125, 142), (155, 175), (190, 210), (225, 245), (260, 280), (288, 298)]
    },
    {
        "id": "scenario_03_purifier_as_booking",
        "title": "정수기 필터 교체 점검 및 AS 기사 방문 예약",
        "base_freq": 240.0,
        "cadence_pattern": [(0, 7), (11, 24), (30, 45), (52, 65), (72, 88), (96, 110), (120, 138), (148, 168), (180, 202), (215, 238), (250, 272), (282, 299)]
    },
    {
        "id": "scenario_04_ecommerce_return",
        "title": "쇼핑몰 의류 배송 지연 확인 및 반품 접수",
        "base_freq": 210.0,
        "cadence_pattern": [(3, 12), (18, 30), (38, 50), (58, 72), (80, 94), (104, 118), (128, 145), (155, 172), (185, 205), (220, 240), (255, 275), (285, 297)]
    },
    {
        "id": "scenario_05_flight_reservation",
        "title": "국제선 항공권 일정 변경 및 좌석 지정",
        "base_freq": 180.0,
        "cadence_pattern": [(0, 9), (14, 26), (32, 47), (54, 70), (78, 92), (102, 122), (132, 150), (160, 180), (192, 215), (228, 250), (262, 282), (290, 299)]
    },
    {
        "id": "scenario_06_card_loss_limit",
        "title": "신용카드 해외 한도 상향 및 분실 도난 신고",
        "base_freq": 250.0,
        "cadence_pattern": [(1, 10), (16, 30), (36, 52), (60, 76), (84, 98), (108, 125), (136, 154), (166, 186), (198, 220), (232, 252), (265, 285), (291, 298)]
    },
    {
        "id": "scenario_07_telecom_addon",
        "title": "5G 데이터 요금제 변경 및 부가서비스 해지",
        "base_freq": 200.0,
        "cadence_pattern": [(2, 11), (17, 29), (37, 51), (59, 74), (82, 97), (106, 124), (134, 152), (162, 182), (194, 218), (230, 250), (264, 284), (289, 299)]
    },
    {
        "id": "scenario_08_hotel_checkin",
        "title": "호텔 얼리 체크인 및 조식 뷔페 예약 문의",
        "base_freq": 230.0,
        "cadence_pattern": [(0, 8), (13, 27), (34, 48), (56, 70), (77, 93), (101, 119), (129, 148), (158, 178), (189, 212), (224, 246), (258, 278), (286, 298)]
    },
    {
        "id": "scenario_09_it_helpdesk_vpn",
        "title": "사내 VPN 접속 장애 및 패스워드 재설정 요청",
        "base_freq": 185.0,
        "cadence_pattern": [(2, 12), (18, 32), (40, 55), (63, 78), (86, 102), (112, 128), (138, 156), (168, 188), (199, 222), (234, 254), (268, 287), (292, 299)]
    },
    {
        "id": "scenario_10_hospital_appointment",
        "title": "종합병원 건강검진 예약 및 진료과 주차 안내",
        "base_freq": 215.0,
        "cadence_pattern": [(0, 10), (15, 28), (35, 49), (57, 72), (81, 96), (105, 122), (131, 151), (161, 181), (193, 216), (227, 248), (261, 281), (288, 298)]
    }
]

def generate_formant_speech_signal(duration_sec: float, base_f0: float, sample_rate: int = 16000) -> np.ndarray:
    """Generates natural human-like voice formant synthesis with fundamental frequency and harmonics."""
    num_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, num_samples, endpoint=False)

    # Formant frequencies for vocal tract resonance (F1, F2, F3)
    f1 = base_f0 * 2.5
    f2 = base_f0 * 6.0
    f3 = base_f0 * 11.0

    # Syllabic amplitude modulation (3~5 syllables per second)
    syllable_mod = 0.5 + 0.5 * np.sin(2 * np.pi * 4.0 * t)
    intonation = 1.0 + 0.05 * np.sin(2 * np.pi * 1.5 * t)

    # Harmonics synthesis
    signal = (
        0.50 * np.sin(2 * np.pi * base_f0 * intonation * t) +
        0.25 * np.sin(2 * np.pi * f1 * t) +
        0.15 * np.sin(2 * np.pi * f2 * t) +
        0.10 * np.sin(2 * np.pi * f3 * t)
    )

    # Apply speech envelope and scale to peak amplitude ~14000
    speech_wave = signal * syllable_mod * 14000.0
    return speech_wave

def generate_scenario_audio(scenario: dict) -> str:
    """Creates a 5-minute (300s) continuous 16kHz WAV file with natural speech & ambient presence."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"{scenario['id']}.wav")

    print(f"🎙️  [Generating] {scenario['id']}.wav ({scenario['title']})...")

    # Initialize full 300-second buffer with subtle ambient room presence (-48 dBFS ~ 120 amplitude)
    np.random.seed(hash(scenario['id']) % 2**32)
    ambient_noise = np.random.normal(0, 100, TOTAL_SAMPLES)
    audio_buffer = ambient_noise.copy()

    # Overlay speech segments based on the scenario cadence pattern
    for (start_s, end_s) in scenario["cadence_pattern"]:
        seg_dur = min(end_s, DURATION_SEC) - start_s
        if seg_dur <= 0:
            continue

        start_idx = int(start_s * SAMPLE_RATE)
        end_idx = start_idx + int(seg_dur * SAMPLE_RATE)

        # Generate voice segment
        voice_seg = generate_formant_speech_signal(seg_dur, scenario["base_freq"], SAMPLE_RATE)
        audio_buffer[start_idx:end_idx] += voice_seg[:end_idx - start_idx]

    # Clip to 16-bit signed integer range (-32768 to 32767)
    audio_int16 = np.clip(audio_buffer, -32767, 32767).astype(np.int16)

    # Write WAV file
    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(1)        # Mono
        wf.setsampwidth(2)        # 16-bit (2 bytes per sample)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_int16.tobytes())

    file_size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"✔ [Saved] {out_path} ({file_size_mb:.2f} MB, {DURATION_SEC}s, 16kHz LINEAR16)")
    return out_path

def main():
    print("=" * 65)
    print("🎧 GECX 10-Scenario 5-Minute Audio Dataset Generator")
    print(f"👉 Target Duration: {DURATION_SEC}s (5.0 Minutes) per scenario")
    print(f"👉 Audio Format:    16,000 Hz, 16-bit Mono LINEAR16 PCM")
    print(f"👉 Total Scenarios: {len(SCENARIOS)}")
    print("=" * 65)

    generated_files = []
    for sc in SCENARIOS:
        path = generate_scenario_audio(sc)
        generated_files.append(path)

    print("\n" + "=" * 65)
    print("🎉 10개 시나리오 5분 테스트 음성 데이터셋 생성 완료!")
    print(f"👉 저장 위치: {os.path.abspath(OUTPUT_DIR)}")
    print("=" * 65)

if __name__ == "__main__":
    main()
