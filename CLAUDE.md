# GECX Real-Time Voice Streaming & Telemetry Console - Developer Guide

## 1. Project Overview & Rules
* **Project Name**: GECX Real-Time Voice Streaming & Telemetry Console
* **Repository**: [https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming](https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming)
* **Design Standard**: `Leonxlnx/taste-skill` Anti-Slop Frontend Standard (Linear Dark Tech / DevTool Minimalist)
* **Core Goal**: Technical validation and empirical Root Cause Analysis (RCA) of GECX `BidiRunSession` 80~120s disconnection issues with microsecond telemetry logging and customer-ready demonstration console.

---

## 2. Command Cheatsheet

### Environment & Virtualenv
```bash
# Setup environment, check gcloud auth, and enable APIs
./scripts/setup_env.sh

# Run unit and integration tests
.venv/bin/python -m unittest discover tests -v
```

### Local Execution & Customer Demo
```bash
# Run local mock demo with 90-second timeout simulation
./scripts/run_local.sh --mock 90

# Run live GECX connected streaming console
./scripts/run_local.sh
```

### Google Cloud Deployment
```bash
# 1. Deploy Private Cloud Run BFF
./scripts/deploy_cloudrun.sh

# 2. Deploy Google Cloud API Gateway Ingress
./scripts/deploy_gateway.sh

# 3. 10-Minute Stress Test & Automated RCA Runner
python3 scripts/stress_test_10m.py http://localhost:8080 600

# 4. Safe Resource Teardown
./scripts/cleanup.sh
```

---

## 3. Audio & DSP Parameters
* **Format**: LINEAR16 PCM (16-bit Mono, Little-Endian)
* **Target Sample Rate**: 16,000 Hz (Downsampled via Web Audio AudioWorklet)
* **Chunk Sizing**: 50ms = 800 samples = 1,600 bytes
* **Cadence**: 20 chunks/sec (20 Hz)
* **Silence Threshold**: $\text{dB}_{\text{FS}} < -50\text{dB}$

---

## 4. Key GCP Environment Metadata
* **Project ID**: `gemeni-workshop`
* **Region / Location**: `us-central1` / `us`
* **App ID**: `83281339-6a20-482e-8064-4cf96c678d76`
* **Cloud Run Service**: `gecx-streaming-bff`
* **API Gateway ID**: `gecx-agent-gateway`
