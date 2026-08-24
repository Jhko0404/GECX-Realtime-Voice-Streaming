import React, { useRef, useEffect } from 'react';
import { Bot, User, Sparkles, CheckCircle2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentTranscript: string;
  isStreaming: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  currentTranscript,
  isStreaming,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript]);

  return (
    <div className="flex-1 flex flex-col rounded-lg bg-zinc-950 border border-borderLine overflow-hidden">
      {/* Dialogue Header */}
      <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-borderLine flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>REAL-TIME MULTIMODAL DIALOGUE</span>
        </div>
        <span className="text-[11px] text-zinc-400">
          Audio-to-Audio (A2A) · {isStreaming ? 'LISTENING' : 'IDLE'}
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && !currentTranscript && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
            <Bot className="w-8 h-8 mb-2 text-zinc-600 stroke-[1.5]" />
            <p className="text-sm font-medium text-zinc-300">세션이 대기 중입니다</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm">
              하단의 <span className="text-emerald-400 font-mono">[START STREAMING]</span> 버튼을 누르거나
              <span className="text-zinc-300 font-mono"> Spacebar</span>를 눌러 음성 대화를 시작하세요.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  isUser
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-tr-sm'
                    : 'bg-zinc-900 text-zinc-100 border border-borderLine rounded-tl-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[10px] font-mono font-medium uppercase text-zinc-400">
                    {isUser ? 'User (Voice Ingest)' : 'GECX Agent (A2A Voice)'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">{msg.timestamp}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                {msg.latencyMs && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Response Latency: {msg.latencyMs.toFixed(1)}ms</span>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming User Speech Ingest */}
        {currentTranscript && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm bg-zinc-800/80 text-zinc-200 border border-emerald-500/40 rounded-tr-sm animate-pulse">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[10px] font-mono font-medium text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REAL-TIME STT (RECOGNIZING)
                </span>
              </div>
              <p className="leading-relaxed">{currentTranscript}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
