import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { formatAuditLogsCsv } from '../utils/meetingLogic';
import type { AuditLogRecord } from '../types/meeting';

interface ComplianceViewProps {
  auditLogs: AuditLogRecord[];
  isLoading: boolean;
  isSignedIn: boolean;
  onOpenPrivacyModal: () => void;
  onExportData: () => void;
  onRequestPurge: () => void;
}

const COMPLIANCE_SAFEGUARDS = [
  {
    regulation: 'GDPR Art. 6 & Two-Party Consent',
    control: 'Mandatory Consent Gate',
    detail:
      'Audio, whiteboard, and transcript ingestion remains blocked client-side and server-side until participant consent is attested.',
  },
  {
    regulation: 'GDPR & CCPA Data Minimization',
    control: 'Zero-Retention Media Purge',
    detail:
      'Raw audio and image buffers are wiped from server and browser memory immediately after JSON extraction; one-click data purge supported.',
  },
  {
    regulation: 'EU AI Act & NIST AI RMF',
    control: 'HITL (< 0.75) & Disclosure Tag',
    detail:
      'Items below 0.75 extraction confidence block execution until manually verified; drafts append [AI-Assisted Draft • Verified by User].',
  },
  {
    regulation: 'OWASP LLM Top 10',
    control: 'XML Prompt Boundary Isolation',
    detail:
      'Meeting text is sanitized and wrapped inside <untrusted_meeting_data> delimiters with strict passive-data system boundaries.',
  },
  {
    regulation: 'SOC 2 & ISO 27001',
    control: 'Scoped OAuth & Immutable Ledger',
    detail:
      'Requests gmail.compose (drafts only, never gmail.send), enforces zero-trust Firestore tenant rules, and writes append-only audit logs.',
  },
];

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  auditLogs,
  isLoading,
  isSignedIn,
  onOpenPrivacyModal,
  onExportData,
  onRequestPurge,
}) => {
  const [auditSearch, setAuditSearch] = useState('');

  const telemetry = useMemo(() => {
    const totalAudits = auditLogs.length;
    const consentedCount = auditLogs.filter((l) => l.consentVerified).length;
    const consentRate =
      totalAudits === 0 ? '—' : `${Math.round((consentedCount / totalAudits) * 100)}%`;
    const totalWorkspaceOps = auditLogs.reduce(
      (acc, l) => acc + l.sheetsCount + l.calendarCount + l.gmailDraftCount,
      0
    );
    return { totalAudits, consentRate, totalWorkspaceOps };
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (l) =>
        l.meetingId.toLowerCase().includes(q) ||
        l.meetingTitle.toLowerCase().includes(q) ||
        l.humanReviewer.toLowerCase().includes(q) ||
        l.actionsSummary.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const handleExportAuditCsv = () => {
    const csv = formatAuditLogsCsv(auditLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadence-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Live Governance Readiness Strip */}
      <section
        aria-label="Governance Posture Metrics"
        className="grid grid-cols-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-xs sm:grid-cols-4 sm:divide-x sm:divide-y-0"
      >
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-zinc-500">Audited Executions</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
            {telemetry.totalAudits}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-zinc-500">Consent Attestation Rate</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
            {telemetry.consentRate}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-zinc-500">Workspace Sync Actions</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
            {telemetry.totalWorkspaceOps}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-zinc-500">Media Storage Policy</div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-950">
            Zero Retention
          </div>
        </div>
      </section>

      {/* Privacy Controls & Safeguards */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              Enterprise Compliance & Privacy Controls
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Active regulatory safeguards, portable data exports, and right-to-erasure controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenPrivacyModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Privacy Policy & Terms</span>
            </button>
            <button
              type="button"
              onClick={handleExportAuditCsv}
              disabled={auditLogs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Audit CSV</span>
            </button>
            <button
              type="button"
              onClick={onExportData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export All Data (JSON)</span>
            </button>
            {isSignedIn && (
              <button
                type="button"
                onClick={onRequestPurge}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Purge All My Data</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 pt-1 md:grid-cols-2 lg:grid-cols-3">
          {COMPLIANCE_SAFEGUARDS.map((item) => (
            <div key={item.control} className="border-t border-zinc-200 pt-3.5 space-y-1.5">
              <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {item.regulation}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
                <ShieldCheck className="h-4 w-4 text-zinc-900 shrink-0" />
                <span>{item.control}</span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Immutable Audit Trail Table */}
      <section
        aria-label="Immutable Audit Trail"
        className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-zinc-900 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Immutable Audit Trail</h3>
              <p className="text-xs text-zinc-500">
                Append-only Firestore <code className="font-mono">audit_logs</code> collection
                (updates and deletes denied by security rules).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                aria-label="Search audit log records"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filter meeting or reviewer..."
                className="w-60 sm:w-64 rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-zinc-500 whitespace-nowrap">
              {filteredLogs.length} record(s)
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-9 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-9 w-full animate-pulse rounded bg-zinc-100" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {auditLogs.length === 0
                ? 'No audit log entries recorded yet'
                : 'No audit log entries match your search'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {auditLogs.length === 0
                ? 'Approve and execute a meeting action plan to write a tamper-evident audit entry.'
                : 'Try clearing the search query above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 font-medium text-zinc-600">
                  <th className="px-3.5 py-2.5">Timestamp</th>
                  <th className="px-3.5 py-2.5">Meeting ID & Title</th>
                  <th className="px-3.5 py-2.5">Consent Verified</th>
                  <th className="px-3.5 py-2.5">Human Reviewer</th>
                  <th className="px-3.5 py-2.5">Workspace Actions Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50">
                    <td className="px-3.5 py-3 font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                      {new Date(log.createdAtMs).toISOString().replace('T', ' ').slice(0, 19)} UTC
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-mono text-zinc-900">{log.meetingId}</div>
                      <div className="text-zinc-500">{log.meetingTitle}</div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          log.consentVerified ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{log.consentVerified ? 'Yes' : 'No'}</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-zinc-700">
                      {log.humanReviewer}
                    </td>
                    <td className="px-3.5 py-3 text-zinc-700">{log.actionsSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
