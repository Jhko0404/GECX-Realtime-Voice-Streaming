export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onChunkCallback: ((base64Audio: string, rawInt16: Int16Array) => void) | null = null;
  public isRecording: boolean = false;

  async start(onChunk: (base64Audio: string, rawInt16: Int16Array) => void): Promise<void> {
    this.onChunkCallback = onChunk;

    // 1. Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // 2. Initialize AudioContext
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // 3. Load AudioWorklet module
    // We create a Blob URL to load the worklet safely in Vite / Bundled environments
    const workletCode = `
      class PCM16WorkletProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.targetSampleRate = 16000;
          this.bufferSize = 800;
          this.outputBuffer = new Int16Array(this.bufferSize);
          this.outputIndex = 0;
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (!input || input.length === 0) return true;
          const channelData = input[0];
          if (!channelData || channelData.length === 0) return true;

          const ratio = sampleRate / this.targetSampleRate;

          for (let i = 0; i < channelData.length; i += ratio) {
            const idx = Math.floor(i);
            const frac = i - idx;
            const s0 = channelData[idx] || 0;
            const s1 = channelData[idx + 1] || s0;
            const interpolated = s0 + frac * (s1 - s0);

            const clamped = Math.max(-1.0, Math.min(1.0, interpolated));
            const int16Val = clamped < 0 ? clamped * 32768 : clamped * 32767;

            this.outputBuffer[this.outputIndex++] = Math.round(int16Val);

            if (this.outputIndex >= this.bufferSize) {
              const bufferCopy = this.outputBuffer.buffer.slice(0);
              this.port.postMessage(bufferCopy, [bufferCopy]);
              this.outputIndex = 0;
            }
          }
          return true;
        }
      }
      registerProcessor('pcm16-worklet-processor', PCM16WorkletProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    // 4. Connect nodes
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm16-worklet-processor');

    this.workletNode.port.onmessage = (event) => {
      const arrayBuffer = event.data as ArrayBuffer;
      const int16Array = new Int16Array(arrayBuffer);

      // Convert ArrayBuffer to Base64
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);

      if (this.onChunkCallback) {
        this.onChunkCallback(base64Audio, int16Array);
      }
    };

    this.sourceNode.connect(this.workletNode);
    this.isRecording = true;
  }

  stop(): void {
    this.isRecording = false;
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
