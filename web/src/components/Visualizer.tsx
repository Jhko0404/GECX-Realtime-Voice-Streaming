import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Zap, Waves } from 'lucide-react';

interface VisualizerProps {
  audioData: Int16Array | null;
  isStreaming: boolean;
  isBargeIn: boolean;
  rmsDb: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  audioData,
  isStreaming,
  isBargeIn,
  rmsDb,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clean Google Soft Surface
    ctx.fillStyle = '#f8fafd';
    ctx.fillRect(0, 0, width, height);

    // Google Subtle Gridlines
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Center baseline
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    // Vertical grid ticks
    for (let x = 0; x < width; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    if (!isStreaming || !audioData || audioData.length === 0) {
      // Idle Baseline Wave
      ctx.strokeStyle = '#bdc1c6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Google 4-Color Waveform (Blue -> Red -> Yellow -> Green)
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    if (isBargeIn) {
      gradient.addColorStop(0, '#ea4335');
      gradient.addColorStop(0.5, '#fbbc04');
      gradient.addColorStop(1, '#d93025');
      ctx.shadowColor = 'rgba(234, 67, 53, 0.4)';
      ctx.shadowBlur = 10;
    } else if (rmsDb > -45) {
      // Authentic Google 4-Color Waveform
      gradient.addColorStop(0, '#4285f4'); // Google Blue
      gradient.addColorStop(0.33, '#ea4335'); // Google Red
      gradient.addColorStop(0.66, '#fbbc04'); // Google Yellow
      gradient.addColorStop(1, '#34a853'); // Google Green
      ctx.shadowColor = 'rgba(66, 133, 244, 0.35)';
      ctx.shadowBlur = 8;
    } else {
      gradient.addColorStop(0, '#9aa0a6');
      gradient.addColorStop(0.5, '#4285f4');
      gradient.addColorStop(1, '#9aa0a6');
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const sliceWidth = width / audioData.length;
    let x = 0;

    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i] / 32768.0;
      const y = (v * (height * 0.85)) / 2 + height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [audioData, isStreaming, isBargeIn, rmsDb]);

  // Calculate dB percentage for VU Meter (range -60 dBFS to 0 dBFS)
  const vuPercent = Math.max(0, Math.min(100, ((rmsDb + 60) / 60) * 100));

  return (
    <div className="rounded-2xl bg-white border border-[#dadce0] p-4 shadow-sm font-sans flex flex-col gap-3">
      {/* Top Header & Status Chips */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isStreaming
                ? rmsDb > -45
                  ? 'bg-[#e6f4ea] text-[#1e8e3e]'
                  : 'bg-[#e8f0fe] text-[#1a73e8]'
                : 'bg-[#f1f3f4] text-[#5f6368]'
            }`}
          >
            {isStreaming ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-medium text-[#202124]">
            {isStreaming ? (
              rmsDb > -45 ? (
                <span className="text-[#137333] flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#34a853] animate-ping" />
                  Active Speech Detected
                </span>
              ) : (
                <span className="text-[#1a73e8] font-medium">Ambient Noise Tracking (50ms)</span>
              )
            ) : (
              <span className="text-[#5f6368] font-normal">Microphone Ready</span>
            )}
          </span>
        </div>

        {isBargeIn ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] animate-bounce">
            <Zap className="w-3.5 h-3.5 fill-current text-[#d93025]" /> Barge-In Interrupt
          </span>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f1f3f4] border border-[#dadce0] text-[#5f6368] text-[11px]">
            <Waves className="w-3 h-3 text-[#1a73e8]" />
            <span>20Hz Oscilloscope</span>
          </div>
        )}
      </div>

      {/* Canvas Enclosure */}
      <div className="relative rounded-xl overflow-hidden border border-[#dadce0] bg-[#f8fafd]">
        <canvas
          ref={canvasRef}
          width={600}
          height={96}
          className="w-full h-[88px] block"
        />
      </div>

      {/* Footer Details & Google 4-Color VU Meter */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[#5f6368] text-[11px]">Level:</span>
          <span className="font-mono font-bold text-[#202124]">
            {isStreaming ? `${rmsDb.toFixed(1)} dBFS` : '-∞ dBFS'}
          </span>
          {/* Mini VU Meter */}
          {isStreaming && (
            <div className="w-28 h-2 rounded-full bg-[#e8eaed] overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-[#4285f4] via-[#34a853] to-[#fbbc04] transition-all duration-75 rounded-full"
                style={{ width: `${vuPercent}%` }}
              />
            </div>
          )}
        </div>
        <span className="text-[#1a73e8] font-medium bg-[#e8f0fe] px-2.5 py-0.5 rounded-full text-[11px] border border-[#d2e3fc]">
          LINEAR16 · 16kHz Mono
        </span>
      </div>
    </div>
  );
};


