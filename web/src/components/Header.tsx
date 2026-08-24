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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE (16kHz PCM)
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            HANDSHAKING
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            DISCONNECTED (RCA)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            IDLE
          </span>
        );
    }
  };

  return (
    <header className="h-14 border-b border-borderLine bg-card/80 backdrop-blur px-6 flex items-center justify-between select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Radio className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              GECX Real-Time Voice Streaming & Telemetry Console
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
              PoC v1.0
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 font-mono">
            BidiRunSession · Audio-to-Audio (A2A) · Agent Gateway Security
          </p>
        </div>
      </div>

      {/* Center Metadata Badges */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-borderLine text-xs font-mono text-zinc-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-zinc-400">Gateway:</span>
          <span>gecx-agent-gateway</span>
        </div>

        {sessionId && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-borderLine text-xs font-mono text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400">Session:</span>
            <span className="text-zinc-200">{sessionId.substring(0, 16)}...</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-borderLine text-xs font-mono text-zinc-300">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400">Duration:</span>
          <span className="text-emerald-400 font-semibold">{formatTime(durationSec)}</span>
        </div>
      </div>

      {/* Right Status Badge & Links */}
      <div className="flex items-center gap-3">
        {getStatusBadge()}
        <a
          href="https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming"
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          title="GitHub Repository"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
