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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/90 font-medium text-xs shadow-2xs hover:shadow-xs transition group break-all cursor-pointer"
            {...props}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-semibold underline decoration-indigo-300 underline-offset-2 group-hover:text-indigo-950">
              {children}
            </span>
            <ExternalLink className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 shrink-0 ml-0.5" />
          </a>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-800 underline decoration-sky-300 underline-offset-2 inline-flex items-center gap-0.5 font-medium"
          {...props}
        >
          {children}
          <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
        </a>
      );
    },
    img: ({ src, alt }: any) => (
      <div className="my-2.5 rounded-xl overflow-hidden border border-slate-200/90 shadow-soft bg-slate-50 max-w-lg">
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
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition shadow-xs"
            title="원본 이미지 열기"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        {alt && (
          <div className="px-3 py-1.5 text-[11px] text-slate-600 font-mono bg-slate-100/90 border-t border-slate-200 flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3 text-slate-400" />
            <span>{alt}</span>
          </div>
        )}
      </div>
    ),
    p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>,
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }: any) => <strong className="font-bold text-slate-900">{children}</strong>,
  };

  return (
    <div className="flex-1 flex flex-col rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-soft relative h-full min-h-[420px]">
      {/* Dialogue Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-sky-50/40 border-b border-slate-200 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span>REAL-TIME MULTIMODAL DIALOGUE</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isStreaming ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
            }`}
          />
          Audio-to-Audio (A2A) · {isStreaming ? 'LISTENING' : 'IDLE'}
        </span>
      </div>

      {/* Messages Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 lg:p-5 overflow-y-auto space-y-4 bg-slate-50/40 scroll-smooth custom-scrollbar relative"
      >
        {messages.length === 0 && !currentTranscript && (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 drop-shadow-xs" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                  isUser
                    ? 'bg-gradient-to-br from-indigo-500 to-sky-600 text-white rounded-tr-xs shadow-colorful-indigo'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-soft'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
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

                {isUser ? (
                  <p className="leading-relaxed whitespace-pre-wrap text-white">{msg.text}</p>
                ) : (
                  <div className="text-slate-800 leading-relaxed text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                  <User className="w-4 h-4 drop-shadow-xs" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming User Speech Ingest */}
        {currentTranscript && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-gradient-to-br from-indigo-50 to-sky-50 text-indigo-900 border-2 border-indigo-400 rounded-tr-xs shadow-soft animate-pulse">
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

      {/* Floating "Scroll to Bottom" button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-6 px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-colorful-indigo flex items-center gap-1.5 transition-all duration-200 animate-bounce z-20 cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>최신 대화로 이동</span>
        </button>
      )}
    </div>
  );
};
