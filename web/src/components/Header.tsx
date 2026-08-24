import React, { useState } from 'react';
import { Activity, ShieldCheck, Radio, Clock, Github, Copy, Check } from 'lucide-react';
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
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopySessionId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs ring-2 ring-emerald-100/90">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE (16kHz PCM)
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs ring-2 ring-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            HANDSHAKING
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs ring-2 ring-rose-100">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            DISCONNECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-100/90 text-slate-600 border border-slate-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            IDLE STANDBY
          </span>
        );
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl px-6 flex items-center justify-between select-none shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] sticky top-0 z-30">
      {/* Brand & Title */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-[1.5px] shadow-sm flex items-center justify-center">
          <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-white">
            <Radio className="w-4 h-4 text-emerald-400 drop-shadow-xs" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
              <span>GECX Real-Time Voice Streaming</span>
              <span className="text-indigo-600 font-extrabold">&</span>
              <span className="text-slate-800">Telemetry Console</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-700 border border-indigo-200/70 shadow-2xs">
              PoC v1.0
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono font-medium mt-0.5">
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              BidiRunSession
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-sky-600 font-semibold">Audio-to-Audio (A2A)</span>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-600 font-semibold">Google API Gateway</span>
          </div>
        </div>
      </div>

      {/* Center Metadata Badges */}
      <div className="hidden md:flex items-center gap-2.5">
        {/* Gateway Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-slate-500 font-medium">Gateway:</span>
          <span className="font-bold text-slate-800">gecx-agent-gateway</span>
        </div>

        {/* Session Chip with 1-Click Copy */}
        {sessionId ? (
          <button
            onClick={handleCopySessionId}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all duration-200 shadow-2xs group relative cursor-pointer ${
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-100'
                : 'bg-indigo-50/70 hover:bg-indigo-100/90 border-indigo-200/80 text-indigo-900 hover:border-indigo-300'
            }`}
            title={`클릭하여 전체 세션 ID 복사 (${sessionId})`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-indigo-600 font-medium">Session:</span>
            <span className="font-bold text-indigo-950">
              {sessionId.length > 20 ? `${sessionId.substring(0, 16)}...` : sessionId}
            </span>
            <div className="ml-1 pl-1.5 border-l border-indigo-200 flex items-center">
              {copied ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                  <span>복사됨!</span>
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-700 transition" />
              )}
            </div>
          </button>
        ) : null}

        {/* Duration Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-slate-500 font-medium">Duration:</span>
          <span className="text-slate-900 font-extrabold">{formatTime(durationSec)}</span>
        </div>
      </div>

      {/* Right Status Badge & GitHub Link */}
      <div className="flex items-center gap-2.5">
        {getStatusBadge()}
        <a
          href="https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition shadow-2xs border border-slate-200/60"
          title="GitHub Repository"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
