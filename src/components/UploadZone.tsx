import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react';
import { SAMPLE_MEETING_TEMPLATES } from '../utils/sampleMeetings';
import {
  analyzeTranscriptSecurity,
  formatDurationSeconds,
  redactSensitivePatterns,
} from '../utils/meetingLogic';
import type { ExtractedMeetingPlan, SourceType } from '../types/meeting';

interface UploadZoneProps {
  consentVerified: boolean;
  onConsentChange: (verified: boolean) => void;
  isExtracting: boolean;
  errorMessage: string | null;
  onExtractText: (text: string, label: string) => void;
  onExtractMedia: (params: {
    mode: 'audio' | 'image';
    base64: string;
    mimeType: string;
    fileName: string;
  }) => void;
  onLoadSamplePlan: (
    plan: ExtractedMeetingPlan,
    sourceLabel: string,
    sourceType: SourceType
  ) => void;
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createSampleWhiteboardDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#fdfcf7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillText('Q4 Infrastructure Readiness — Whiteboard Notes', 48, 72);

  ctx.fillStyle = '#334155';
  ctx.font = '20px Georgia, serif';
  const lines = [
    'Decision: Cut over EU-West database cluster on Nov 20 at 06:00 UTC.',
    'Decision: Freeze non-critical schema migrations starting Nov 18.',
    '',
    'Action Items:',
    '1. [Marcus] Run failover drill & publish latency report (Due: 2026-11-18) -> marcus@acme-ops.io',
    '2. [Priya] Rotate production KMS keys & update runbook (Due: 2026-11-19) -> priya@acme-ops.io',
    '3. [Elena] Send maintenance window notice to enterprise accounts (Due: 2026-11-17)',
  ];

  lines.forEach((line, idx) => {
    ctx.fillText(line, 48, 132 + idx * 46);
  });

  return canvas.toDataURL('image/png');
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  consentVerified,
  onConsentChange,
  isExtracting,
  errorMessage,
  onExtractText,
  onExtractMedia,
  onLoadSamplePlan,
}) => {
  const [activeTab, setActiveTab] = useState<SourceType>('text');
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    SAMPLE_MEETING_TEMPLATES[0].id
  );
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [redactionNotice, setRedactionNotice] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const securityScan = useMemo(
    () => analyzeTranscriptSecurity(transcriptText),
    [transcriptText]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleTabSwitch = (nextTab: SourceType) => {
    setActiveTab(nextTab);
    setSelectedFile(null);
    setMicError(null);
    setIsDragging(false);
  };

  const acceptBlobFile = async (file: File) => {
    const dataUrl = await fileToBase64(file);
    setSelectedFile({
      name: file.name,
      mimeType: file.type || (activeTab === 'audio' ? 'audio/webm' : 'image/png'),
      sizeBytes: file.size,
      dataUrl,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await acceptBlobFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!consentVerified) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await acceptBlobFile(file);
  };

  const startRecording = async () => {
    if (!consentVerified) return;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const dataUrl = await fileToBase64(blob);
        setSelectedFile({
          name: `live-recording-${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.webm`,
          mimeType: blob.type || 'audio/webm',
          sizeBytes: blob.size,
          dataUrl,
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setMicError('Microphone access denied or unavailable in this browser.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handlePopulateSampleTranscript = () => {
    const tpl =
      SAMPLE_MEETING_TEMPLATES.find((t) => t.id === selectedSampleId) ||
      SAMPLE_MEETING_TEMPLATES[0];
    setActiveTab('text');
    setRedactionNotice(null);
    setTranscriptText(tpl.transcript);
  };

  const handleGenerateSampleWhiteboard = () => {
    const dataUrl = createSampleWhiteboardDataUrl();
    if (dataUrl) {
      setActiveTab('image');
      setSelectedFile({
        name: 'q4-infra-whiteboard.png',
        mimeType: 'image/png',
        sizeBytes: Math.floor((dataUrl.length * 3) / 4),
        dataUrl,
      });
    }
  };

  const handleRedactSensitiveTokens = () => {
    const next = redactSensitivePatterns(transcriptText);
    setTranscriptText(next);
    setRedactionNotice('Masked phone numbers, secret tokens, and numeric ID patterns locally.');
  };

  const handleSubmitExtraction = () => {
    if (!consentVerified || isExtracting) return;
    if (activeTab === 'text') {
      if (!transcriptText.trim()) return;
      onExtractText(transcriptText, 'Transcript Ingestion');
      return;
    }
    if (selectedFile) {
      const captured = selectedFile;
      onExtractMedia({
        mode: activeTab,
        base64: captured.dataUrl,
        mimeType: captured.mimeType,
        fileName: captured.name,
      });
      setSelectedFile(null);
    }
  };

  const handleInstantSamplePlan = () => {
    if (!consentVerified) return;
    const tpl =
      SAMPLE_MEETING_TEMPLATES.find((t) => t.id === selectedSampleId) ||
      SAMPLE_MEETING_TEMPLATES[0];
    onLoadSamplePlan(tpl.fallbackPlan, `${tpl.label} (Demo Plan)`, 'text');
  };

  const canRunExtraction =
    consentVerified &&
    !isExtracting &&
    (activeTab === 'text' ? transcriptText.trim().length > 0 : Boolean(selectedFile));

  return (
    <section
      aria-label="Meeting Ingestion Zone"
      className="rounded-lg border border-slate-200 bg-white"
    >
      {/* Workflow Stage Indicator */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 bg-slate-50/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            step: '01',
            title: 'Attest & Ingest',
            desc: 'Consent check and multimodal source intake',
            active: true,
          },
          {
            step: '02',
            title: 'Human Verification',
            desc: 'Confidence gating (<0.75) and inline editing',
            active: false,
          },
          {
            step: '03',
            title: 'Workspace Sync & Audit',
            desc: 'Sheets, Calendar, Gmail Drafts & immutable log',
            active: false,
          },
        ].map((stage) => (
          <div key={stage.step} className="flex items-start gap-3 px-5 py-3.5">
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                stage.active ? 'text-blue-700' : 'text-slate-400'
              }`}
            >
              {stage.step}.
            </span>
            <div className="min-w-0">
              <div
                className={`text-xs font-semibold ${
                  stage.active ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                {stage.title}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{stage.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Ingest Meeting Source
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Process meeting audio recordings, whiteboard photographs, or raw transcripts into a
              structured execution plan.
            </p>
          </div>

          {/* Segmented Source Selector */}
          <div
            role="tablist"
            aria-label="Meeting source input mode"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'text'}
              onClick={() => handleTabSwitch('text')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Transcript</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audio'}
              onClick={() => handleTabSwitch('audio')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'audio'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Audio Recording</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'image'}
              onClick={() => handleTabSwitch('image')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'image'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Handwritten Notes</span>
            </button>
          </div>
        </div>

        {/* Mandatory Legal Consent Gate (GDPR Art. 6 / Two-Party Consent) */}
        <div
          className={`rounded-lg border p-4 transition-colors ${
            consentVerified
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consentVerified}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
            />
            <span className="text-xs leading-relaxed text-slate-700">
              <strong className="font-semibold text-slate-900">
                Mandatory Recording & Processing Consent Attestation (GDPR Art. 6):
              </strong>{' '}
              I confirm that all meeting participants explicitly consented to recording,
              transcription, and automated task extraction. Transient audio and image buffers are
              purged from memory immediately after structured JSON extraction.
            </span>
          </label>
        </div>

        {/* Input Area */}
        <div>
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="transcript-input"
                  className="text-xs font-semibold text-slate-700"
                >
                  Meeting Transcript or Notes
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Choose sample transcript template"
                    value={selectedSampleId}
                    onChange={(e) => setSelectedSampleId(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
                  >
                    {SAMPLE_MEETING_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handlePopulateSampleTranscript}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Insert Sample Text
                  </button>
                </div>
              </div>

              <textarea
                id="transcript-input"
                rows={7}
                value={transcriptText}
                onChange={(e) => {
                  setTranscriptText(e.target.value);
                  setRedactionNotice(null);
                }}
                placeholder="Paste raw meeting transcript, speaker notes, or call summary here..."
                className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />

              {/* Client-Side Security Pre-Flight Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                  <span>{securityScan.wordCount} words</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>{securityScan.charCount.toLocaleString()} chars</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>{securityScan.emailCount} email(s)</span>
                  {securityScan.sensitiveTokenCount > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-sans font-medium text-amber-800">
                        {securityScan.sensitiveTokenCount} sensitive token(s) detected
                      </span>
                    </>
                  )}
                </div>

                {securityScan.sensitiveTokenCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRedactSensitiveTokens}
                    className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Mask Sensitive Tokens</span>
                  </button>
                )}
              </div>

              {redactionNotice && (
                <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{redactionNotice}</span>
                </p>
              )}

              {securityScan.injectionSignals.length > 0 && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    <strong>Prompt-Injection Signal Detected:</strong>{' '}
                    {securityScan.injectionSignals.join(', ')}. Server extraction will isolate this
                    payload strictly as passive text inside{' '}
                    <code className="font-mono">&lt;untrusted_meeting_data&gt;</code> delimiters.
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  if (consentVerified) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors ${
                  !consentVerified
                    ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                    : isDragging
                    ? 'border-blue-700 bg-blue-50/60 cursor-pointer'
                    : 'border-slate-300 bg-slate-50 hover:border-blue-600 cursor-pointer'
                }`}
              >
                <Upload className="h-6 w-6 text-slate-500" />
                <span className="mt-2 text-sm font-medium text-slate-800">
                  Upload or Drop Audio File
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  MP3, WAV, M4A, WebM, OGG up to 20 MB (auto-purged)
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  disabled={!consentVerified}
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                {!isRecording ? (
                  <button
                    type="button"
                    disabled={!consentVerified}
                    onClick={startRecording}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Mic className="h-4 w-4 text-red-600" />
                    <span>Record Live Audio</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 cursor-pointer"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span>Stop Recording ({formatDurationSeconds(recordSeconds)})</span>
                  </button>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {consentVerified
                    ? 'Capture directly from your microphone'
                    : 'Confirm participant consent above to enable recording'}
                </p>
                {micError && <p className="mt-2 text-xs text-red-700">{micError}</p>}
              </div>

              {selectedFile && (
                <div className="md:col-span-2 space-y-2.5 rounded-lg border border-slate-200 bg-white p-3.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">
                      Ready for extraction: {selectedFile.name}{' '}
                      <span className="font-mono text-slate-500">
                        ({formatBytes(selectedFile.sizeBytes)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <audio controls src={selectedFile.dataUrl} className="h-9 w-full" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Upload Whiteboard or Handwritten Notes Image
                </span>
                <button
                  type="button"
                  disabled={!consentVerified}
                  onClick={handleGenerateSampleWhiteboard}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Generate Sample Whiteboard Photo
                </button>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  if (consentVerified) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors ${
                  !consentVerified
                    ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                    : isDragging
                    ? 'border-blue-700 bg-blue-50/60 cursor-pointer'
                    : 'border-slate-300 bg-slate-50 hover:border-blue-600 cursor-pointer'
                }`}
              >
                <ImageIcon className="h-6 w-6 text-slate-500" />
                <span className="mt-2 text-sm font-medium text-slate-800">
                  Select or Drop Handwritten Notes Image
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  PNG, JPG, WebP up to 20 MB (OCR processed in-memory, zero retention)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={!consentVerified}
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              {selectedFile && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {selectedFile.name}{' '}
                      <span className="font-mono text-slate-500">
                        ({formatBytes(selectedFile.sizeBytes)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <img
                    src={selectedFile.dataUrl}
                    alt="Preview of handwritten meeting notes"
                    referrerPolicy="no-referrer"
                    className="max-h-56 w-auto rounded border border-slate-200 bg-white object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
          >
            {errorMessage}
          </div>
        )}

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              Prompt-isolated via <code className="font-mono">&lt;untrusted_meeting_data&gt;</code>{' '}
              · Zero media retention
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!consentVerified || isExtracting}
              onClick={handleInstantSamplePlan}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load Sample Extraction
            </button>
            <button
              type="button"
              disabled={!canRunExtraction}
              onClick={handleSubmitExtraction}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{isExtracting ? 'Extracting Action Plan...' : 'Extract Action Plan'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isExtracting && (
          <div className="space-y-2.5 border-t border-slate-200 pt-5" aria-busy="true">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-10 w-5/6 animate-pulse rounded bg-slate-100" />
          </div>
        )}
      </div>
    </section>
  );
};
