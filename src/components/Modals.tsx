import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type { ActionItemDraft, WorkspaceExecutionTargets } from '../types/meeting';

function useEscapeClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
}

interface ExecuteConfirmModalProps {
  open: boolean;
  meetingTitle: string;
  items: ActionItemDraft[];
  createNewSheet: boolean;
  spreadsheetInput: string;
  targets: WorkspaceExecutionTargets;
  isExecuting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ExecuteConfirmModal: React.FC<ExecuteConfirmModalProps> = ({
  open,
  meetingTitle,
  items,
  createNewSheet,
  spreadsheetInput,
  targets,
  isExecuting,
  onCancel,
  onConfirm,
}) => {
  useEscapeClose(open && !isExecuting, onCancel);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="execute-dialog-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="execute-dialog-title"
                className="text-base font-semibold text-zinc-950"
              >
                Confirm Workspace Execution
              </h2>
              <p className="text-xs text-zinc-500">
                Human-in-the-Loop approval required before mutating Workspace data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isExecuting}
            aria-label="Close confirmation dialog"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 border-y border-zinc-200 py-4 text-sm text-zinc-700">
          <p className="text-zinc-600">
            Approving <span className="font-semibold text-zinc-950">{meetingTitle}</span> will
            execute the selected Workspace channels for{' '}
            <span className="font-mono tabular-nums font-medium text-zinc-950">
              {items.length}
            </span>{' '}
            action item(s) and write an immutable audit entry:
          </p>
          <ul className="space-y-2.5 text-sm">
            {targets.sheets && (
              <li className="flex items-start gap-2.5">
                <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-zinc-900" />
                <span>
                  <strong className="font-medium text-zinc-950">Google Sheets:</strong>{' '}
                  {createNewSheet || !spreadsheetInput.trim()
                    ? `Create a new tracker sheet and append ${items.length} action row(s).`
                    : `Append ${items.length} row(s) to spreadsheet ${spreadsheetInput.trim()}.`}
                </span>
              </li>
            )}
            {targets.calendar && (
              <li className="flex items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-zinc-900" />
                <span>
                  <strong className="font-medium text-zinc-950">Google Calendar:</strong> Create{' '}
                  <span className="font-mono tabular-nums">{items.length}</span> scheduled due-date
                  event(s) on your primary calendar.
                </span>
              </li>
            )}
            {targets.gmail && (
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-900" />
                <span>
                  <strong className="font-medium text-zinc-950">Gmail (Drafts Only):</strong>{' '}
                  Create <span className="font-mono tabular-nums">{items.length}</span> follow-up
                  draft email(s) tagged with{' '}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                    [AI-Assisted Draft • Verified by User]
                  </code>
                  . Emails are never auto-sent.
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isExecuting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isExecuting}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isExecuting ? 'Executing Workspace Sync...' : 'Confirm & Execute'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface DangerConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DangerConfirmModal: React.FC<DangerConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel,
  isBusy,
  onCancel,
  onConfirm,
}) => {
  useEscapeClose(open && !isBusy, onCancel);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="danger-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="danger-dialog-title" className="text-base font-semibold text-zinc-950">
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 cursor-pointer"
          >
            {isBusy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
  onExportData: () => void;
  onRequestPurge: () => void;
  isSignedIn: boolean;
}

export const PrivacyPolicyModal: React.FC<PrivacyModalProps> = ({
  open,
  onClose,
  onExportData,
  onRequestPurge,
  isSignedIn,
}) => {
  useEscapeClose(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-zinc-950" />
            <div>
              <h2 id="privacy-modal-title" className="text-lg font-semibold text-zinc-950">
                Privacy Policy, Governance & Terms
              </h2>
              <p className="text-xs text-zinc-500">
                GDPR · CCPA · EU AI Act · OWASP LLM Top 10 · SOC 2 Readiness
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy policy modal"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-700">
          <section>
            <h3 className="font-semibold text-zinc-950">
              1. Recording Consent & Legal Basis (GDPR Art. 6)
            </h3>
            <p className="mt-1 text-zinc-600">
              Cadence enforces a mandatory participant consent attestation prior to ingesting audio
              recordings, handwritten note photographs, or meeting transcripts. Processing is blocked
              both in the interface and on the backend server until explicit consent is confirmed.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-zinc-950">
              2. Zero-Retention Media Processing
            </h3>
            <p className="mt-1 text-zinc-600">
              Uploaded audio recordings and handwritten note images are transmitted strictly for
              server-side structured extraction via Google Gemini without training public models.
              Raw binary media payloads are purged from server and browser memory immediately after
              JSON extraction and are never stored in Cloud Firestore.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-zinc-950">
              3. Prompt Injection Isolation & Human Oversight
            </h3>
            <p className="mt-1 text-zinc-600">
              All untrusted meeting content is isolated inside{' '}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                &lt;untrusted_meeting_data&gt;
              </code>{' '}
              XML boundaries. Items below the 0.75 confidence threshold require manual human
              verification before Workspace execution, and generated drafts carry an explicit{' '}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                [AI-Assisted Draft • Verified by User]
              </code>{' '}
              disclosure.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-zinc-950">
              4. Scoped OAuth & Immutable Audit Logs
            </h3>
            <p className="mt-1 text-zinc-600">
              Cadence requests only minimal Workspace scopes (<code>spreadsheets</code>,{' '}
              <code>calendar.events</code>, and <code>gmail.compose</code> for drafts only—never{' '}
              <code>gmail.send</code>). Every approved execution writes a tamper-evident record to
              your private Firestore <code>audit_logs</code> collection.
            </p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportData}
              className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100 cursor-pointer"
            >
              Export My Data (JSON)
            </button>
            {isSignedIn && (
              <button
                type="button"
                onClick={onRequestPurge}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
              >
                Delete Account Data
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface AboutDeveloperModalProps {
  open: boolean;
  onClose: () => void;
}

export const AboutDeveloperModal: React.FC<AboutDeveloperModalProps> = ({ open, onClose }) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  useEscapeClose(open, onClose);
  if (!open) return null;

  const email = 'mdshabbirmia520@gmail.com';

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setCopiedEmail(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-dev-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-sm font-semibold text-white">
              MS
            </div>
            <div>
              <h2 id="about-dev-title" className="text-base font-semibold text-zinc-950">
                Md Shabbir Mia
              </h2>
              <p className="text-xs text-zinc-500">
                Enterprise AI Systems Architect & Full-Stack Engineer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close developer info modal"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-sm text-zinc-600">
          <p className="leading-relaxed">
            <strong className="font-medium text-zinc-950">Cadence</strong> was engineered and
            architected by <strong className="font-medium text-zinc-950">Md Shabbir Mia</strong> as
            an enterprise meeting-to-workspace action agent built around zero-trust tenant
            isolation, human-in-the-loop governance, and auditable Workspace execution.
          </p>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs space-y-2">
            <div className="font-semibold text-zinc-950 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-zinc-900" />
              <span>Enterprise Architecture & Governance Stack</span>
            </div>
            <p className="leading-relaxed text-zinc-700">
              React 19 · TypeScript · Express · Google Gemini Structured JSON · Firebase Auth &
              Firestore Tenant Rules · Scoped Google Workspace APIs (Sheets, Calendar, Gmail Drafts)
            </p>
            <p className="leading-relaxed text-zinc-500">
              Safeguards: GDPR Art. 6 Consent Gate · Zero-Retention Media Purge · OWASP XML
              Sandboxing · EU AI Act HITL (&lt;0.75) Gate · Immutable SOC 2 Audit Ledger
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs font-medium text-zinc-900 hover:bg-zinc-100"
            >
              <Mail className="h-3.5 w-3.5 text-zinc-900" />
              <span>{email}</span>
            </a>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 cursor-pointer"
            >
              {copiedEmail ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Email</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
