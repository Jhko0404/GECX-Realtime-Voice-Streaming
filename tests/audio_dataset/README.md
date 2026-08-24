# 🎧 10-Scenario Synthetic 5-Minute Audio Dataset

This directory contains synthesized 16kHz Mono LINEAR16 PCM audio datasets for testing continuous streaming and timeout behaviors.

## 🚀 How to Generate Datasets
Run the generator script to create all 10 5-minute WAV files (300 seconds / 9.16 MB each):
```bash
python3 scripts/generate_audio_dataset.py
```

## 📊 Dataset Specifications
* **Format**: 16,000 Hz, 16-bit Mono LINEAR16 PCM
* **Duration**: 300.0 seconds (5.0 Minutes) per scenario
* **Chunking**: 6,000 chunks of 50ms (1,600 bytes at 20 Hz)
* **Scenarios**:
  1. `scenario_01_weather_travel.wav` - 서울/제주도 날씨 및 여행 일정 문의
  2. `scenario_02_appliance_billing.wav` - 가전 렌탈 정기 요금제 및 할인 문의
  3. `scenario_03_purifier_as_booking.wav` - 정수기 필터 교체 및 AS 예약
  4. `scenario_04_ecommerce_return.wav` - 쇼핑몰 배송 지연 및 반품 접수
  5. `scenario_05_flight_reservation.wav` - 국제선 항공권 일정 변경 및 좌석 지정
  6. `scenario_06_card_loss_limit.wav` - 신용카드 해외 한도 상향 및 분실 신고
  7. `scenario_07_telecom_addon.wav` - 5G 요금제 변경 및 부가서비스 해지
  8. `scenario_08_hotel_checkin.wav` - 호텔 얼리 체크인 및 조식 뷔페 문의
  9. `scenario_09_it_helpdesk_vpn.wav` - 사내 VPN 장애 및 패스워드 재설정
  10. `scenario_10_hospital_appointment.wav` - 종합병원 검진 예약 및 주차 안내
