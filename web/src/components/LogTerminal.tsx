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
        return <span className="text-[#81c995] font-semibold px-1.5 py-0.5 rounded bg-[#137333]/30 border border-[#1e8e3e]/40">SUCCESS</span>;
      case 'ERROR':
        return <span className="text-[#f28b82] font-semibold px-1.5 py-0.5 rounded bg-[#c5221f]/30 border border-[#ea4335]/40">ERROR</span>;
      case 'WARN':
        return <span className="text-[#fdd663] font-semibold px-1.5 py-0.5 rounded bg-[#b06000]/30 border border-[#fbbc04]/40">WARN</span>;
      case 'AUDIO':
        return <span className="text-[#d7aefb] font-semibold px-1.5 py-0.5 rounded bg-[#8430ce]/30 border border-[#a142f4]/40">AUDIO</span>;
      default:
        return <span className="text-[#8ab4f8] font-semibold px-1.5 py-0.5 rounded bg-[#174ea6]/30 border border-[#4285f4]/40">INFO</span>;
    }
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'AUTH':
        return 'text-[#8ab4f8]';
      case 'WS':
        return 'text-[#78d9ec]';
      case 'GECX':
        return 'text-[#81c995]';
      case 'STT':
        return 'text-[#a8dab5]';
      case 'AGENT':
        return 'text-[#8ab4f8]';
      case 'BARGE-IN':
        return 'text-[#fdd663]';
      case 'RCA':
      case 'ERROR':
        return 'text-[#f28b82]';
      default:
        return 'text-[#9aa0a6]';
    }
  };

  return (
    <div className="rounded-2xl bg-[#202124] border border-[#3c4043] text-[#e8eaed] shadow-sm flex flex-col overflow-hidden font-mono text-xs">
      {/* Cloud Shell Title Bar */}
      <div className="px-3.5 py-2.5 bg-[#292a2d] border-b border-[#3c4043] flex items-center justify-between select-none font-sans">
        <div className="flex items-center gap-2">
          {/* Cloud Shell Prompt Icon */}
          <div className="w-5 h-5 rounded bg-[#3c4043] flex items-center justify-center text-[#8ab4f8]">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-[#e8eaed] font-medium text-xs">
            <span>Cloud Shell Logs Explorer</span>
          </div>
          <span className="text-[10px] text-[#9aa0a6] font-normal ml-1">
            ({logs.length} events)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyLogs}
            className="px-2.5 py-1 rounded-full bg-[#3c4043] hover:bg-[#5f6368] text-[#e8eaed] hover:text-white transition flex items-center gap-1 text-[10px] cursor-pointer"
            title="전체 로그 텍스트 복사"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#81c995] stroke-[2.5]" />
                <span className="text-[#81c995] font-medium">복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[#bdc1c6]" />
                <span>복사</span>
              </>
            )}
          </button>
          <button
            onClick={onClearLogs}
            className="p-1 rounded-full bg-[#3c4043] hover:bg-[#5f6368] text-[#bdc1c6] hover:text-[#f28b82] transition cursor-pointer"
            title="로그 비우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Log Stream Area */}
      <div className="p-3 overflow-y-auto max-h-[175px] min-h-[135px] space-y-1.5 bg-[#202124] custom-scrollbar text-[11px] leading-relaxed select-text font-mono">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#80868b] italic py-6">
            로그가 비어 있습니다. 대화를 시작하면 실시간 이벤트가 출력됩니다.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-1.5 hover:bg-[#292a2d] px-1 py-0.5 rounded transition">
              <span className="text-[#80868b] shrink-0 text-[10px]">{log.timestamp}</span>
              <span className="shrink-0 text-[9px]">{getLevelBadge(log.level)}</span>
              <span className={`font-semibold shrink-0 ${getTagColor(log.tag)}`}>[{log.tag}]</span>
              <span
                className={`break-all ${
                  log.level === 'ERROR'
                    ? 'text-[#f28b82] font-medium'
                    : log.level === 'WARN'
                    ? 'text-[#fdd663]'
                    : log.level === 'SUCCESS'
                    ? 'text-[#e8eaed]'
                    : 'text-[#bdc1c6]'
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


