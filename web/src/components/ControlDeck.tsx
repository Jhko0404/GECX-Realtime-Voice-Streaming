import React, { useEffect } from 'react';
import { Mic, MicOff, Square, Play, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ConnectionState } from '../types';

interface ControlDeckProps {
  connectionState: ConnectionState;
  isStreaming: boolean;
  bargeInGuard: boolean;
  onToggleStreaming: () => void;
  onEndSession: () => void;
  onToggleBargeInGuard: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  connectionState,
  isStreaming,
  bargeInGuard,
  onToggleStreaming,
  onEndSession,
  onToggleBargeInGuard,
}) => {
  // Spacebar Hotkey Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onToggleStreaming();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleStreaming]);

  const isConnected = connectionState === 'LIVE';

  return (
    <div className="rounded-2xl bg-white border border-[#dadce0] p-4 flex flex-col gap-3 select-none shadow-sm font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#202124] tracking-wider uppercase">
            Streaming Controls
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]">
            ␣ Spacebar
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-[#5f6368]">
          <span
            className={`w-2 h-2 rounded-full ${
              isStreaming
                ? 'bg-[#1e8e3e] animate-ping'
                : 'bg-[#9aa0a6]'
            }`}
          />
          <span className="text-[11px]">Always-On: <strong className={isStreaming ? 'text-[#137333] font-bold' : 'text-[#5f6368] font-normal'}>{isStreaming ? 'ACTIVE' : 'STANDBY'}</strong></span>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Main Mic Toggle Button (Google Material 3 Filled Button) */}
        <button
          onClick={onToggleStreaming}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full font-medium text-xs tracking-wide transition-all shadow-sm hover:shadow active:scale-[0.98] cursor-pointer ${
            isStreaming
              ? 'bg-[#d93025] hover:bg-[#c5221f] text-white'
              : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
          }`}
        >
          {isStreaming ? (
            <>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <MicOff className="w-3.5 h-3.5 text-white" />
              </div>
              <span>STOP STREAMING</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                {isConnected ? <Mic className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white fill-current" />}
              </div>
              <span>{isConnected ? 'START MIC STREAMING' : 'CONNECT & START'}</span>
            </>
          )}
        </button>

        {/* End Session Button (Google Material 3 Outlined Button) */}
        <button
          onClick={onEndSession}
          disabled={connectionState === 'IDLE'}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-full font-medium text-xs text-[#3c4043] bg-white hover:bg-[#fce8e6] hover:text-[#d93025] hover:border-[#fad2cf] border border-[#dadce0] active:scale-[0.98] disabled:opacity-35 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer"
        >
          <Square className="w-3.5 h-3.5 text-[#ea4335]" />
          <span>END SESSION</span>
        </button>
      </div>

      {/* Smart Barge-In Guard (1007 Defense Feature) */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f8fafd] border border-[#dadce0] text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${bargeInGuard ? 'bg-[#e6f4ea] text-[#1e8e3e]' : 'bg-[#f1f3f4] text-[#5f6368]'}`}>
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-medium text-[#202124] flex items-center gap-1.5">
              <span>Smart Barge-In Guard (Code 1007 방어)</span>
              <span className="text-[10px] text-[#1a73e8] bg-[#e8f0fe] px-1.5 py-0.2 rounded font-mono font-semibold">추천</span>
            </div>
            <p className="text-[10px] text-[#5f6368]">에이전트 발화 중 스피커 소리 재유입 및 턴 충돌 자동 방어</p>
          </div>
        </div>

        {/* Material 3 Switch */}
        <button
          onClick={onToggleBargeInGuard}
          className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${
            bargeInGuard ? 'bg-[#1a73e8]' : 'bg-[#bdc1c6]'
          }`}
          title="Smart Barge-In Guard 토글"
        >
          <span
            className={`w-4 h-4 rounded-full bg-white block shadow-xs transition-transform absolute top-0.5 ${
              bargeInGuard ? 'left-5.5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#5f6368] pt-1 border-t border-[#f1f3f4]">
        <span className="flex items-center gap-1.5 text-[#1a73e8] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1a73e8]" />
          Signed Ephemeral Ticket (TTL 60s)
        </span>
        <span>Cadence: <strong className="text-[#137333] font-medium font-mono">50ms (20Hz)</strong></span>
      </div>
    </div>
  );
};



