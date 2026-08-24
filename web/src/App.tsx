import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { ChatWindow } from './components/ChatWindow';
import { ControlDeck } from './components/ControlDeck';
import { TelemetryStrip } from './components/TelemetryStrip';
import { RcaModal } from './components/RcaModal';
import { AudioRecorder } from './audio/audio_recorder';
import { AudioPlayer } from './audio/audio_player';
import { StreamingWebSocketService } from './services/websocket';
import { ConnectionState, ChatMessage, TelemetryMetric, RcaReport } from './types';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [sessionId, setSessionId] = useState<string>('');
  const [durationSec, setDurationSec] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [audioData, setAudioData] = useState<Int16Array | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isBargeIn, setIsBargeIn] = useState<boolean>(false);
  const [rmsDb, setRmsDb] = useState<number>(-100);
  const [latestMetric, setLatestMetric] = useState<TelemetryMetric | null>(null);
  const [totalFramesCount, setTotalFramesCount] = useState<number>(0);
  const [rcaReport, setRcaReport] = useState<RcaReport | null>(null);
  const [showRcaModal, setShowRcaModal] = useState<boolean>(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const wsServiceRef = useRef<StreamingWebSocketService | null>(null);
  const timerRef = useRef<any>(null);
  const currentTranscriptRef = useRef<string>('');

  // Initialize audio recorder and player
  useEffect(() => {
    playerRef.current = new AudioPlayer();
    recorderRef.current = new AudioRecorder();

    return () => {
      recorderRef.current?.stop();
      playerRef.current?.close();
      wsServiceRef.current?.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Duration Timer
  useEffect(() => {
    if (connectionState === 'LIVE') {
      const startTime = Date.now() - durationSec * 1000;
      timerRef.current = setInterval(() => {
        setDurationSec((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connectionState]);

  const handleStartSessionAndStreaming = async () => {
    try {
      setConnectionState('CONNECTING');
      setDurationSec(0);

      // Create WebSocket Service with callbacks
      const wsService = new StreamingWebSocketService({
        onReady: (newSessionId) => {
          setSessionId(newSessionId);
          setConnectionState('LIVE');
          setIsStreaming(true);

          // Start microphone audio recording
          recorderRef.current?.start((base64Audio, rawInt16) => {
            setAudioData(rawInt16);
            wsServiceRef.current?.sendAudioChunk(base64Audio);
          });
        },
        onSTT: (transcript, isFinal) => {
          if (!transcript) return;

          if (isFinal) {
            currentTranscriptRef.current = '';
            setCurrentTranscript('');

            setMessages((prev) => {
              // Check if the last message was an unfinalized user transcript
              const last = prev[prev.length - 1];
              if (last && last.sender === 'user' && !last.isFinal) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: transcript, isFinal: true },
                ];
              }
              return [
                ...prev,
                {
                  id: `usr-${Date.now()}`,
                  sender: 'user',
                  text: transcript,
                  timestamp: new Date().toLocaleTimeString(),
                  isFinal: true,
                },
              ];
            });
          } else {
            currentTranscriptRef.current = transcript;
            setCurrentTranscript(transcript);
          }
        },
        onAgentOutput: (text, audio, turnCompleted) => {
          if (audio) {
            playerRef.current?.queueAudio(audio);
          }
          if (text) {
            setMessages((prev) => {
              const updated = [...prev];

              // CRITICAL TURN-TAKING FIX:
              // If user was actively speaking (currentTranscriptRef is non-empty) but GECX began agent output
              // before an explicit isFinal reached the client, commit the user's utterance first!
              if (currentTranscriptRef.current) {
                const userSpeech = currentTranscriptRef.current;
                currentTranscriptRef.current = '';
                setCurrentTranscript('');

                updated.push({
                  id: `usr-${Date.now()}`,
                  sender: 'user',
                  text: userSpeech,
                  timestamp: new Date().toLocaleTimeString(),
                  isFinal: true,
                });
              }

              const last = updated[updated.length - 1];
              if (last && last.sender === 'agent' && !last.isFinal) {
                // Smart chunk concatenation without redundant whitespace
                return [
                  ...updated.slice(0, -1),
                  { ...last, text: last.text + text, isFinal: turnCompleted },
                ];
              }

              return [
                ...updated,
                {
                  id: `agt-${Date.now()}`,
                  sender: 'agent',
                  text,
                  timestamp: new Date().toLocaleTimeString(),
                  isFinal: turnCompleted,
                },
              ];
            });
          }
        },
        onBargeIn: () => {
          setIsBargeIn(true);
          playerRef.current?.flush();
          setTimeout(() => setIsBargeIn(false), 800);
        },
        onTelemetry: (metric) => {
          setLatestMetric(metric);
          setRmsDb(metric.rms_db);
        },
        onDisconnected: (report) => {
          setConnectionState('DISCONNECTED');
          setIsStreaming(false);
          recorderRef.current?.stop();
          setRcaReport(report);
          setShowRcaModal(true);
        },
        onError: (errMsg) => {
          console.error('Streaming error:', errMsg);
        },
        onFrame: () => {
          setTotalFramesCount((prev) => prev + 1);
        },
      });

      wsServiceRef.current = wsService;

      // 1. Control plane request for session ticket
      const sessionData = await wsService.startSession();
      // 2. Data plane connect via WebSocket
      await wsService.connect(sessionData.ws_endpoint, sessionData.session_ticket);
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setConnectionState('ERROR');
      alert(`세션 연결 실패: ${err.message || err}`);
    }
  };

  const handleToggleStreaming = () => {
    if (connectionState === 'IDLE' || connectionState === 'DISCONNECTED' || connectionState === 'ERROR') {
      handleStartSessionAndStreaming();
    } else if (isStreaming) {
      // Pause mic streaming
      recorderRef.current?.stop();
      setIsStreaming(false);
      setAudioData(null);
    } else {
      // Resume mic streaming
      recorderRef.current?.start((base64Audio, rawInt16) => {
        setAudioData(rawInt16);
        wsServiceRef.current?.sendAudioChunk(base64Audio);
      });
      setIsStreaming(true);
    }
  };

  const handleEndSession = () => {
    recorderRef.current?.stop();
    playerRef.current?.flush();
    wsServiceRef.current?.disconnect();
    setConnectionState('IDLE');
    setIsStreaming(false);
    setAudioData(null);
    setLatestMetric(null);
    currentTranscriptRef.current = '';
    setCurrentTranscript('');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col antialiased relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* Soft Ambient Chromatic Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-rose-200/30 blur-3xl" />
      </div>

      {/* 1. Header */}
      <Header
        connectionState={connectionState}
        sessionId={sessionId}
        durationSec={durationSec}
      />

      {/* 2. Main High-End Cockpit Layout */}
      <main className="flex-1 p-4 lg:p-6 flex flex-col gap-5 max-w-[1500px] w-full mx-auto relative z-10">
        {/* Top: 4-Card Vibrant Telemetry Strip */}
        <TelemetryStrip
          metric={latestMetric}
          totalFrames={totalFramesCount}
        />

        {/* Content: 2-Column Split (Left Deck + Right Dialogue Stage) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[calc(100vh-14rem)]">
          {/* Left Column: Audio Visualizer & Controls (4.5 cols / 38%) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Live Oscilloscope & Audio VU Meter */}
            <Visualizer
              audioData={audioData}
              isStreaming={isStreaming}
              isBargeIn={isBargeIn}
              rmsDb={rmsDb}
            />

            {/* Streaming Control Deck */}
            <ControlDeck
              connectionState={connectionState}
              isStreaming={isStreaming}
              onToggleStreaming={handleToggleStreaming}
              onEndSession={handleEndSession}
            />

            {/* Architecture & Protocol Badge Card */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-soft flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-800 font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span>SESSION INFRASTRUCTURE</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  READY
                </span>
              </div>

              <div className="space-y-1.5 text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span>Backend Protocol:</span>
                  <strong className="text-slate-800">BidiRunSession (A2A)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Security Auth:</span>
                  <strong className="text-indigo-600 font-semibold">JWT Ticket (TTL 60s)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Audio Encoding:</span>
                  <strong className="text-slate-800">LINEAR16 16kHz Mono</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ingress Gateway:</span>
                  <strong className="text-slate-800">Google API Gateway</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Full-Height Clean Dialogue Window (7.5 cols / 62%) */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <ChatWindow
              messages={messages}
              currentTranscript={currentTranscript}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </main>

      {/* 3. Disconnect Root Cause Analysis (RCA) Modal */}
      {showRcaModal && (
        <RcaModal
          report={rcaReport}
          onClose={() => setShowRcaModal(false)}
        />
      )}
    </div>
  );
};
