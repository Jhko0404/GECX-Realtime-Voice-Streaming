export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    // Lazy initialized on first play or user gesture
  }

  private initContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Enqueues base64 LINEAR16 PCM 16kHz audio data to playback.
   */
  queueAudio(base64Audio: string) {
    this.initContext();
    if (!this.audioContext) return;

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const numSamples = int16Array.length;
      const audioBuffer = this.audioContext.createBuffer(1, numSamples, 16000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < numSamples; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
      };
    } catch (err) {
      console.error('Error decoding/playing audio chunk:', err);
    }
  }

  /**
   * Barge-In Flush: Immediately stops all active audio playback and clears buffer queue.
   */
  flush() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
    }
    this.activeSources = [];
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  /**
   * Checks if the agent audio is actively playing or queued in buffer.
   */
  isPlaying(): boolean {
    if (!this.audioContext) return false;
    return this.activeSources.length > 0 && this.nextStartTime > this.audioContext.currentTime;
  }

  close() {
    this.flush();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

