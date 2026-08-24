import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Zap, Activity } from 'lucide-react';

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

    // Clear with crisp soft canvas background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Draw subtle studio grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    // Horizontal center line
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    // Vertical grid ticks
    for (let x = 0; x < width; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    if (!isStreaming || !audioData || audioData.length === 0) {
      // Resting subtle pulse wave
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Dynamic colorful gradient based on speech energy / barge-in
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    if (isBargeIn) {
      gradient.addColorStop(0, '#f59e0b'); // Amber
      gradient.addColorStop(0.5, '#ea580c'); // Orange
      gradient.addColorStop(1, '#dc2626'); // Red
      ctx.shadowColor = 'rgba(234, 88, 12, 0.4)';
      ctx.shadowBlur = 10;
    } else if (rmsDb > -45) {
      gradient.addColorStop(0, '#06b6d4'); // Cyan
      gradient.addColorStop(0.5, '#10b981'); // Emerald
      gradient.addColorStop(1, '#6366f1'); // Indigo
      ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
      ctx.shadowBlur = 8;
    } else {
      gradient.addColorStop(0, '#64748b'); // Slate
      gradient.addColorStop(0.5, '#3b82f6'); // Sky Blue
      gradient.addColorStop(1, '#64748b');
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
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
    ctx.shadowBlur = 0; // Reset shadow
  }, [audioData, isStreaming, isBargeIn, rmsDb]);

  // Calculate dB percentage for VU Meter (range -60 dBFS to 0 dBFS)
  const vuPercent = Math.max(0, Math.min(100, ((rmsDb + 60) / 60) * 100));

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-soft flex flex-col gap-3">
      {/* Top Overlay Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg transition-colors ${
              isStreaming
                ? rmsDb > -45
                  ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                  : 'bg-sky-100 text-sky-700'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {isStreaming ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </div>
          <span className="text-xs font-mono font-bold text-slate-800">
            {isStreaming ? (
              rmsDb > -45 ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  ACTIVE SPEECH DETECTED
                </span>
              ) : (
                <span className="text-sky-700">ALWAYS-ON (NOISE TRACKING)</span>
              )
            ) : (
              <span className="text-slate-500">MICROPHONE STANDBY</span>
            )}
          </span>
        </div>

        {isBargeIn ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm animate-bounce">
            <Zap className="w-3.5 h-3.5 fill-current" /> BARGE-IN INTERRUPT
          </span>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-mono">
            <Activity className="w-3 h-3 text-indigo-500" />
            <span>20Hz Oscilloscope</span>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner">
        <canvas
          ref={canvasRef}
          width={600}
          height={110}
          className="w-full h-24 block"
        />
      </div>

      {/* Footer Details & Real-time VU Meter */}
      <div className="flex items-center justify-between text-xs font-mono pt-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Signal:</span>
          <span className="font-bold text-slate-800">
            {isStreaming ? `${rmsDb.toFixed(1)} dBFS` : '-∞ dBFS'}
          </span>
          {/* Visual Mini VU Meter */}
          {isStreaming && (
            <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-500 transition-all duration-75 rounded-full"
                style={{ width: `${vuPercent}%` }}
              />
            </div>
          )}
        </div>
        <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
          LINEAR16 · 16,000Hz Mono
        </span>
      </div>
    </div>
  );
};
