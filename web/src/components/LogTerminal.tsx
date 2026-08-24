import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Trash2, Copy, Check } from 'lucide-react';
import { LogEntry } from '../types';

interface LogTerminalProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ logs, onClearLogs }) => {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopyLogs = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (logs.length === 0) return;
    const textToCopy = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.tag}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'SUCCESS':
        return <span className="text-emerald-400 font-bold">SUCCESS</span>;
      case 'ERROR':
        return <span className="text-rose-400 font-bold">ERROR</span>;
      case 'WARN':
        return <span className="text-amber-400 font-bold">WARN</span>;
      case 'AUDIO':
        return <span className="text-purple-400 font-bold">AUDIO</span>;
      default:
        return <span className="text-cyan-400 font-bold">INFO</span>;
    }
  };

  return (
    <div className="rounded-2xl bg-[#0b0f19] border border-slate-800 text-slate-200 shadow-soft flex flex-col overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {/* macOS Style Traffic Dots */}
          <div className="flex items-center gap-1.5 mr-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>DIAGNOSTIC LOG CONSOLE</span>
          </div>
          <span className="text-[10px] text-slate-500 font-normal ml-1">
            ({logs.length} events)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyLogs}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] cursor-pointer"
            title="전체 로그 텍스트 복사"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                <span className="text-emerald-400 font-bold">복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>복사</span>
              </>
            )}
          </button>
          <button
            onClick={onClearLogs}
            className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
            title="로그 비우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Log Stream Area */}
      <div className="p-3 overflow-y-auto max-h-[190px] min-h-[140px] space-y-1.5 bg-[#0b0f19] custom-scrollbar text-[11px] leading-relaxed select-text">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic py-6">
            로그가 비어 있습니다. 대화를 시작하면 실시간 이벤트가 출력됩니다.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-1.5 font-mono hover:bg-slate-900/60 px-1 py-0.5 rounded transition">
              <span className="text-slate-500 shrink-0 text-[10px]">{log.timestamp}</span>
              <span className="text-slate-600">[</span>
              <span className="shrink-0 text-[10px]">{getLevelBadge(log.level)}</span>
              <span className="text-slate-600">]</span>
              <span className="text-indigo-300 font-semibold shrink-0">[{log.tag}]</span>
              <span
                className={`break-all ${
                  log.level === 'ERROR'
                    ? 'text-rose-300 font-semibold'
                    : log.level === 'WARN'
                    ? 'text-amber-200'
                    : log.level === 'SUCCESS'
                    ? 'text-emerald-200 font-medium'
                    : 'text-slate-300'
                }`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
