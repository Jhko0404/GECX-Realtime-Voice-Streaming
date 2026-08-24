import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Terminal, Filter, ChevronRight, ChevronDown } from 'lucide-react';
import { WebSocketFrame } from '../types';

interface FrameInspectorProps {
  frames: WebSocketFrame[];
}

export const FrameInspector: React.FC<FrameInspectorProps> = ({ frames }) => {
  const [filter, setFilter] = useState<'ALL' | 'AUDIO' | 'STT' | 'SYSTEM'>('ALL');
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);

  const filteredFrames = frames.filter((f) => {
    if (filter === 'AUDIO') return f.type === 'AUDIO_CHUNK';
    if (filter === 'STT') return f.type === 'STT_TRANSCRIPT' || f.type === 'AGENT_OUTPUT';
    if (filter === 'SYSTEM') return f.type === 'SYSTEM' || f.type === 'INTERRUPT';
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedFrameId(expandedFrameId === id ? null : id);
  };

  return (
    <div className="flex-1 flex flex-col rounded-lg bg-zinc-950 border border-borderLine overflow-hidden">
      {/* Header & Filter Tabs */}
      <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-borderLine flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>LIVE WEBSOCKET FRAME INSPECTOR</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-zinc-400 mr-1" />
          {(['ALL', 'AUDIO', 'STT', 'SYSTEM'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                filter === tab
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Frame Table */}
      <div className="flex-1 overflow-y-auto font-mono text-xs divide-y divide-zinc-900">
        {filteredFrames.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-xs py-8">
            수신/발신된 WebSocket 프레임이 없습니다.
          </div>
        ) : (
          filteredFrames.slice().reverse().map((frame) => {
            const isTx = frame.direction === 'TX';
            const isExpanded = expandedFrameId === frame.id;

            return (
              <div key={frame.id} className="hover:bg-zinc-900/40 transition">
                <div
                  onClick={() => toggleExpand(frame.id)}
                  className="px-4 py-2 flex items-center justify-between cursor-pointer gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Direction Badge */}
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isTx
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {isTx ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                      {frame.direction}
                    </span>

                    {/* Timestamp */}
                    <span className="text-zinc-400 text-[11px] shrink-0">{frame.timestamp}</span>

                    {/* Summary */}
                    <span className="text-zinc-300 truncate text-[11px]">{frame.summary}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-zinc-400">{frame.sizeBytes} B</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Raw JSON Drawer */}
                {isExpanded && (
                  <div className="px-4 py-2.5 bg-zinc-950/80 border-t border-zinc-900 text-[11px]">
                    <pre className="p-2 rounded bg-zinc-900 text-zinc-300 overflow-x-auto">
                      {JSON.stringify(frame.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
