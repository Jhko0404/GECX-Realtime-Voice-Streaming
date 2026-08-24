import React, { useState } from 'react';
import { Activity, ShieldCheck, Clock, Github, Copy, Check } from 'lucide-react';
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#e6f4ea] text-[#137333] border border-[#ceead6] shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34a853] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1e8e3e]" />
            </span>
            LIVE (16kHz PCM)
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#fef7e0] text-[#b06000] border border-[#feefc3] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#fbbc04] animate-ping" />
            Connecting
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#ea4335]" />
            Disconnected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#9aa0a6]" />
            Idle Standby
          </span>
        );
    }
  };

  return (
    <header className="h-16 border-b border-[#dadce0] bg-white px-6 flex items-center justify-between select-none shadow-[0_1px_2px_0_rgba(60,64,67,0.08)] sticky top-0 z-30 font-sans">
      {/* Brand & Title (Google Cloud Style) */}
      <div className="flex items-center gap-3.5">
        {/* Google 4-Color Icon */}
        <div className="w-9 h-9 rounded-xl bg-white border border-[#dadce0] shadow-2xs flex items-center justify-center p-1.5">
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider">Google Cloud</span>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-bold text-[#202124] flex items-center gap-1.5">
              <span>GECX Voice Streaming Console</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]">
              Dialogflow CX A2A
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#5f6368] font-normal mt-0.5">
            <span className="text-[#137333] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e8e3e] inline-block" />
              BidiRunSession
            </span>
            <span className="text-[#dadce0]">•</span>
            <span className="text-[#1a73e8] font-medium">LINEAR16 16kHz Audio</span>
            <span className="text-[#dadce0]">•</span>
            <span>API Gateway Ingress</span>
          </div>
        </div>
      </div>

      {/* Center Metadata Badges (Material 3 Style Pills) */}
      <div className="hidden md:flex items-center gap-2.5">
        {/* Gateway Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3f4] border border-[#dadce0] text-xs text-[#3c4043]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1a73e8]" />
          <span className="text-[#5f6368]">Gateway:</span>
          <span className="font-medium text-[#202124]">gecx-agent-gateway</span>
        </div>

        {/* Session Chip with 1-Click Copy */}
        {sessionId ? (
          <button
            onClick={handleCopySessionId}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-all duration-150 cursor-pointer ${
              copied
                ? 'bg-[#e6f4ea] border-[#ceead6] text-[#137333]'
                : 'bg-[#e8f0fe] hover:bg-[#d2e3fc] border-[#d2e3fc] text-[#1a73e8]'
            }`}
            title={`클릭하여 전체 세션 ID 복사 (${sessionId})`}
          >
            <Activity className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
            <span className="font-medium text-[#5f6368]">Session:</span>
            <span className="font-mono font-medium text-[#174ea6]">
              {sessionId.length > 18 ? `${sessionId.substring(0, 14)}...` : sessionId}
            </span>
            <div className="ml-1 pl-1 border-l border-[#d2e3fc] flex items-center">
              {copied ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#137333]">
                  <Check className="w-3 h-3 text-[#1e8e3e] stroke-[2.5]" />
                  <span>복사됨</span>
                </span>
              ) : (
                <Copy className="w-3 h-3 text-[#1a73e8]" />
              )}
            </div>
          </button>
        ) : null}

        {/* Duration Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3f4] border border-[#dadce0] text-xs text-[#3c4043]">
          <Clock className="w-3.5 h-3.5 text-[#1e8e3e]" />
          <span className="text-[#5f6368]">Duration:</span>
          <span className="font-mono font-bold text-[#202124]">{formatTime(durationSec)}</span>
        </div>
      </div>

      {/* Right Status Badge & GitHub Link */}
      <div className="flex items-center gap-2.5">
        {getStatusBadge()}
        <a
          href="https://github.com/Jhko0404/GECX-Real-Time-Voice-Streaming"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-full bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#5f6368] hover:text-[#202124] transition border border-[#dadce0]"
          title="GitHub Repository"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
