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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 select-none font-sans">
      {/* Card 1: Chunks Sent & Data Rate (Google Blue) */}
      <div className="rounded-2xl bg-white border border-[#dadce0] p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider">Audio Chunks (TX)</span>
          <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-mono font-bold text-[#202124]">
            {metric ? metric.seq.toLocaleString() : 0}
          </span>
          <span className="text-xs font-mono font-medium text-[#1a73e8]">
            ({formatBytes(metric ? metric.bytes_sent : 0)})
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#5f6368] mt-2 pt-2 border-t border-[#f1f3f4]">
          <span>Interval</span>
          <strong className="text-[#1a73e8] font-medium font-mono">50ms (20 chunks/s)</strong>
        </div>
      </div>

      {/* Card 2: Packet Cadence Interval (Google Green) */}
      <div className="rounded-2xl bg-white border border-[#dadce0] p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider">Cadence Interval</span>
          <div className="w-8 h-8 rounded-full bg-[#e6f4ea] text-[#1e8e3e] flex items-center justify-center">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-mono font-bold text-[#202124]">
            {metric ? `${metric.chunk_interval_ms.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono font-bold text-[#1e8e3e]">ms</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#5f6368] mt-2 pt-2 border-t border-[#f1f3f4]">
          <span>Packet Jitter</span>
          <strong className="text-[#1e8e3e] font-medium font-mono">
            {metric && metric.chunk_interval_ms > 0 ? `±${Math.abs(metric.chunk_interval_ms - 50).toFixed(1)}ms` : '0.0ms'}
          </strong>
        </div>
      </div>

      {/* Card 3: Audio RMS dBFS (Google Yellow/Amber) */}
      <div className="rounded-2xl bg-white border border-[#dadce0] p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider">Audio RMS Level</span>
          <div className="w-8 h-8 rounded-full bg-[#fef7e0] text-[#e37400] flex items-center justify-center">
            <Volume2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-2xl lg:text-3xl font-mono font-bold ${
              metric && metric.rms_db > -45 ? 'text-[#1e8e3e]' : 'text-[#202124]'
            }`}
          >
            {metric ? `${metric.rms_db.toFixed(1)}` : '-∞'}
          </span>
          <span className="text-xs font-mono font-bold text-[#e37400]">dBFS</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#5f6368] mt-2 pt-2 border-t border-[#f1f3f4]">
          <span>VAD Sensor</span>
          <strong className={metric && metric.rms_db > -45 ? 'text-[#137333] font-medium' : 'text-[#5f6368] font-normal'}>
            {metric && metric.rms_db > -45 ? '● Active Speech' : '○ Ambient Noise'}
          </strong>
        </div>
      </div>

      {/* Card 4: Silence Duration & Total Frames (Google Red) */}
      <div className="rounded-2xl bg-white border border-[#dadce0] p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider">Silence Duration</span>
          <div className="w-8 h-8 rounded-full bg-[#fce8e6] text-[#d93025] flex items-center justify-center">
            <Moon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-mono font-bold text-[#d93025]">
            {metric ? `${metric.silence_sec.toFixed(1)}` : '0.0'}
          </span>
          <span className="text-xs font-mono font-bold text-[#d93025]">sec</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#5f6368] mt-2 pt-2 border-t border-[#f1f3f4]">
          <span>Total Stream Frames</span>
          <strong className="text-[#3c4043] font-medium font-mono">{totalFrames.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
};


