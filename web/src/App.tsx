import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { ChatWindow } from './components/ChatWindow';
import { ControlDeck } from './components/ControlDeck';
import { TelemetryStrip } from './components/TelemetryStrip';
import { LogTerminal } from './components/LogTerminal';
import { RcaModal } from './components/RcaModal';
import { AudioRecorder } from './audio/audio_recorder';
import { AudioPlayer } from './audio/audio_player';
import { StreamingWebSocketService } from './services/websocket';
import { ConnectionState, ChatMessage, TelemetryMetric, RcaReport, LogEntry, TurnMode, TurnState } from './types';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [turnMode, setTurnMode] = useState<TurnMode>('TURN_GATED');
  const [turnState, setTurnState] = useState<TurnState>('IDLE');
  const [sessionId, setSessionId] = useState<string>('');
  const [durationSec, setDurationSec] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [audioData, setAudioData] = useState<Int16Array | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isBargeIn, setIsBargeIn] = useState<boolean>(false);
  const [bargeInGuard, setBargeInGuard] = useState<boolean>(true);
  const [rmsDb, setRmsDb] = useState<number>(-100);
  const [latestMetric, setLatestMetric] = useState<TelemetryMetric | null>(null);
  const [totalFramesCount, setTotalFramesCount] = useState<number>(0);
  const [ttftMs, setTtftMs] = useState<number | null>(null);
  const [rcaReport, setRcaReport] = useState<RcaReport | null>(null);
  const [showRcaModal, setShowRcaModal] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      tag: 'SYSTEM',
      message: 'Console ready. Initialized 16kHz Linear16 Turn-Gated A2A streaming client.',
    },
  ]);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const wsServiceRef = useRef<StreamingWebSocketService | null>(null);
  const timerRef = useRef<any>(null);
  const currentTranscriptRef = useRef<string>('');
  const bargeInGuardRef = useRef<boolean>(true);
  const turnModeRef = useRef<TurnMode>('TURN_GATED');
  const turnStateRef = useRef<TurnState>('IDLE');
  const isServerTurnCompletedRef = useRef<boolean>(false);
  const turnStabilizeTimeoutRef = useRef<any>(null);
  const userSpeechEndTimeRef = useRef<number>(0);
  const currentTurnTtftRef = useRef<number | null>(null);

  // Sync refs with state
  useEffect(() => {
    bargeInGuardRef.current = bargeInGuard;
  }, [bargeInGuard]);

  useEffect(() => {
    turnModeRef.current = turnMode;
  }, [turnMode]);

  useEffect(() => {
    turnStateRef.current = turnState;
  }, [turnState]);

  const addLog = (level: LogEntry['level'], tag: string, message: string) => {
    setLogs((prev) => [
      ...prev.slice(-150), // keep latest 150 log entries
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        level,
        tag,
        message,
      },
    ]);
  };

  const transitionToUserTurn = (reason: string) => {
    if (turnStabilizeTimeoutRef.current) {
      clearTimeout(turnStabilizeTimeoutRef.current);
    }
    // 150ms Stabilization Buffer (Grill-Me Agreed Spec)
    turnStabilizeTimeoutRef.current = setTimeout(() => {
      turnStateRef.current = 'USER_TURN';
      setTurnState('USER_TURN');
      addLog('SUCCESS', 'TURN', `Switched to User Turn (${reason}) - Microphone streaming active`);
    }, 150);
  };

  // Initialize audio recorder and player
  useEffect(() => {
    const player = new AudioPlayer();
    player.setOnPlaybackEnded(() => {
      if (turnStateRef.current === 'AGENT_TURN') {
        transitionToUserTurn('Agent voice playback finished');
      }
    });
    playerRef.current = player;
    recorderRef.current = new AudioRecorder();

    return () => {
      recorderRef.current?.stop();
      playerRef.current?.close();
      wsServiceRef.current?.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
      if (turnStabilizeTimeoutRef.current) clearTimeout(turnStabilizeTimeoutRef.current);
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
      addLog('INFO', 'AUTH', 'Requesting ephemeral session ticket from API Gateway (/api/v1/session/start)...');

      // Create WebSocket Service with callbacks
      const wsService = new StreamingWebSocketService({
        onReady: (newSessionId) => {
          setSessionId(newSessionId);
          setConnectionState('LIVE');
          setIsStreaming(true);
          turnStateRef.current = 'USER_TURN';
          setTurnState('USER_TURN');
          isServerTurnCompletedRef.current = false;
          addLog('SUCCESS', 'GECX', `BidiRunSession upstream ready (session: ${newSessionId})`);
          addLog('INFO', 'TURN', 'Initial Turn: USER_TURN (Listening) - Speak to begin conversation.');

          // Start microphone audio recording with Turn-Gated & Smart Barge-In Guard
          recorderRef.current?.start((base64Audio, rawInt16) => {
            setAudioData(rawInt16);
            const isAgentSpeaking = playerRef.current?.isPlaying() ?? false;
            const chunkDb = AudioRecorder.calculateRmsDb(rawInt16);

            // 1. Turn-Gated Safe Mode (Default & 1007 Zero Error Defense)
            if (turnModeRef.current === 'TURN_GATED') {
              if (turnStateRef.current === 'AGENT_TURN' || isAgentSpeaking) {
                // Send continuous 50ms silence frame to preserve GECX stream cadence without audio conflict
                wsServiceRef.current?.sendAudioChunk(AudioRecorder.getSilentChunkBase64());
                return;
              }
              wsServiceRef.current?.sendAudioChunk(base64Audio);
              return;
            }

            // 2. Full-Duplex Mode with Smart Barge-In Guard
            if (bargeInGuardRef.current && isAgentSpeaking) {
              if (chunkDb < -35) {
                // Speaker audio leakage/ambient floor: send silence frame
                wsServiceRef.current?.sendAudioChunk(AudioRecorder.getSilentChunkBase64());
                return;
              } else {
                // Deliberate user interruption: Flush audio playback and apply 150ms temporal gap
                playerRef.current?.flush();
                transitionToUserTurn('User Barge-In Speech');
                setIsBargeIn(true);
                addLog('WARN', 'BARGE-IN', 'Barge-In detected: Flushed agent audio playback and created 150ms temporal gap.');
                setTimeout(() => setIsBargeIn(false), 800);
                wsServiceRef.current?.sendAudioChunk(AudioRecorder.getSilentChunkBase64());
                return;
              }
            }
            wsServiceRef.current?.sendAudioChunk(base64Audio);
          });
          addLog('AUDIO', 'MIC', 'Microphone active (16kHz 16-bit Mono Linear16, 50ms chunk interval)');
        },
        onSTT: (transcript, isFinal) => {
          if (!transcript) return;

          if (isFinal) {
            userSpeechEndTimeRef.current = Date.now();
            currentTurnTtftRef.current = null;
            currentTranscriptRef.current = '';
            setCurrentTranscript('');
            addLog('SUCCESS', 'STT', `Recognized (Final): "${transcript}"`);

            setMessages((prev) => {
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
          const now = Date.now();
          // Calculate TTFT on the very first arrival of audio or text response
          if (userSpeechEndTimeRef.current > 0 && currentTurnTtftRef.current == null) {
            const calculatedTtft = now - userSpeechEndTimeRef.current;
            currentTurnTtftRef.current = calculatedTtft;
            setTtftMs(calculatedTtft);
            addLog('INFO', 'TTFT', `Time To First Token / Audio: ${Math.round(calculatedTtft)}ms`);
            userSpeechEndTimeRef.current = 0; // reset for next turn
          }

          if (audio) {
            if (turnStateRef.current !== 'AGENT_TURN') {
              turnStateRef.current = 'AGENT_TURN';
              setTurnState('AGENT_TURN');
              addLog('INFO', 'TURN', 'Agent speech started: Gated mic streaming to prevent 1007 turn conflict');
            }
            isServerTurnCompletedRef.current = false;
            playerRef.current?.queueAudio(audio);
          }

          if (turnCompleted) {
            isServerTurnCompletedRef.current = true;
            if (!playerRef.current?.isPlaying()) {
              transitionToUserTurn('GECX Server Turn Completed');
            }
          }

          // Always ensure an active Agent bubble exists for sub-second visual feedback!
          setMessages((prev) => {
            const updated = [...prev];

            // If there was any pending user transcript, push it first
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
              return [
                ...updated.slice(0, -1),
                {
                  ...last,
                  text: text ? last.text + text : last.text,
                  isFinal: turnCompleted,
                  latencyMs: currentTurnTtftRef.current ?? last.latencyMs,
                },
              ];
            }

            // Create new streaming agent bubble
            return [
              ...updated,
              {
                id: `agt-${Date.now()}`,
                sender: 'agent',
                text: text || '',
                timestamp: new Date().toLocaleTimeString(),
                isFinal: turnCompleted,
                latencyMs: currentTurnTtftRef.current ?? undefined,
              },
            ];
          });

          if (text) {
            addLog('SUCCESS', 'AGENT', `Text chunk received (${text.length} chars, completed=${turnCompleted})`);
          }
        },
        onBargeIn: () => {
          setIsBargeIn(true);
          playerRef.current?.flush();
          transitionToUserTurn('Barge-In Interruption Signal');
          addLog('WARN', 'BARGE-IN', 'User speech detected during agent voice playback. Audio playback flushed & 150ms temporal gap applied for clean Turn transition.');
          setTimeout(() => setIsBargeIn(false), 800);
        },
        onTelemetry: (metric) => {
          setLatestMetric(metric);
          setRmsDb(metric.rms_db);
        },
        onDisconnected: (report) => {
          setConnectionState('DISCONNECTED');
          setTurnState('IDLE');
          turnStateRef.current = 'IDLE';
          setIsStreaming(false);
          recorderRef.current?.stop();
          setRcaReport(report);
          setShowRcaModal(true);
          addLog(
            'ERROR',
            'RCA',
            `Session Disconnected (Code ${report.socket_close_info.raw_close_code}): ${report.socket_close_info.close_reason}`
          );
        },
        onError: (errMsg) => {
          console.error('Streaming error:', errMsg);
          addLog('ERROR', 'ERROR', errMsg);
        },
        onFrame: () => {
          setTotalFramesCount((prev) => prev + 1);
        },
      });

      wsServiceRef.current = wsService;

      // 1. Control plane request for session ticket
      const sessionData = await wsService.startSession();
      addLog('SUCCESS', 'AUTH', `Session ticket issued (TTL 60s, ID: ${sessionData.session_id.substring(0, 16)}...)`);

      // 2. Data plane connect via WebSocket
      addLog('INFO', 'WS', `Connecting WebSocket data plane to ${sessionData.ws_endpoint}...`);
      await wsService.connect(sessionData.ws_endpoint, sessionData.session_ticket);
      addLog('SUCCESS', 'WS', 'WebSocket Handshake 101 Switching Protocols Established.');
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setConnectionState('ERROR');
      setTurnState('IDLE');
      turnStateRef.current = 'IDLE';
      addLog('ERROR', 'CONN_FAIL', `Session start failed: ${err.message || err}`);
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
      addLog('WARN', 'AUDIO', 'Microphone recording paused by user.');
    } else {
      // Resume mic streaming
      recorderRef.current?.start((base64Audio, rawInt16) => {
        setAudioData(rawInt16);
        const isAgentSpeaking = playerRef.current?.isPlaying() ?? false;
        const chunkDb = AudioRecorder.calculateRmsDb(rawInt16);

        if (turnModeRef.current === 'TURN_GATED') {
          if (turnStateRef.current === 'AGENT_TURN' || isAgentSpeaking) {
            wsServiceRef.current?.sendAudioChunk(AudioRecorder.getSilentChunkBase64());
            return;
          }
          wsServiceRef.current?.sendAudioChunk(base64Audio);
          return;
        }

        if (bargeInGuardRef.current && isAgentSpeaking) {
          if (chunkDb < -35) {
            wsServiceRef.current?.sendAudioChunk(AudioRecorder.getSilentChunkBase64());
            return;
          } else {
            playerRef.current?.flush();
            transitionToUserTurn('User Barge-In Speech');
            setIsBargeIn(true);
            addLog('WARN', 'BARGE-IN', 'Barge-In detected: Flushed agent audio playback and created 150ms temporal gap.');
            setTimeout(() => setIsBargeIn(false), 800);
            wsServiceRef.current?.sendAudioChunk(AudioRecorder.getSilentChunkBase64());
            return;
          }
        }
        wsServiceRef.current?.sendAudioChunk(base64Audio);
      });
      setIsStreaming(true);
      addLog('AUDIO', 'MIC', 'Microphone recording resumed.');
    }
  };

  const handleEndSession = () => {
    if (turnStabilizeTimeoutRef.current) clearTimeout(turnStabilizeTimeoutRef.current);
    recorderRef.current?.stop();
    playerRef.current?.flush();
    wsServiceRef.current?.disconnect();
    setConnectionState('IDLE');
    setTurnState('IDLE');
    turnStateRef.current = 'IDLE';
    setIsStreaming(false);
    setAudioData(null);
    setLatestMetric(null);
    currentTranscriptRef.current = '';
    setCurrentTranscript('');
    addLog('INFO', 'SESSION', 'Session terminated cleanly by user (Code 1000).');
  };

  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#202124] flex flex-col antialiased relative selection:bg-[#d2e3fc] selection:text-[#174ea6] font-sans">
      {/* Soft Ambient Google 4-Color Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#d2e3fc] blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-[#fad2cf] blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-[#ceead6] blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#feefc3] blur-3xl" />
      </div>

      {/* 1. Google Cloud Style Header */}
      <Header
        connectionState={connectionState}
        sessionId={sessionId}
        durationSec={durationSec}
      />

      {/* 2. Main Google Cloud Cockpit Layout */}
      <main className="flex-1 p-4 lg:p-6 flex flex-col gap-4 max-w-[1500px] w-full mx-auto relative z-10">
        {/* Top: 4-Card Google Material 3 Telemetry Strip */}
        <TelemetryStrip
          metric={latestMetric}
          totalFrames={totalFramesCount}
          ttftMs={ttftMs}
        />

        {/* Content: 2-Column Split (Left Deck + Right Dialogue Stage) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[calc(100vh-14rem)]">
          {/* Left Column: Audio Visualizer, Controls, Spec & Diagnostic Terminal (4.5 cols / 38%) */}
          <div className="lg:col-span-5 flex flex-col gap-3.5">
            {/* Google Gemini Multi-Color Audio Waveform */}
            <Visualizer
              audioData={audioData}
              isStreaming={isStreaming}
              isBargeIn={isBargeIn}
              rmsDb={rmsDb}
              turnState={turnState}
              turnMode={turnMode}
            />

            {/* Streaming Control Deck */}
            <ControlDeck
              connectionState={connectionState}
              isStreaming={isStreaming}
              bargeInGuard={bargeInGuard}
              turnMode={turnMode}
              onToggleStreaming={handleToggleStreaming}
              onEndSession={handleEndSession}
              onToggleBargeInGuard={() => setBargeInGuard((prev) => !prev)}
              onToggleTurnMode={() => {
                const nextMode = turnMode === 'TURN_GATED' ? 'FULL_DUPLEX' : 'TURN_GATED';
                setTurnMode(nextMode);
                turnModeRef.current = nextMode;
                addLog(
                  'INFO',
                  'CONFIG',
                  `Turn Mode switched to: ${
                    nextMode === 'TURN_GATED'
                      ? 'Turn-Gated Safe Mode (1007 Zero Error)'
                      : 'Full-Duplex (Smart Barge-In)'
                  }`
                );
              }}
            />

            {/* Google Cloud Session Infrastructure Card */}
            <div className="rounded-2xl bg-white border border-[#dadce0] p-3.5 shadow-sm flex flex-col gap-2 text-xs font-sans">
              <div className="flex items-center justify-between text-[#202124] font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#202124]">Cloud Architecture & Protocol</span>
                </div>
                <span className="text-[10px] text-[#137333] font-medium bg-[#e6f4ea] px-2.5 py-0.5 rounded-full border border-[#ceead6]">
                  Active Serving
                </span>
              </div>

              <div className="space-y-1.5 text-[#5f6368] text-[11px] pt-1.5 border-t border-[#f1f3f4]">
                <div className="flex items-center justify-between">
                  <span className="text-[#5f6368]">Backend Protocol:</span>
                  <strong className="text-[#202124] font-medium font-mono">BidiRunSession (A2A Voice)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5f6368]">Turn Strategy:</span>
                  <strong className="text-[#137333] font-medium font-mono">Turn-Gated Hybrid Safety</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5f6368]">Security Auth:</span>
                  <strong className="text-[#1a73e8] font-medium">Signed Ephemeral JWT (TTL 60s)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5f6368]">Audio Encoding:</span>
                  <strong className="text-[#202124] font-medium font-mono">LINEAR16 · 16kHz Mono</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5f6368]">Ingress Gateway:</span>
                  <strong className="text-[#202124] font-medium">Google Cloud API Gateway</strong>
                </div>
              </div>
            </div>

            {/* Live Diagnostic Log Terminal */}
            <LogTerminal
              logs={logs}
              onClearLogs={() => setLogs([])}
            />
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
