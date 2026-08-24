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
    <div className="rounded-lg bg-zinc-950 border border-borderLine p-4 flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium text-zinc-300">
            STREAMING CONTROL DECK
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
            [SPACEBAR] TOGGLE
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span>Always-On Mode: {isStreaming ? 'ENABLED' : 'PAUSED'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Main Mic Toggle Button */}
        <button
          onClick={onToggleStreaming}
          className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg font-mono text-sm font-semibold transition shadow-lg ${
            isStreaming
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-[0.98]'
              : 'bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 active:scale-[0.98]'
          }`}
        >
          {isStreaming ? (
            <>
              <MicOff className="w-4 h-4" />
              <span>STOP STREAMING</span>
            </>
          ) : (
            <>
              {isConnected ? <Mic className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isConnected ? 'START MIC STREAMING' : 'CONNECT & START SESSION'}</span>
            </>
          )}
        </button>

        {/* End Session Button */}
        <button
          onClick={onEndSession}
          disabled={connectionState === 'IDLE'}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-mono text-sm font-medium bg-zinc-900 text-zinc-300 border border-borderLine hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition"
        >
          <Square className="w-4 h-4 text-rose-400" />
          <span>END SESSION</span>
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-900">
        <span className="flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-emerald-400" />
          Security: Ephemeral Signed Ticket (TTL 60s)
        </span>
        <span>Chunk Interval: 50ms (20Hz)</span>
      </div>
    </div>
  );
};
