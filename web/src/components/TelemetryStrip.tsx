import React from 'react';
import { Radio, Gauge, Volume2, Moon } from 'lucide-react';
import { TelemetryMetric } from '../types';

interface TelemetryStripProps {
  metric: TelemetryMetric | null;
  totalFrames: number;
}

export const TelemetryStrip: React.FC<TelemetryStripProps> = ({
  metric,
  totalFrames,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 select-none">
      {/* Card 1: Chunks Sent & Data Rate */}
      <div className="rounded-lg bg-zinc-950 border border-borderLine p-3">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[11px] font-mono uppercase">Audio Chunks (TX)</span>
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-mono font-bold text-zinc-100">
            {metric ? metric.seq : 0}
          </span>
          <span className="text-xs font-mono text-zinc-400">
            ({formatBytes(metric ? metric.bytes_sent : 0)})
          </span>
        </div>
        <p className="text-[10px] font-mono text-zinc-400 mt-1">
          Target: 20 chunks/sec (50ms)
        </p>
      </div>

      {/* Card 2: Packet Cadence Interval */}
      <div className="rounded-lg bg-zinc-950 border border-borderLine p-3">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[11px] font-mono uppercase">Cadence Interval</span>
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-mono font-bold text-zinc-100">
            {metric ? `${metric.chunk_interval_ms.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono text-zinc-400">ms</span>
        </div>
        <p className="text-[10px] font-mono text-zinc-400 mt-1">
          Jitter: {metric && metric.chunk_interval_ms > 0 ? `±${Math.abs(metric.chunk_interval_ms - 50).toFixed(1)}ms` : '0ms'}
        </p>
      </div>

      {/* Card 3: Audio RMS dBFS */}
      <div className="rounded-lg bg-zinc-950 border border-borderLine p-3">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[11px] font-mono uppercase">Audio RMS Level</span>
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-mono font-bold ${metric && metric.rms_db > -45 ? 'text-emerald-400' : 'text-zinc-100'}`}>
            {metric ? `${metric.rms_db.toFixed(1)}` : '-∞'}
          </span>
          <span className="text-xs font-mono text-zinc-400">dBFS</span>
        </div>
        <p className="text-[10px] font-mono text-zinc-400 mt-1">
          {metric && metric.rms_db > -45 ? 'Voice Active' : 'Silence / Noise Floor'}
        </p>
      </div>

      {/* Card 4: Silence Duration & Total Frames */}
      <div className="rounded-lg bg-zinc-950 border border-borderLine p-3">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[11px] font-mono uppercase">Silence Timer</span>
          <Moon className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-mono font-bold text-amber-400">
            {metric ? `${metric.silence_sec.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono text-zinc-400">sec</span>
        </div>
        <p className="text-[10px] font-mono text-zinc-400 mt-1">
          Total WS Frames: {totalFrames}
        </p>
      </div>
    </div>
  );
};
