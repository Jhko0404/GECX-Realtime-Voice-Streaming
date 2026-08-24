import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  FileText,
  ImageIcon,
  ArrowDown,
} from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);

  // Auto-scroll on new message or transcript change
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, currentTranscript]);

  // Track scroll position to show/hide "Scroll to Bottom" button
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isNearBottom);
  };

  // Custom Markdown Components for Rich Citations & Images
  const markdownComponents: any = {
    a: ({ href, children, ...props }: any) => {
      const text = String(children);
      const isCitation =
        text.includes('출처') ||
        text.includes('Manual') ||
        text.includes('매뉴얼') ||
        (href && href.includes('storage.googleapis.com'));

      if (isCitation) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 my-2 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold text-xs shadow-2xs hover:shadow-xs transition-all duration-150 group break-all cursor-pointer hover:-translate-y-0.5"
            {...props}
          >
            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="underline decoration-indigo-300 underline-offset-2 group-hover:text-indigo-950 font-bold">
              {children}
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 shrink-0 ml-0.5" />
          </a>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-800 underline decoration-sky-300 underline-offset-2 inline-flex items-center gap-0.5 font-semibold"
          {...props}
        >
          {children}
          <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
        </a>
      );
    },
    img: ({ src, alt }: any) => (
      <div className="my-3 rounded-2xl overflow-hidden border border-slate-200/90 shadow-soft bg-white max-w-lg transition-all hover:shadow-soft-lg">
        <div className="relative group">
          <img
            src={src}
            alt={alt || '대화 첨부 이미지'}
            className="w-full h-auto object-cover max-h-80"
            loading="lazy"
          />
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md flex items-center gap-1.5 text-xs font-mono"
            title="원본 이미지 열기"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>크게 보기</span>
          </a>
        </div>
        {alt && (
          <div className="px-3.5 py-2 text-[11px] text-slate-600 font-mono bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span>{alt}</span>
          </div>
        )}
      </div>
    ),
    p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1.5 my-2 pl-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1.5 my-2 pl-1">{children}</ol>,
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }: any) => <strong className="font-extrabold text-slate-900">{children}</strong>,
  };

  return (
    <div className="flex-1 flex flex-col rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 overflow-hidden shadow-soft relative h-full min-h-[440px]">
      {/* Dialogue Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-sky-50/30 border-b border-slate-200/80 flex items-center justify-between text-xs font-mono shrink-0 select-none">
        <div className="flex items-center gap-2.5 text-slate-800 font-bold">
          <div className="w-6 h-6 rounded-lg bg-indigo-100/80 text-indigo-600 flex items-center justify-center border border-indigo-200/60">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="tracking-wide">REAL-TIME MULTIMODAL DIALOGUE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold text-slate-600 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/60 shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isStreaming ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
              }`}
            />
            {isStreaming ? 'STREAMING ACTIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Messages Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-4 bg-slate-50/30 scroll-smooth custom-scrollbar relative"
      >
        {messages.length === 0 && !currentTranscript && (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100/80 flex items-center justify-center text-indigo-500 mb-3.5 shadow-soft">
              <MessageSquare className="w-7 h-7 stroke-[1.75]" />
            </div>
            <p className="text-sm font-bold text-slate-800">실시간 음성 대화 세션 대기 중</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
              좌측 하단의 <span className="text-emerald-600 font-bold font-mono">[CONNECT & START]</span> 버튼을 누르거나
              <span className="text-indigo-600 font-bold font-mono"> Spacebar</span>를 눌러 음성 상담을 시작하세요.
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-1">
                  <Bot className="w-4 h-4 drop-shadow-xs" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm transition-all ${
                  isUser
                    ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 text-white rounded-tr-xs shadow-colorful-indigo'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-soft hover:shadow-soft-lg'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/10 dark:border-slate-100">
                  <span
                    className={`text-[10px] font-mono font-extrabold uppercase tracking-wide ${
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

                {isUser ? (
                  <p className="leading-relaxed whitespace-pre-wrap text-white font-medium">{msg.text}</p>
                ) : (
                  <div className="text-slate-800 leading-relaxed text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {msg.latencyMs && (
                  <div
                    className={`mt-2.5 flex items-center gap-1 text-[10px] font-mono font-semibold pt-1 border-t border-slate-100 ${
                      isUser ? 'text-indigo-200' : 'text-emerald-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Response Latency: {msg.latencyMs.toFixed(1)}ms</span>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-1">
                  <User className="w-4 h-4 drop-shadow-xs" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming User Speech Ingest */}
        {currentTranscript && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-gradient-to-br from-indigo-50 via-sky-50 to-white text-indigo-950 border-2 border-indigo-400/90 rounded-tr-xs shadow-soft animate-pulse">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[10px] font-mono font-extrabold text-indigo-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  REAL-TIME STT (RECOGNIZING...)
                </span>
              </div>
              <p className="leading-relaxed font-semibold">{currentTranscript}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-indigo-300 mt-1">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating "Scroll to Bottom" button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-5 right-6 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-colorful-indigo flex items-center gap-1.5 transition-all duration-200 animate-bounce z-20 cursor-pointer border border-indigo-400"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>최신 대화로 이동</span>
        </button>
      )}
    </div>
  );
};

