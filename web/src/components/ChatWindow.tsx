import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImageIcon,
  ArrowDown,
  User,
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

  // Custom Markdown Components for Rich Citations & Images (Google Grounding Style)
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1.5 rounded-full bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#174ea6] border border-[#d2e3fc] font-medium text-xs shadow-2xs hover:shadow-xs transition-all duration-150 group break-all cursor-pointer"
            {...props}
          >
            <FileText className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
            <span className="font-medium text-[#1a73e8] group-hover:text-[#174ea6]">
              {children}
            </span>
            <ExternalLink className="w-3 h-3 text-[#1a73e8] shrink-0 ml-0.5" />
          </a>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1a73e8] hover:text-[#174ea6] underline decoration-[#aecbfa] underline-offset-2 inline-flex items-center gap-0.5 font-medium"
          {...props}
        >
          {children}
          <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
        </a>
      );
    },
    img: ({ src, alt }: any) => (
      <div className="my-3 rounded-2xl overflow-hidden border border-[#dadce0] shadow-sm bg-white max-w-lg transition-all hover:shadow-md">
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
            className="absolute top-2.5 right-2.5 p-2 rounded-full bg-[#202124]/80 hover:bg-[#202124] text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md flex items-center gap-1.5 text-xs"
            title="원본 이미지 열기"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>크게 보기</span>
          </a>
        </div>
        {alt && (
          <div className="px-3.5 py-2 text-[11px] text-[#5f6368] font-sans bg-[#f8f9fa] border-t border-[#dadce0] flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#1a73e8]" />
            <span>{alt}</span>
          </div>
        )}
      </div>
    ),
    p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed text-[#202124]">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1.5 my-2 pl-1 text-[#202124]">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1.5 my-2 pl-1 text-[#202124]">{children}</ol>,
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }: any) => <strong className="font-bold text-[#202124]">{children}</strong>,
  };

  return (
    <div className="flex-1 flex flex-col rounded-2xl bg-white border border-[#dadce0] overflow-hidden shadow-sm relative h-full min-h-[440px] font-sans">
      {/* Google Dialogue Header */}
      <div className="px-5 py-3.5 bg-white border-b border-[#dadce0] flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center gap-2.5 text-[#202124] font-medium">
          {/* Gemini Sparkle Icon */}
          <div className="w-6 h-6 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold text-[#202124]">GECX Multimodal Dialogue</span>
          <span className="text-xs text-[#5f6368] font-normal hidden sm:inline">(A2A Streaming)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#3c4043] flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3f4] border border-[#dadce0]">
            <span
              className={`w-2 h-2 rounded-full ${
                isStreaming ? 'bg-[#1e8e3e] animate-ping' : 'bg-[#9aa0a6]'
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
        className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-4 bg-[#f8fafd] scroll-smooth custom-scrollbar relative"
      >
        {messages.length === 0 && !currentTranscript && (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6 text-[#5f6368]">
            {/* Google Gemini Sparkle Welcome */}
            <div className="w-14 h-14 rounded-2xl bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-center text-[#1a73e8] mb-3.5 shadow-sm">
              <Sparkles className="w-7 h-7 stroke-[1.75]" />
            </div>
            <p className="text-sm font-bold text-[#202124]">실시간 음성 상담 세션 대기 중</p>
            <p className="text-xs text-[#5f6368] mt-1.5 max-w-sm leading-relaxed">
              좌측 하단의 <span className="text-[#1a73e8] font-bold">[CONNECT & START]</span> 버튼을 누르거나
              <span className="text-[#1a73e8] font-bold"> Spacebar</span>를 눌러 Google Voice Agent와 실시간 대화를 시작하세요.
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
                <div className="w-8 h-8 rounded-full bg-white border border-[#dadce0] text-[#1a73e8] flex items-center justify-center shadow-2xs shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-[#1a73e8]" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm transition-all ${
                  isUser
                    ? 'bg-[#1a73e8] text-white rounded-tr-xs shadow-sm'
                    : 'bg-white text-[#202124] border border-[#dadce0] rounded-tl-xs shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-black/5 dark:border-white/10">
                  <span
                    className={`text-[11px] font-medium tracking-wide ${
                      isUser ? 'text-[#d2e3fc]' : 'text-[#1a73e8]'
                    }`}
                  >
                    {isUser ? 'You (Voice Ingest)' : 'GECX Agent (A2A Voice)'}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      isUser ? 'text-[#d2e3fc]' : 'text-[#5f6368]'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {isUser ? (
                  <p className="leading-relaxed whitespace-pre-wrap text-white font-medium">{msg.text}</p>
                ) : (
                  <div className="text-[#202124] leading-relaxed text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {msg.latencyMs && (
                  <div
                    className={`mt-2 flex items-center gap-1 text-[10px] font-mono font-medium pt-1 border-t border-[#f1f3f4] ${
                      isUser ? 'text-[#d2e3fc]' : 'text-[#1e8e3e]'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Response Latency: {msg.latencyMs.toFixed(1)}ms</span>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center shadow-2xs shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming User Speech Ingest */}
        {currentTranscript && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[82%] rounded-2xl px-4 py-3 text-sm bg-[#e8f0fe] text-[#174ea6] border border-[#aecbfa] rounded-tr-xs shadow-sm animate-pulse">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[10px] font-mono font-bold text-[#1a73e8] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1a73e8] animate-ping" />
                  REAL-TIME STT (RECOGNIZING...)
                </span>
              </div>
              <p className="leading-relaxed font-semibold">{currentTranscript}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center shadow-2xs shrink-0 mt-1">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating "Scroll to Bottom" button (Google Material 3 FAB style) */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-5 right-6 px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium shadow-md flex items-center gap-1.5 transition-all duration-200 animate-bounce z-20 cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>최신 대화로 이동</span>
        </button>
      )}
    </div>
  );
};


