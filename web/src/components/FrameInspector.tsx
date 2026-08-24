import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Terminal, Filter, ChevronRight, ChevronDown, Layers } from 'lucide-react';
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

  const getTabClass = (tab: 'ALL' | 'AUDIO' | 'STT' | 'SYSTEM') => {
    const isSelected = filter === tab;
    if (tab === 'ALL') {
      return isSelected
        ? 'bg-slate-800 text-white font-bold shadow-xs'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
    }
    if (tab === 'AUDIO') {
      return isSelected
        ? 'bg-emerald-600 text-white font-bold shadow-xs ring-1 ring-emerald-400'
        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60';
    }
    if (tab === 'STT') {
      return isSelected
        ? 'bg-indigo-600 text-white font-bold shadow-xs ring-1 ring-indigo-400'
        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60';
    }
    if (tab === 'SYSTEM') {
      return isSelected
        ? 'bg-amber-600 text-white font-bold shadow-xs ring-1 ring-amber-400'
        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60';
    }
  };

  return (
    <div className="flex-1 flex flex-col rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-soft">
      {/* Header & Colorful Filter Tabs */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-sky-50/40 to-indigo-50/40 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800">
          <div className="w-5 h-5 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <span>LIVE WEBSOCKET FRAME INSPECTOR</span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
          {(['ALL', 'AUDIO', 'STT', 'SYSTEM'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${getTabClass(tab)}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Frame Table */}
      <div className="flex-1 overflow-y-auto font-mono text-xs divide-y divide-slate-100 bg-white">
        {filteredFrames.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
            <Layers className="w-8 h-8 mb-2 text-slate-300 stroke-[1.5]" />
            <p>수신/발신된 WebSocket 프레임이 없습니다.</p>
          </div>
        ) : (
          filteredFrames.slice().reverse().map((frame) => {
            const isTx = frame.direction === 'TX';
            const isExpanded = expandedFrameId === frame.id;

            return (
              <div key={frame.id} className="hover:bg-slate-50 transition-colors">
                <div
                  onClick={() => toggleExpand(frame.id)}
                  className="px-4 py-2.5 flex items-center justify-between cursor-pointer gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Direction Badge */}
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        isTx
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs'
                          : 'bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs'
                      }`}
                    >
                      {isTx ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownLeft className="w-3 h-3 text-sky-600" />}
                      {frame.direction}
                    </span>

                    {/* Timestamp */}
                    <span className="text-slate-400 text-[11px] shrink-0 font-medium">{frame.timestamp}</span>

                    {/* Summary */}
                    <span className="text-slate-700 truncate text-[11px] font-medium">{frame.summary}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {frame.sizeBytes} B
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Raw JSON Drawer */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-slate-900 text-[11px] border-y border-slate-800">
                    <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 overflow-x-auto font-mono leading-relaxed border border-slate-800">
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
