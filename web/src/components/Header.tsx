import React from 'react';
import { Activity, ShieldCheck, Radio, Clock, Github } from 'lucide-react';
import { ConnectionState } from '../types';

interface HeaderProps {
  connectionState: ConnectionState;
  sessionId: string;
  durationSec: number;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  sessionId,
  durationSec,
}) => {
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const ms = Math.floor((totalSec % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  const getStatusBadge = () => {
    switch (connectionState) {
      case 'LIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm ring-2 ring-emerald-100/80 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            LIVE (16kHz PCM)
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm ring-2 ring-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            HANDSHAKING
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm ring-2 ring-rose-100">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            DISCONNECTED (RCA)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            IDLE
          </span>
        );
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between select-none shadow-xs sticky top-0 z-30">
      {/* Brand & Title */}
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-[1px] shadow-sm flex items-center justify-center">
          <div className="w-full h-full bg-white/20 backdrop-blur-xs rounded-[11px] flex items-center justify-center text-white">
            <Radio className="w-4 h-4 text-white drop-shadow-xs" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              <span>GECX Real-Time Voice Streaming</span>
              <span className="text-indigo-600 font-extrabold">&</span>
              <span>Telemetry Console</span>
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
              PoC v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-700 font-mono font-medium flex items-center gap-1.5 mt-0.5">
            <span className="text-emerald-700 font-semibold">● BidiRunSession</span>
            <span className="text-slate-500">|</span>
            <span className="text-sky-700 font-semibold">Audio-to-Audio (A2A)</span>
            <span className="text-slate-500">|</span>
            <span className="text-indigo-700 font-semibold">Agent Gateway Security</span>
          </p>
        </div>
      </div>

      {/* Center Metadata Badges (Colorful & Bright) */}
      <div className="hidden md:flex items-center gap-3">
        {/* Gateway Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50/70 border border-indigo-200/70 text-xs font-mono text-indigo-900 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-indigo-700 font-medium">Gateway:</span>
          <span className="font-bold text-indigo-700">gecx-agent-gateway</span>
        </div>

        {/* Session Chip */}
        {sessionId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50/70 border border-purple-200/70 text-xs font-mono text-purple-900 shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-purple-700 font-medium">Session:</span>
            <span className="font-bold text-purple-700">{sessionId.substring(0, 16)}...</span>
          </div>
        )}

        {/* Duration Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-xs font-mono text-emerald-900 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-medium">Duration:</span>
          <span className="text-emerald-700 font-extrabold">{formatTime(durationSec)}</span>
        </div>
      </div>

      {/* Right Status Badge & Links */}
      <div className="flex items-center gap-3">
        {getStatusBadge()}
        <a
          href="https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs"
          title="GitHub Repository"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
