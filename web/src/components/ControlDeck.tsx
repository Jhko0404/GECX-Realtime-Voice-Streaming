import React, { useEffect } from 'react';
import { Mic, MicOff, Square, Play, ShieldAlert } from 'lucide-react';
import { ConnectionState } from '../types';

interface ControlDeckProps {
  connectionState: ConnectionState;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onEndSession: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  connectionState,
  isStreaming,
  onToggleStreaming,
  onEndSession,
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
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 flex flex-col gap-3.5 select-none shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-800">
            STREAMING CONTROL DECK
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
            [SPACEBAR] TOGGLE
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-600">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isStreaming
                ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-200'
                : 'bg-slate-300'
            }`}
          />
          <span>Always-On Mode: <strong className={isStreaming ? 'text-emerald-700' : 'text-slate-500'}>{isStreaming ? 'ENABLED' : 'PAUSED'}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Main Mic Toggle Button (Colorful Vibrant Primary CTA) */}
        <button
          onClick={onToggleStreaming}
          className={`flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-mono text-sm font-bold transition-all active:scale-[0.98] ${
            isStreaming
              ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-colorful-rose hover:brightness-105'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 text-white shadow-colorful-emerald hover:brightness-105'
          }`}
        >
          {isStreaming ? (
            <>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <MicOff className="w-3.5 h-3.5 text-white" />
              </div>
              <span>STOP STREAMING</span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                {isConnected ? <Mic className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white" />}
              </div>
              <span>{isConnected ? 'START MIC STREAMING' : 'CONNECT & START SESSION'}</span>
            </>
          )}
        </button>

        {/* End Session Button */}
        <button
          onClick={onEndSession}
          disabled={connectionState === 'IDLE'}
          className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-mono text-sm font-bold bg-slate-100 text-slate-700 border border-slate-200/90 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs"
        >
          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <Square className="w-3 h-3 fill-current" />
          </div>
          <span>END SESSION</span>
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
          Security: Ephemeral Signed Ticket (TTL 60s)
        </span>
        <span className="text-slate-600 font-medium">Chunk Interval: <strong className="text-indigo-600">50ms (20Hz)</strong></span>
      </div>
    </div>
  );
};
