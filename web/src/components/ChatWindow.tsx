import React, { useRef, useEffect } from 'react';
import { Bot, User, Sparkles, CheckCircle2, MessageSquare } from 'lucide-react';
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
    <div className="flex-1 flex flex-col rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-soft">
      {/* Dialogue Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-sky-50/40 border-b border-slate-200 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span>REAL-TIME MULTIMODAL DIALOGUE</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
          Audio-to-Audio (A2A) · {isStreaming ? 'LISTENING' : 'IDLE'}
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
        {messages.length === 0 && !currentTranscript && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-3 shadow-2xs">
              <MessageSquare className="w-6 h-6 stroke-[1.75]" />
            </div>
            <p className="text-sm font-bold text-slate-800">음성 대화 세션 대기 중</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              하단의 <span className="text-emerald-600 font-bold font-mono">[START STREAMING]</span> 버튼을 누르거나
              <span className="text-indigo-600 font-bold font-mono"> Spacebar</span>를 눌러 상담을 시작하세요.
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Bot className="w-4 h-4 drop-shadow-xs" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                  isUser
                    ? 'bg-gradient-to-br from-indigo-500 to-sky-600 text-white rounded-tr-xs shadow-colorful-indigo'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-soft'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase ${
                      isUser ? 'text-indigo-100' : 'text-emerald-700'
                    }`}
                  >
                    {isUser ? 'User (Voice Ingest)' : 'GECX Agent (A2A Voice)'}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      isUser ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
                <p className={`leading-relaxed whitespace-pre-wrap ${isUser ? 'text-white' : 'text-slate-800'}`}>
                  {msg.text}
                </p>
                {msg.latencyMs && (
                  <div
                    className={`mt-2 flex items-center gap-1 text-[10px] font-mono font-semibold ${
                      isUser ? 'text-indigo-200' : 'text-emerald-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Response Latency: {msg.latencyMs.toFixed(1)}ms</span>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <User className="w-4 h-4 drop-shadow-xs" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming User Speech Ingest */}
        {currentTranscript && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[82%] rounded-2xl px-4 py-3 text-sm bg-gradient-to-br from-indigo-50 to-sky-50 text-indigo-900 border-2 border-indigo-400 rounded-tr-xs shadow-soft animate-pulse">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[10px] font-mono font-extrabold text-indigo-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  REAL-TIME STT (RECOGNIZING)
                </span>
              </div>
              <p className="leading-relaxed font-medium">{currentTranscript}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-indigo-300">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
