import React, { useState } from 'react';
import { AlertTriangle, Download, Copy, Check, X, ShieldAlert, FileText } from 'lucide-react';
import { RcaReport } from '../types';

interface RcaModalProps {
  report: RcaReport | null;
  onClose: () => void;
}

export const RcaModal: React.FC<RcaModalProps> = ({ report, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!report) return null;

  const closeCode = report.socket_close_info.raw_close_code;
  const isAbnormal1006 = closeCode === 1006;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rca_report_${report.session_id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRcaHypothesisMapping = () => {
    if (closeCode === 1006) {
      if (report.elapsed_session_sec >= 75 && report.elapsed_session_sec <= 125) {
        return {
          id: 'HYP-04 / HYP-01',
          title: 'GECX BidiRunSession Server Hard Timeout (80~120s Limit)',
          description: `연결 수립 후 약 ${report.elapsed_session_sec.toFixed(1)}초 시점에 서버가 Close Frame(정상 종료 패킷) 없이 TCP 세션을 강제 리셋했습니다. 이는 현업에서 보고된 80~120초 단절 이슈와 정확히 일치합니다.`,
          mitigation: '향후 프로덕션 이관 시 GECX Session Resumption(15분 세션 복구) 및 링 버퍼(Ring Buffer) 재전송 아키텍처 적용 필요.',
        };
      }
      return {
        id: 'HYP-02 / HYP-03',
        title: 'Infrastructure Proxy Timeout (TCP Reset)',
        description: `경과 시간 ${report.elapsed_session_sec.toFixed(1)}초에 비정상 단절이 발생했습니다. 프록시(Cloud Run 또는 API Gateway)의 유휴 타임아웃 또는 네트워크 패킷 드롭 가능성이 있습니다.`,
        mitigation: 'Cloud Run 및 API Gateway의 Request Timeout(최대 3600초) 설정 및 Ping-Pong Keepalive 주기 점검 필요.',
      };
    }
    if (closeCode === 1008) {
      return {
        id: 'SEC-01',
        title: 'Policy Violation / Expired Session Ticket',
        description: '단기 서명 티켓(JWT, 60초 TTL)이 만료되었거나 서명이 유효하지 않아 연결이 거부되었습니다.',
        mitigation: 'Agent Gateway에서 신규 세션 티켓을 재발급받아 WebSocket에 연결하십시오.',
      };
    }
    return {
      id: 'INFO-01',
      title: `Normal or Server Disconnection (Code: ${closeCode})`,
      description: report.socket_close_info.close_reason,
      mitigation: '정상 종료되었거나 서버에서 전송한 Close 사유를 확인하십시오.',
    };
  };

  const hypothesis = getRcaHypothesisMapping();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl bg-zinc-950 border border-borderLine shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900/80 border-b border-borderLine flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isAbnormal1006 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 font-sans">
                소켓 세션 단절 원인 분석 리포트 (RCA Report)
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                RFC 6455 Close Code: {closeCode} ({report.socket_close_info.close_code_name})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">세션 지속 시간</span>
              <span className="text-lg font-mono font-bold text-rose-400">
                {report.elapsed_session_sec.toFixed(2)}초
              </span>
            </div>
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">총 전송 청크 (TX)</span>
              <span className="text-lg font-mono font-bold text-zinc-100">
                {report.payload_metrics.total_audio_chunks_sent}개
              </span>
            </div>
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">마지막 오디오 레벨</span>
              <span className="text-lg font-mono font-bold text-zinc-100">
                {report.payload_metrics.mean_audio_rms_db.toFixed(1)} dBFS
              </span>
            </div>
          </div>

          {/* Diagnostic Hypothesis Box */}
          <div className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>진단 가설: {hypothesis.id} - {hypothesis.title}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              {hypothesis.description}
            </p>
            <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="text-emerald-400 font-semibold">권장 대책: </span>
              {hypothesis.mitigation}
            </div>
          </div>

          {/* Technical Diagnostics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Raw Diagnostic JSON Payloads
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-zinc-100 transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? '복사됨' : 'JSON 복사'}</span>
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400 hover:bg-emerald-500/20 transition"
                >
                  <Download className="w-3 h-3" />
                  <span>다운로드</span>
                </button>
              </div>
            </div>
            <pre className="p-3 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-mono overflow-x-auto max-h-40 border border-zinc-800">
              {JSON.stringify(report, null, 2)}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-zinc-900/60 border-t border-borderLine flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium transition"
          >
            닫기 (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
