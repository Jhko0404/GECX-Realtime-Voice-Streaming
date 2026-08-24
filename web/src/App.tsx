import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { ChatWindow } from './components/ChatWindow';
import { ControlDeck } from './components/ControlDeck';
import { TelemetryStrip } from './components/TelemetryStrip';
import { FrameInspector } from './components/FrameInspector';
import { RcaModal } from './components/RcaModal';
import { AudioRecorder } from './audio/audio_recorder';
import { AudioPlayer } from './audio/audio_player';
import { StreamingWebSocketService } from './services/websocket';
import { ConnectionState, ChatMessage, WebSocketFrame, TelemetryMetric, RcaReport } from './types';

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
  const [frames, setFrames] = useState<WebSocketFrame[]>([]);
  const [rcaReport, setRcaReport] = useState<RcaReport | null>(null);
  const [showRcaModal, setShowRcaModal] = useState<boolean>(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const wsServiceRef = useRef<StreamingWebSocketService | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize instances
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
          if (isFinal) {
            setMessages((prev) => [
              ...prev,
              {
                id: `usr-${Date.now()}`,
                sender: 'user',
                text: transcript,
                timestamp: new Date().toLocaleTimeString(),
                isFinal: true,
              },
            ]);
            setCurrentTranscript('');
          } else {
            setCurrentTranscript(transcript);
          }
        },
        onAgentOutput: (text, audio, turnCompleted) => {
          if (audio) {
            playerRef.current?.queueAudio(audio);
          }
          if (text) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.sender === 'agent' && !last.isFinal) {
                // Update existing agent message chunk
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + ' ' + text, isFinal: turnCompleted },
                ];
              }
              return [
                ...prev,
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
        onFrame: (frame) => {
          setFrames((prev) => [...prev.slice(-100), frame]); // Keep latest 100 frames in memory
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
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col antialiased relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* Soft Ambient Chromatic Background Orbs (Non-intrusive vibrant lighting) */}
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

      {/* 2. Main 2-Column Split Cockpit Layout */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1700px] w-full mx-auto relative z-10">
        {/* Left Column: Conversational & Audio Stream (45% -> 5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-[calc(100vh-6.5rem)]">
          {/* Canvas 2D Live Oscilloscope */}
          <Visualizer
            audioData={audioData}
            isStreaming={isStreaming}
            isBargeIn={isBargeIn}
            rmsDb={rmsDb}
          />

          {/* Real-time STT & Dialogue Window */}
          <ChatWindow
            messages={messages}
            currentTranscript={currentTranscript}
            isStreaming={isStreaming}
          />

          {/* Control Deck */}
          <ControlDeck
            connectionState={connectionState}
            isStreaming={isStreaming}
            onToggleStreaming={handleToggleStreaming}
            onEndSession={handleEndSession}
          />
        </div>

        {/* Right Column: Real-time Telemetry & WebSocket Inspector (55% -> 7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 h-[calc(100vh-6.5rem)]">
          {/* Real-time Telemetry Metric Cards */}
          <TelemetryStrip
            metric={latestMetric}
            totalFrames={frames.length}
          />

          {/* Live WebSocket Frame Stream Inspector */}
          <FrameInspector frames={frames} />
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
