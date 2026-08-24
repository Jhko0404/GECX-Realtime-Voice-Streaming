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

    // Pro-Audio Dark Stage Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Subtle Hardware Oscilloscope Phosphor Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    // Center baseline
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    // Vertical grid ticks
    for (let x = 0; x < width; x += 30) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    if (!isStreaming || !audioData || audioData.length === 0) {
      // Resting Ambient Glowing Wave
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Dynamic glowing gradient waveform based on speech energy / barge-in
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    if (isBargeIn) {
      gradient.addColorStop(0, '#f59e0b');
      gradient.addColorStop(0.5, '#ef4444');
      gradient.addColorStop(1, '#f97316');
      ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
      ctx.shadowBlur = 14;
    } else if (rmsDb > -45) {
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(0.5, '#10b981');
      gradient.addColorStop(1, '#6366f1');
      ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
      ctx.shadowBlur = 12;
    } else {
      gradient.addColorStop(0, '#475569');
      gradient.addColorStop(0.5, '#38bdf8');
      gradient.addColorStop(1, '#475569');
      ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
      ctx.shadowBlur = 6;
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const sliceWidth = width / audioData.length;
    let x = 0;

    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i] / 32768.0;
      const y = (v * (height * 0.82)) / 2 + height / 2;

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
    <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-soft flex flex-col gap-3">
      {/* Top Header & Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
              isStreaming
                ? rmsDb > -45
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 ring-2 ring-emerald-100'
                  : 'bg-sky-50 text-sky-600 border border-sky-200'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
          >
            {isStreaming ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-mono font-bold text-slate-800">
            {isStreaming ? (
              rmsDb > -45 ? (
                <span className="text-emerald-700 flex items-center gap-1.5 font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  VOICE ACTIVE (SPEAKING)
                </span>
              ) : (
                <span className="text-sky-700 font-semibold">NOISE TRACKING (STANDBY)</span>
              )
            ) : (
              <span className="text-slate-500 font-medium">MICROPHONE READY</span>
            )}
          </span>
        </div>

        {isBargeIn ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-colorful-rose animate-bounce">
            <Zap className="w-3.5 h-3.5 fill-current" /> BARGE-IN INTERRUPT
          </span>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 text-[11px] font-mono">
            <Waves className="w-3 h-3 text-indigo-500" />
            <span>20Hz Oscilloscope</span>
          </div>
        )}
      </div>

      {/* Hardware-styled Canvas Enclosure */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-[#090d16]">
        <canvas
          ref={canvasRef}
          width={600}
          height={100}
          className="w-full h-[90px] block"
        />
      </div>

      {/* Footer Details & Real-time VU Meter */}
      <div className="flex items-center justify-between text-xs font-mono pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Level:</span>
          <span className="font-bold text-slate-900 font-mono">
            {isStreaming ? `${rmsDb.toFixed(1)} dBFS` : '-∞ dBFS'}
          </span>
          {/* Visual Mini VU Meter */}
          {isStreaming && (
            <div className="w-28 h-2 rounded-full bg-slate-100 border border-slate-200/80 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-500 transition-all duration-75 rounded-full"
                style={{ width: `${vuPercent}%` }}
              />
            </div>
          )}
        </div>
        <span className="text-indigo-700 font-bold bg-indigo-50/80 px-2.5 py-0.5 rounded-lg text-[10px] border border-indigo-200/80">
          LINEAR16 · 16kHz
        </span>
      </div>
    </div>
  );
};

