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
      {/* Card 1: Chunks Sent & Data Rate (Vibrant Indigo) */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50/30 to-indigo-50/70 border border-indigo-200/80 p-3.5 shadow-soft flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono font-bold text-indigo-700 uppercase">Audio Chunks (TX)</span>
          <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-mono font-extrabold text-slate-900">
            {metric ? metric.seq : 0}
          </span>
          <span className="text-xs font-mono font-semibold text-indigo-600">
            ({formatBytes(metric ? metric.bytes_sent : 0)})
          </span>
        </div>
        <p className="text-[10px] font-mono text-slate-500 mt-1">
          Target: <strong className="text-indigo-600">20 chunks/s (50ms)</strong>
        </p>
      </div>

      {/* Card 2: Packet Cadence Interval (Vibrant Sky/Cyan) */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-sky-50/30 to-sky-50/70 border border-sky-200/80 p-3.5 shadow-soft flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono font-bold text-sky-700 uppercase">Cadence Interval</span>
          <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
            <Gauge className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-extrabold text-slate-900">
            {metric ? `${metric.chunk_interval_ms.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono font-semibold text-sky-600">ms</span>
        </div>
        <p className="text-[10px] font-mono text-slate-500 mt-1">
          Jitter: <strong className="text-sky-600">{metric && metric.chunk_interval_ms > 0 ? `±${Math.abs(metric.chunk_interval_ms - 50).toFixed(1)}ms` : '0ms'}</strong>
        </p>
      </div>

      {/* Card 3: Audio RMS dBFS (Vibrant Emerald) */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-emerald-50/30 to-emerald-50/70 border border-emerald-200/80 p-3.5 shadow-soft flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono font-bold text-emerald-700 uppercase">Audio RMS Level</span>
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-mono font-extrabold ${
              metric && metric.rms_db > -45 ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {metric ? `${metric.rms_db.toFixed(1)}` : '-∞'}
          </span>
          <span className="text-xs font-mono font-semibold text-emerald-600">dBFS</span>
        </div>
        <p className="text-[10px] font-mono text-slate-500 mt-1">
          State: <strong className={metric && metric.rms_db > -45 ? 'text-emerald-700' : 'text-slate-500'}>{metric && metric.rms_db > -45 ? 'Active Speech' : 'Silence Floor'}</strong>
        </p>
      </div>

      {/* Card 4: Silence Duration & Total Frames (Vibrant Amber/Rose) */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-amber-50/30 to-amber-50/70 border border-amber-200/80 p-3.5 shadow-soft flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono font-bold text-amber-700 uppercase">Silence Timer</span>
          <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Moon className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-extrabold text-amber-600">
            {metric ? `${metric.silence_sec.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono font-semibold text-amber-700">sec</span>
        </div>
        <p className="text-[10px] font-mono text-slate-500 mt-1">
          Total WS Frames: <strong className="text-amber-700">{totalFrames}</strong>
        </p>
      </div>
    </div>
  );
};
