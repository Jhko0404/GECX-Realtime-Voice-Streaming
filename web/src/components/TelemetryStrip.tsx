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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
      {/* Card 1: Chunks Sent & Data Rate (Vibrant Indigo) */}
      <div className="relative rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-soft hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-400" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Audio Chunks (TX)</span>
          <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-110 transition">
            <Radio className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-mono font-extrabold text-slate-900 tracking-tight">
            {metric ? metric.seq.toLocaleString() : 0}
          </span>
          <span className="text-xs font-mono font-semibold text-indigo-600">
            ({formatBytes(metric ? metric.bytes_sent : 0)})
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-100">
          <span>Cadence</span>
          <strong className="text-indigo-600 font-semibold">20 chunks/s (50ms)</strong>
        </div>
      </div>

      {/* Card 2: Packet Cadence Interval (Vibrant Sky/Cyan) */}
      <div className="relative rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-soft hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Cadence Interval</span>
          <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-110 transition">
            <Gauge className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-mono font-extrabold text-slate-900 tracking-tight">
            {metric ? `${metric.chunk_interval_ms.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono font-bold text-sky-600">ms</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-100">
          <span>Packet Jitter</span>
          <strong className="text-sky-600 font-semibold">{metric && metric.chunk_interval_ms > 0 ? `±${Math.abs(metric.chunk_interval_ms - 50).toFixed(1)}ms` : '0.0ms'}</strong>
        </div>
      </div>

      {/* Card 3: Audio RMS dBFS (Vibrant Emerald) */}
      <div className="relative rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-soft hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Audio RMS Level</span>
          <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-2xl lg:text-3xl font-mono font-extrabold tracking-tight ${
              metric && metric.rms_db > -45 ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {metric ? `${metric.rms_db.toFixed(1)}` : '-∞'}
          </span>
          <span className="text-xs font-mono font-bold text-emerald-600">dBFS</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-100">
          <span>VAD Sensor</span>
          <strong className={metric && metric.rms_db > -45 ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'}>
            {metric && metric.rms_db > -45 ? '● Active Speech' : '○ Ambient Floor'}
          </strong>
        </div>
      </div>

      {/* Card 4: Silence Duration & Total Frames (Vibrant Amber/Purple) */}
      <div className="relative rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-soft hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Silence Duration</span>
          <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-110 transition">
            <Moon className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-mono font-extrabold text-amber-600 tracking-tight">
            {metric ? `${metric.silence_sec.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono font-bold text-amber-600">sec</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-100">
          <span>Total Stream Frames</span>
          <strong className="text-slate-700 font-bold">{totalFrames.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
};

