/**
 * PCM16 Worklet Processor
 * Runs on Web Audio thread to downsample microphone audio to 16kHz LINEAR16 PCM.
 * Emits 50ms (800 samples = 1,600 bytes) chunks to main thread.
 */
class PCM16WorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.bufferSize = 800; // 50ms at 16000Hz
    this.outputBuffer = new Int16Array(this.bufferSize);
    this.outputIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    
    // Mono input channel
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const inputSampleRate = sampleRate; // Global sample rate of AudioContext (e.g., 44100 or 48000)
    const ratio = inputSampleRate / this.targetSampleRate;

    for (let i = 0; i < channelData.length; i += ratio) {
      const idx = Math.floor(i);
      const frac = i - idx;
      const s0 = channelData[idx] || 0;
      const s1 = channelData[idx + 1] || s0;
      const interpolated = s0 + frac * (s1 - s0);

      // Clamp to [-1.0, 1.0] and scale to 16-bit signed integer
      const clamped = Math.max(-1.0, Math.min(1.0, interpolated));
      const int16Val = clamped < 0 ? clamped * 32768 : clamped * 32767;

      this.outputBuffer[this.outputIndex++] = Math.round(int16Val);

      if (this.outputIndex >= this.bufferSize) {
        // Post 1600 bytes ArrayBuffer to main thread with transferable object
        const bufferCopy = this.outputBuffer.buffer.slice(0);
        this.port.postMessage(bufferCopy, [bufferCopy]);
        this.outputIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm16-worklet-processor', PCM16WorkletProcessor);
