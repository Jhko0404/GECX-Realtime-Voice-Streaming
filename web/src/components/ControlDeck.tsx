import React, { useEffect } from 'react';
import { Mic, MicOff, Square, Play, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ConnectionState, TurnMode } from '../types';

interface ControlDeckProps {
  connectionState: ConnectionState;
  isStreaming: boolean;
  bargeInGuard: boolean;
  turnMode: TurnMode;
  onToggleStreaming: () => void;
  onEndSession: () => void;
  onToggleBargeInGuard: () => void;
  onToggleTurnMode: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  connectionState,
  isStreaming,
  bargeInGuard: _bargeInGuard,
  turnMode,
  onToggleStreaming,
  onEndSession,
  onToggleBargeInGuard: _onToggleBargeInGuard,
  onToggleTurnMode,
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

      {/* Turn Mode Guard (Code 1007 Zero Error Feature) */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#f8fafd] border border-[#dadce0] text-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              turnMode === 'TURN_GATED' ? 'bg-[#e6f4ea] text-[#1e8e3e]' : 'bg-[#e8f0fe] text-[#1a73e8]'
            }`}
          >
            {turnMode === 'TURN_GATED' ? (
              <ShieldCheck className="w-4 h-4 text-[#137333]" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-[#1a73e8]" />
            )}
          </div>
          <div>
            <div className="font-medium text-[#202124] flex items-center gap-1.5">
              <span>
                {turnMode === 'TURN_GATED' ? 'Turn-Gated Safe Mode' : 'Full-Duplex (Smart Barge-In)'}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  turnMode === 'TURN_GATED'
                    ? 'text-[#137333] bg-[#ceead6]'
                    : 'text-[#1a73e8] bg-[#e8f0fe]'
                }`}
              >
                {turnMode === 'TURN_GATED' ? '1007 방어 기본' : 'Barge-In 모드'}
              </span>
            </div>
            <p className="text-[10px] text-[#5f6368]">
              {turnMode === 'TURN_GATED'
                ? '에이전트 발화 완료 + 스피커 재생 종료 후 사용자 턴으로 안전 전환'
                : '에이전트 발화 중 사용자 끼어들기(Barge-in) 허용'}
            </p>
          </div>
        </div>

        {/* Material 3 Switch */}
        <button
          onClick={onToggleTurnMode}
          className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${
            turnMode === 'TURN_GATED' ? 'bg-[#1e8e3e]' : 'bg-[#1a73e8]'
          }`}
          title="대화 모드 전환 (Turn-Gated vs Full-Duplex)"
        >
          <span
            className={`w-4 h-4 rounded-full bg-white block shadow-xs transition-transform absolute top-0.5 ${
              turnMode === 'TURN_GATED' ? 'left-5.5' : 'left-0.5'
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



