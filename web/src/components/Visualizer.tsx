import React, { useRef, useEffect } from 'react';
import { Mic, Zap } from 'lucide-react';

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

    ctx.clearRect(0, 0, width, height);

    // Center baseline
    ctx.strokeStyle = '#27272a'; // zinc-800
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!isStreaming || !audioData || audioData.length === 0) {
      // Resting subtle wave
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Set dynamic color based on Barge-In or Voice Activity
    if (isBargeIn) {
      ctx.strokeStyle = '#f59e0b'; // Amber-500 for Barge-In
      ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
      ctx.shadowBlur = 8;
    } else if (rmsDb > -45) {
      ctx.strokeStyle = '#10b981'; // Emerald-500 for Active Speech
      ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
      ctx.shadowBlur = 6;
    } else {
      ctx.strokeStyle = '#71717a'; // Zinc-500 for Ambient Background
      ctx.shadowBlur = 0;
    }

    ctx.lineWidth = 2;
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

  return (
    <div className="relative rounded-lg bg-zinc-950 border border-borderLine overflow-hidden p-4">
      {/* Top Overlay Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${isStreaming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
            <Mic className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-mono text-zinc-300">
            {isStreaming ? (rmsDb > -45 ? 'ACTIVE SPEECH DETECTED' : 'ALWAYS-ON STREAMING (BACKGROUND NOISE TRACKING)') : 'MICROPHONE MUTED'}
          </span>
        </div>

        {isBargeIn && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            <Zap className="w-3 h-3" /> BARGE-IN INTERRUPTED
          </span>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={100}
        className="w-full h-24 rounded bg-zinc-900/50 block"
      />

      {/* Footer Details */}
      <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>Encoding: LINEAR16 · 16,000Hz Mono</span>
        <span>Signal Level: {isStreaming ? `${rmsDb.toFixed(1)} dBFS` : '-∞ dBFS'}</span>
      </div>
    </div>
  );
};
