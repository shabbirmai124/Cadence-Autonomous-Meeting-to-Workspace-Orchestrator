import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  CONFIDENCE_VERIFICATION_THRESHOLD,
  extractSpreadsheetId,
  formatMeetingBriefMarkdown,
  generateSafeId,
  getUnverifiedLowConfidenceItems,
  validateActionItemsForExecution,
} from '../utils/meetingLogic';
import type {
  ActionItemDraft,
  ActionItemPriority,
  MeetingRecord,
  WorkspaceExecutionTargets,
} from '../types/meeting';

interface ReviewDashboardProps {
  meeting: MeetingRecord;
  defaultSpreadsheetId?: string;
  isSignedIn: boolean;
  isSaving: boolean;
  isExecuting: boolean;
  executionError: string | null;
  onUpdateMeetingField: (updates: {
    title?: string;
    summary?: string;
    keyDecisions?: string[];
  }) => void;
  onUpdateActionItem: (item: ActionItemDraft) => void;
  onAddActionItem: (item: ActionItemDraft) => void;
  onDeleteActionItem: (itemId: string) => void;
  onCloneAsDraft: () => void;
  onRequestExecute: (opts: {
    createNewSheet: boolean;
    spreadsheetInput: string;
    selectedItemIds: string[];
    targets: WorkspaceExecutionTargets;
  }) => void;
  onRequireSignIn: () => void;
}

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({
  meeting,
  defaultSpreadsheetId,
  isSignedIn,
  isSaving,
  isExecuting,
  executionError,
  onUpdateMeetingField,
  onUpdateActionItem,
  onAddActionItem,
  onDeleteActionItem,
  onCloneAsDraft,
  onRequestExecute,
  onRequireSignIn,
}) => {
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [newDecisionText, setNewDecisionText] = useState('');
  const [sheetMode, setSheetMode] = useState<'new' | 'existing'>(
    defaultSpreadsheetId ? 'existing' : 'new'
  );
  const [spreadsheetInput, setSpreadsheetInput] = useState(
    meeting.spreadsheetId || defaultSpreadsheetId || ''
  );
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(() => new Set());
  const [targets, setTargets] = useState<WorkspaceExecutionTargets>({
    sheets: true,
    calendar: true,
    gmail: true,
  });

  const isExecuted = meeting.status === 'executed';
  const selectedItems = useMemo(
    () => meeting.actionItems.filter((item) => !deselectedIds.has(item.id)),
    [meeting.actionItems, deselectedIds]
  );
  const selectedItemIds = useMemo(
    () => selectedItems.map((item) => item.id),
    [selectedItems]
  );

  const allSelected =
    meeting.actionItems.length > 0 && selectedItems.length === meeting.actionItems.length;

  const unverifiedItems = getUnverifiedLowConfidenceItems(selectedItems);
  const validationErrors = isExecuted
    ? []
    : validateActionItemsForExecution(selectedItems);

  const targetError =
    !targets.sheets && !targets.calendar && !targets.gmail
      ? 'Select at least one Google Workspace destination (Sheets, Calendar, or Gmail).'
      : null;

  const spreadsheetError =
    targets.sheets && sheetMode === 'existing' && !extractSpreadsheetId(spreadsheetInput)
      ? 'Enter a valid Google Spreadsheet ID or full Google Sheets URL.'
      : null;

  const canApproveAndExecute =
    !isExecuted &&
    !isExecuting &&
    selectedItems.length > 0 &&
    validationErrors.length === 0 &&
    !targetError &&
    !spreadsheetError;

  const handleToggleRow = (id: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (allSelected) {
      setDeselectedIds(new Set(meeting.actionItems.map((i) => i.id)));
    } else {
      setDeselectedIds(new Set());
    }
  };

  const handleAddDecision = () => {
    const trimmed = newDecisionText.trim();
    if (!trimmed || isExecuted) return;
    onUpdateMeetingField({
      keyDecisions: [...meeting.keyDecisions, trimmed],
    });
    setNewDecisionText('');
  };

  const handleRemoveDecision = (idx: number) => {
    if (isExecuted) return;
    onUpdateMeetingField({
      keyDecisions: meeting.keyDecisions.filter((_, i) => i !== idx),
    });
  };

  const handleAddNewRow = () => {
    if (isExecuted) return;
    const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const newItem: ActionItemDraft = {
      id: generateSafeId('act'),
      task: 'New follow-up action item',
      assignee: 'Unassigned',
      assigneeEmail: '',
      dueDate: due,
      priority: 'Medium',
      confidenceScore: 1.0,
      verifiedByUser: true,
      emailSubject: `Action Item: ${meeting.title}`,
      emailBody: `Hi,\n\nPlease complete this action item by ${due}.\n\n[AI-Assisted Draft • Verified by User]`,
      status: 'pending',
      sheetUpdated: false,
    };
    onAddActionItem(newItem);
  };

  const handleDownloadBrief = () => {
    const markdown = formatMeetingBriefMarkdown(meeting);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = meeting.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    a.href = url;
    a.download = `${slug || 'meeting-brief'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Extracted Meeting Action Plan"
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 space-y-6"
    >
      {/* Header & Unboxed Metadata */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="capitalize">Source: {meeting.sourceType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {selectedItems.length}/{meeting.actionItems.length} item(s) selected
            </span>
            <span aria-hidden="true">·</span>
            <span>Consent Verified: {meeting.consentVerified ? 'Yes' : 'No'}</span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-medium ${
                isExecuted ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              Status: {isExecuted ? 'Executed' : 'Pending Review'}
            </span>
            {isSaving && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">Syncing draft...</span>
              </>
            )}
          </div>

          <input
            type="text"
            aria-label="Meeting title"
            disabled={isExecuted}
            value={meeting.title}
            onChange={(e) => onUpdateMeetingField({ title: e.target.value })}
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-base sm:text-xl font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-700 focus:bg-white focus:outline-none disabled:hover:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadBrief}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Brief (.md)</span>
          </button>

          {isExecuted && (
            <button
              type="button"
              onClick={onCloneAsDraft}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Clone as New Draft</span>
            </button>
          )}

          {isExecuted && meeting.spreadsheetUrl && (
            <a
              href={meeting.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Open Google Sheet</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Summary & Decisions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="meeting-summary-input"
            className="block text-xs font-semibold text-slate-700"
          >
            Executive Summary
          </label>
          <textarea
            id="meeting-summary-input"
            rows={5}
            disabled={isExecuted}
            value={meeting.summary}
            onChange={(e) => onUpdateMeetingField({ summary: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none disabled:opacity-80"
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">
            Key Decisions ({meeting.keyDecisions.length})
          </div>
          <ul className="space-y-2">
            {meeting.keyDecisions.length === 0 && (
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                No explicit decisions recorded.
              </li>
            )}
            {meeting.keyDecisions.map((decision, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                <span className="leading-snug">{decision}</span>
                {!isExecuted && (
                  <button
                    type="button"
                    aria-label={`Remove decision ${idx + 1}`}
                    onClick={() => handleRemoveDecision(idx)}
                    className="shrink-0 text-slate-400 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!isExecuted && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                aria-label="Add a key decision"
                value={newDecisionText}
                onChange={(e) => setNewDecisionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDecision();
                  }
                }}
                placeholder="Add a finalized decision..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddDecision}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Add Decision
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ambiguities Alert */}
      {meeting.ambiguities.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Flagged Ambiguities Requiring Attention</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
            {meeting.ambiguities.map((amb, i) => (
              <li key={i}>{amb}</li>
            ))}
          </ul>
        </div>
      )}

      {/* HITL Confidence Warning Banner */}
      {!isExecuted && unverifiedItems.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              <strong>Human-in-the-Loop Gate:</strong> {unverifiedItems.length} selected action
              item(s) have an extraction confidence below{' '}
              <span className="font-mono tabular-nums">
                {CONFIDENCE_VERIFICATION_THRESHOLD.toFixed(2)}
              </span>
              . Review highlighted amber rows and click <strong>Verify</strong> to unlock execution.
            </span>
          </div>
        </div>
      )}

      {/* Editable Action Items Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Action Items & Follow-Up Drafts
          </h3>
          {!isExecuted && (
            <button
              type="button"
              onClick={handleAddNewRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Action Item</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                {!isExecuted && (
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all action items"
                      checked={allSelected}
                      onChange={handleToggleAll}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                    />
                  </th>
                )}
                <th className="px-3 py-2.5">Task</th>
                <th className="px-3 py-2.5 w-44">Assignee & Email</th>
                <th className="px-3 py-2.5 w-36">Due Date</th>
                <th className="px-3 py-2.5 w-28">Priority</th>
                <th className="px-3 py-2.5 w-32">Confidence</th>
                <th className="px-3 py-2.5 w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {meeting.actionItems.map((item, idx) => {
                const isSelected = !deselectedIds.has(item.id);
                const isLowConfidence =
                  item.confidenceScore < CONFIDENCE_VERIFICATION_THRESHOLD;
                const needsVerification = isLowConfidence && !item.verifiedByUser;
                const isEmailOpen = expandedEmailId === item.id;

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={
                        needsVerification && isSelected
                          ? 'bg-amber-50/70'
                          : !isSelected && !isExecuted
                          ? 'bg-slate-50/70 opacity-60'
                          : 'bg-white hover:bg-slate-50/60'
                      }
                    >
                      {!isExecuted && (
                        <td className="px-3 py-3 align-top text-center">
                          <input
                            type="checkbox"
                            aria-label={`Include row ${idx + 1} in execution`}
                            checked={isSelected}
                            onChange={() => handleToggleRow(item.id)}
                            className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                          />
                        </td>
                      )}

                      <td className="px-3 py-2.5 align-top">
                        <textarea
                          rows={3}
                          aria-label={`Task for row ${idx + 1}`}
                          disabled={isExecuted}
                          value={item.task}
                          onChange={(e) =>
                            onUpdateActionItem({ ...item, task: e.target.value })
                          }
                          className="w-full min-h-[68px] resize-none rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                        {isExecuted && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <FileSpreadsheet className="h-3 w-3" />
                              {item.sheetUpdated ? 'Sheet synced' : 'Sheet skipped'}
                            </span>
                            {item.calendarEventUrl && (
                              <a
                                href={item.calendarEventUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                              >
                                <Calendar className="h-3 w-3" />
                                <span>Calendar Event</span>
                              </a>
                            )}
                            {item.gmailDraftId && (
                              <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                                <Mail className="h-3 w-3" />
                                Draft #{item.gmailDraftId.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-top space-y-1.5">
                        <input
                          type="text"
                          aria-label={`Assignee name for row ${idx + 1}`}
                          disabled={isExecuted}
                          value={item.assignee}
                          onChange={(e) =>
                            onUpdateActionItem({ ...item, assignee: e.target.value })
                          }
                          placeholder="Owner name"
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                        <input
                          type="email"
                          aria-label={`Assignee email for row ${idx + 1}`}
                          disabled={isExecuted}
                          value={item.assigneeEmail}
                          onChange={(e) =>
                            onUpdateActionItem({ ...item, assigneeEmail: e.target.value })
                          }
                          placeholder="owner@company.com"
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-600 focus:border-blue-700 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="date"
                          aria-label={`Due date for row ${idx + 1}`}
                          disabled={isExecuted}
                          value={item.dueDate}
                          onChange={(e) =>
                            onUpdateActionItem({ ...item, dueDate: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs tabular-nums text-slate-800 focus:border-blue-700 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <select
                          aria-label={`Priority for row ${idx + 1}`}
                          disabled={isExecuted}
                          value={item.priority}
                          onChange={(e) =>
                            onUpdateActionItem({
                              ...item,
                              priority: e.target.value as ActionItemPriority,
                            })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-700 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <div className="space-y-1">
                          <div
                            className={`font-mono text-xs tabular-nums font-medium ${
                              needsVerification ? 'text-amber-800' : 'text-emerald-700'
                            }`}
                          >
                            {item.confidenceScore.toFixed(2)}
                            {needsVerification ? ' · Needs Review' : ' · Verified'}
                          </div>
                          {needsVerification && !isExecuted && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateActionItem({ ...item, verifiedByUser: true })
                              }
                              className="inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Verify</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEmailId(isEmailOpen ? null : item.id)
                            }
                            aria-expanded={isEmailOpen}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Mail className="h-3 w-3" />
                            <span>{isEmailOpen ? 'Hide Email' : 'Draft Email'}</span>
                          </button>
                          {!isExecuted && (
                            <button
                              type="button"
                              aria-label={`Remove action item: ${item.task}`}
                              onClick={() => onDeleteActionItem(item.id)}
                              className="rounded border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isEmailOpen && (
                      <tr className="bg-slate-50">
                        <td colSpan={isExecuted ? 6 : 7} className="px-4 py-3.5">
                          <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-slate-800">
                                Gmail Draft Preview & Editor (Drafts Folder Only)
                              </span>
                              <span>
                                Recipient:{' '}
                                <span className="font-mono text-slate-700">
                                  {item.assigneeEmail || 'Blank (fill before sending in Gmail)'}
                                </span>
                              </span>
                            </div>
                            <input
                              type="text"
                              aria-label={`Email subject for row ${idx + 1}`}
                              disabled={isExecuted}
                              value={item.emailSubject}
                              onChange={(e) =>
                                onUpdateActionItem({
                                  ...item,
                                  emailSubject: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
                            />
                            <textarea
                              rows={4}
                              aria-label={`Email body for row ${idx + 1}`}
                              disabled={isExecuted}
                              value={item.emailBody}
                              onChange={(e) =>
                                onUpdateActionItem({
                                  ...item,
                                  emailBody: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:outline-none"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Errors or Validation */}
      {(validationErrors.length > 0 || executionError || spreadsheetError || targetError) &&
        !isExecuted && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 space-y-1"
          >
            {executionError && <p className="font-medium">{executionError}</p>}
            {targetError && <p>{targetError}</p>}
            {spreadsheetError && <p>{spreadsheetError}</p>}
            {validationErrors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

      {/* Workspace Channels, Target Sheet & Approve & Execute Bar */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-slate-200 pt-5">
        <div className="flex-1 min-w-[280px] space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              Workspace Delivery Channels
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isExecuted}
                  checked={targets.sheets}
                  onChange={(e) => setTargets((t) => ({ ...t, sheets: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                />
                <span>Google Sheets</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isExecuted}
                  checked={targets.calendar}
                  onChange={(e) => setTargets((t) => ({ ...t, calendar: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                />
                <span>Google Calendar</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isExecuted}
                  checked={targets.gmail}
                  onChange={(e) => setTargets((t) => ({ ...t, gmail: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                />
                <span>Gmail Drafts</span>
              </label>
            </div>
          </div>

          {targets.sheets && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">
                Target Google Sheet Destination
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sheetMode"
                    disabled={isExecuted}
                    checked={sheetMode === 'new'}
                    onChange={() => setSheetMode('new')}
                  />
                  <span>Create New Google Sheet</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sheetMode"
                    disabled={isExecuted}
                    checked={sheetMode === 'existing'}
                    onChange={() => setSheetMode('existing')}
                  />
                  <span>Append to Existing Sheet</span>
                </label>
              </div>
              {sheetMode === 'existing' && (
                <input
                  type="text"
                  aria-label="Existing Google Spreadsheet URL or ID"
                  disabled={isExecuted}
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder="Paste Google Sheets URL or Spreadsheet ID..."
                  className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <button
              type="button"
              onClick={onRequireSignIn}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Sign in with Google to Execute</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canApproveAndExecute}
              onClick={() =>
                onRequestExecute({
                  createNewSheet: sheetMode === 'new',
                  spreadsheetInput,
                  selectedItemIds,
                  targets,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isExecuted
                  ? 'Approved & Executed'
                  : isExecuting
                  ? 'Executing...'
                  : `Approve & Execute (${selectedItems.length})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
