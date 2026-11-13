import type {
  ActionItemDraft,
  ActionItemPriority,
  AuditLogRecord,
  ExtractedMeetingPlan,
  MeetingRecord,
  MeetingStatus,
} from '../types/meeting.ts';

export const CONFIDENCE_VERIFICATION_THRESHOLD = 0.75;
export const AI_ASSISTED_FOOTER = '[AI-Assisted Draft • Verified by User]';

export const BLUEPRINT_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  dueDatePattern: /^\d{4}-\d{2}-\d{2}$/,
  idMaxLength: 128,
  titleMaxLength: 200,
  sourceLabelMaxLength: 250,
  summaryMaxLength: 10000,
  keyDecisionsMaxCount: 20,
  keyDecisionItemMaxLength: 1000,
  ambiguitiesMaxCount: 20,
  ambiguityItemMaxLength: 1000,
  actionItemsMaxCount: 100,
  taskMaxLength: 500,
  assigneeMaxLength: 160,
  assigneeEmailMaxLength: 200,
  emailSubjectMaxLength: 240,
  emailBodyMaxLength: 5000,
  spreadsheetIdMaxLength: 128,
  spreadsheetUrlMaxLength: 500,
  displayNameMaxLength: 120,
  timezoneMaxLength: 80,
  actionsSummaryMaxLength: 500,
} as const;

export function truncateStr(value: string, maxLength: number): string {
  const clean = value.trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength);
}

export function isValidFirestoreId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_LIMITS.idMaxLength &&
    BLUEPRINT_LIMITS.idPattern.test(id)
  );
}

export function generateSafeId(prefix = 'id'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'id';
  const rand =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${cleanPrefix}_${rand}`;
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].slice(0, BLUEPRINT_LIMITS.spreadsheetIdMaxLength);
  }

  if (/^[a-zA-Z0-9_-]{12,128}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function isValidIsoDate(dateStr: string): boolean {
  if (!BLUEPRINT_LIMITS.dueDatePattern.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function addDaysIso(baseIso: string, days: number): string {
  const base = isValidIsoDate(baseIso) ? baseIso : new Date().toISOString().slice(0, 10);
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function normalizeDueDate(raw: string, referenceDate?: string): string {
  const ref =
    referenceDate && isValidIsoDate(referenceDate)
      ? referenceDate
      : new Date().toISOString().slice(0, 10);

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (isValidIsoDate(trimmed)) {
      return trimmed;
    }
    const isoMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch && isValidIsoDate(isoMatch[1])) {
      return isoMatch[1];
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      const candidate = new Date(parsed).toISOString().slice(0, 10);
      if (isValidIsoDate(candidate)) return candidate;
    }
  }

  return addDaysIso(ref, 7);
}

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function normalizePriority(raw: unknown): ActionItemPriority {
  if (raw === 'High' || raw === 'Medium' || raw === 'Low') return raw;
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'high' || lower === 'urgent' || lower === 'p0' || lower === 'p1') return 'High';
    if (lower === 'low' || lower === 'p3') return 'Low';
  }
  return 'Medium';
}

export function normalizeConfidenceScore(raw: unknown): number {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0.85;
  if (num > 1 && num <= 100) return Math.round((num / 100) * 100) / 100;
  return Math.max(0, Math.min(1, Math.round(num * 100) / 100));
}

export function wrapUntrustedMeetingData(rawInput: string): string {
  const sanitized = rawInput
    .replace(/<\/?untrusted_meeting_data>/gi, '[delimiter-stripped]')
    .trim();
  return `<untrusted_meeting_data>\n${sanitized}\n</untrusted_meeting_data>`;
}

export function appendAiAssistedFooter(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes(AI_ASSISTED_FOOTER)) {
    return truncateStr(trimmed, BLUEPRINT_LIMITS.emailBodyMaxLength);
  }
  const suffix = `\n\n${AI_ASSISTED_FOOTER}`;
  const maxBodyLen = BLUEPRINT_LIMITS.emailBodyMaxLength - suffix.length;
  const safeBase = trimmed.length > maxBodyLen ? trimmed.slice(0, maxBodyLen) : trimmed;
  return `${safeBase}${suffix}`;
}

export function getUnverifiedLowConfidenceItems(items: ActionItemDraft[]): ActionItemDraft[] {
  return items.filter(
    (item) => item.confidenceScore < CONFIDENCE_VERIFICATION_THRESHOLD && !item.verifiedByUser
  );
}

function encodeMimeHeader(value: string): string {
  const singleLine = value.replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7E]*$/.test(singleLine)) {
    return singleLine;
  }
  const encoded = Buffer.from(singleLine, 'utf8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

export function buildRfc2822Base64Url(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const toHeader = params.to.replace(/[\r\n]+/g, '').trim();
  const subjectHeader = encodeMimeHeader(params.subject || 'Meeting Follow-up');
  const lines = [
    ...(toHeader ? [`To: ${toHeader}`] : []),
    `Subject: ${subjectHeader}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.body.replace(/\r?\n/g, '\r\n'),
  ];
  const rawMessage = lines.join('\r\n');
  return Buffer.from(rawMessage, 'utf8').toString('base64url');
}

export function normalizeExtractionPayload(
  raw: unknown,
  referenceDate?: string
): ExtractedMeetingPlan {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const rawTitle = typeof obj.title === 'string' && obj.title.trim() ? obj.title : 'Untitled Meeting';
  const rawSummary = typeof obj.summary === 'string' ? obj.summary : '';

  const rawDecisions = Array.isArray(obj.keyDecisions) ? obj.keyDecisions : [];
  const keyDecisions = rawDecisions
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    .slice(0, BLUEPRINT_LIMITS.keyDecisionsMaxCount)
    .map((d) => truncateStr(d, BLUEPRINT_LIMITS.keyDecisionItemMaxLength));

  const rawAmbiguities = Array.isArray(obj.ambiguities) ? obj.ambiguities : [];
  const ambiguities = rawAmbiguities
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    .slice(0, BLUEPRINT_LIMITS.ambiguitiesMaxCount)
    .map((a) => truncateStr(a, BLUEPRINT_LIMITS.ambiguityItemMaxLength));

  const rawItems = Array.isArray(obj.actionItems) ? obj.actionItems : [];
  const actionItems = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, BLUEPRINT_LIMITS.actionItemsMaxCount)
    .map((item) => {
      const task = truncateStr(
        typeof item.task === 'string' && item.task.trim() ? item.task : 'Follow up on meeting task',
        BLUEPRINT_LIMITS.taskMaxLength
      );
      const assignee = truncateStr(
        typeof item.assignee === 'string' && item.assignee.trim() ? item.assignee : 'Unassigned',
        BLUEPRINT_LIMITS.assigneeMaxLength
      );
      const assigneeEmail = truncateStr(
        typeof item.assigneeEmail === 'string' ? item.assigneeEmail : '',
        BLUEPRINT_LIMITS.assigneeEmailMaxLength
      );
      const dueDate = normalizeDueDate(
        typeof item.dueDate === 'string' ? item.dueDate : '',
        referenceDate
      );
      const priority = normalizePriority(item.priority);
      const confidenceScore = normalizeConfidenceScore(item.confidenceScore);
      const verifiedByUser = confidenceScore >= CONFIDENCE_VERIFICATION_THRESHOLD;
      const emailSubject = truncateStr(
        typeof item.emailSubject === 'string' && item.emailSubject.trim()
          ? item.emailSubject
          : `Action Item: ${task.slice(0, 80)}`,
        BLUEPRINT_LIMITS.emailSubjectMaxLength
      );
      const baseEmailBody =
        typeof item.emailBody === 'string' && item.emailBody.trim()
          ? item.emailBody
          : `Hi ${assignee},\n\nFollowing up on our meeting, please complete the following action item by ${dueDate}:\n\n- ${task}\n\nBest regards,`;

      const emailBody = appendAiAssistedFooter(baseEmailBody);

      return {
        task,
        assignee,
        assigneeEmail,
        dueDate,
        priority,
        confidenceScore,
        verifiedByUser,
        emailSubject,
        emailBody,
      };
    });

  return {
    title: truncateStr(rawTitle, BLUEPRINT_LIMITS.titleMaxLength),
    summary: truncateStr(rawSummary, BLUEPRINT_LIMITS.summaryMaxLength),
    keyDecisions,
    ambiguities,
    actionItems,
  };
}

export function sanitizeMeetingForBlueprint(input: {
  id: string;
  ownerId: string;
  title: string;
  sourceType: 'audio' | 'image' | 'text';
  sourceLabel: string;
  consentVerified: boolean;
  summary: string;
  keyDecisions: string[];
  ambiguities: string[];
  status: MeetingStatus;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  actionItemCount: number;
}) {
  return {
    id: truncateStr(input.id, BLUEPRINT_LIMITS.idMaxLength),
    ownerId: truncateStr(input.ownerId, BLUEPRINT_LIMITS.idMaxLength),
    title: truncateStr(input.title || 'Untitled Meeting', BLUEPRINT_LIMITS.titleMaxLength),
    sourceType: input.sourceType,
    sourceLabel: truncateStr(input.sourceLabel || 'Manual input', BLUEPRINT_LIMITS.sourceLabelMaxLength),
    consentVerified: Boolean(input.consentVerified),
    summary: truncateStr(input.summary || '', BLUEPRINT_LIMITS.summaryMaxLength),
    keyDecisions: input.keyDecisions
      .filter((d) => d.trim().length > 0)
      .slice(0, BLUEPRINT_LIMITS.keyDecisionsMaxCount)
      .map((d) => truncateStr(d, BLUEPRINT_LIMITS.keyDecisionItemMaxLength)),
    ambiguities: input.ambiguities
      .filter((a) => a.trim().length > 0)
      .slice(0, BLUEPRINT_LIMITS.ambiguitiesMaxCount)
      .map((a) => truncateStr(a, BLUEPRINT_LIMITS.ambiguityItemMaxLength)),
    status: input.status,
    ...(input.spreadsheetId
      ? { spreadsheetId: truncateStr(input.spreadsheetId, BLUEPRINT_LIMITS.spreadsheetIdMaxLength) }
      : {}),
    ...(input.spreadsheetUrl
      ? { spreadsheetUrl: truncateStr(input.spreadsheetUrl, BLUEPRINT_LIMITS.spreadsheetUrlMaxLength) }
      : {}),
    actionItemCount: Math.max(0, Math.min(BLUEPRINT_LIMITS.actionItemsMaxCount, Math.floor(input.actionItemCount))),
  };
}

export function sanitizeActionItemForBlueprint(input: {
  id: string;
  meetingId: string;
  ownerId: string;
  item: ActionItemDraft;
}) {
  return {
    id: truncateStr(input.id, BLUEPRINT_LIMITS.idMaxLength),
    meetingId: truncateStr(input.meetingId, BLUEPRINT_LIMITS.idMaxLength),
    ownerId: truncateStr(input.ownerId, BLUEPRINT_LIMITS.idMaxLength),
    task: truncateStr(input.item.task || 'Follow up', BLUEPRINT_LIMITS.taskMaxLength),
    assignee: truncateStr(input.item.assignee || 'Unassigned', BLUEPRINT_LIMITS.assigneeMaxLength),
    assigneeEmail: truncateStr(input.item.assigneeEmail || '', BLUEPRINT_LIMITS.assigneeEmailMaxLength),
    dueDate: normalizeDueDate(input.item.dueDate),
    priority: normalizePriority(input.item.priority),
    confidenceScore: normalizeConfidenceScore(input.item.confidenceScore),
    verifiedByUser: Boolean(input.item.verifiedByUser),
    emailSubject: truncateStr(input.item.emailSubject || 'Follow-up', BLUEPRINT_LIMITS.emailSubjectMaxLength),
    emailBody: truncateStr(input.item.emailBody || '', BLUEPRINT_LIMITS.emailBodyMaxLength),
    status: input.item.status,
    ...(input.item.calendarEventUrl
      ? { calendarEventUrl: truncateStr(input.item.calendarEventUrl, BLUEPRINT_LIMITS.spreadsheetUrlMaxLength) }
      : {}),
    ...(input.item.gmailDraftId
      ? { gmailDraftId: truncateStr(input.item.gmailDraftId, BLUEPRINT_LIMITS.idMaxLength) }
      : {}),
    sheetUpdated: Boolean(input.item.sheetUpdated),
  };
}

export function sanitizeAuditLogForBlueprint(input: Omit<AuditLogRecord, 'createdAtMs'>) {
  return {
    id: truncateStr(input.id, BLUEPRINT_LIMITS.idMaxLength),
    userId: truncateStr(input.userId, BLUEPRINT_LIMITS.idMaxLength),
    meetingId: truncateStr(input.meetingId, BLUEPRINT_LIMITS.idMaxLength),
    meetingTitle: truncateStr(input.meetingTitle || 'Untitled Meeting', BLUEPRINT_LIMITS.titleMaxLength),
    consentVerified: Boolean(input.consentVerified),
    humanReviewer: truncateStr(input.humanReviewer || 'Verified User', BLUEPRINT_LIMITS.assigneeEmailMaxLength),
    actionsSummary: truncateStr(input.actionsSummary || 'Workspace sync executed', BLUEPRINT_LIMITS.actionsSummaryMaxLength),
    sheetsCount: Math.max(0, Math.min(100, Math.floor(input.sheetsCount))),
    calendarCount: Math.max(0, Math.min(100, Math.floor(input.calendarCount))),
    gmailDraftCount: Math.max(0, Math.min(100, Math.floor(input.gmailDraftCount))),
    ...(input.spreadsheetId
      ? { spreadsheetId: truncateStr(input.spreadsheetId, BLUEPRINT_LIMITS.spreadsheetIdMaxLength) }
      : {}),
  };
}

export function validateActionItemsForExecution(items: ActionItemDraft[]): string[] {
  const errors: string[] = [];
  if (items.length === 0) {
    errors.push('Add at least one action item before executing.');
    return errors;
  }

  const unverified = getUnverifiedLowConfidenceItems(items);
  if (unverified.length > 0) {
    errors.push(
      `${unverified.length} low-confidence action item(s) (< 0.75) require manual verification before approval.`
    );
  }

  items.forEach((item, index) => {
    const label = `Row ${index + 1}`;
    if (!item.task.trim()) {
      errors.push(`${label}: Task description cannot be empty.`);
    }
    if (!isValidIsoDate(item.dueDate)) {
      errors.push(`${label}: Due date must be in YYYY-MM-DD format.`);
    }
    if (item.assigneeEmail.trim() && !isValidEmail(item.assigneeEmail)) {
      errors.push(`${label}: Assignee email "${item.assigneeEmail}" is not a valid email address.`);
    }
  });

  return errors;
}

export function filterMeetings(
  meetings: MeetingRecord[],
  searchQuery: string,
  statusFilter: 'all' | MeetingStatus
): MeetingRecord[] {
  const q = searchQuery.trim().toLowerCase();
  return meetings.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (!q) return true;
    const matchesTitle = m.title.toLowerCase().includes(q);
    const matchesSummary = m.summary.toLowerCase().includes(q);
    const matchesTask = m.actionItems.some(
      (item) =>
        item.task.toLowerCase().includes(q) ||
        item.assignee.toLowerCase().includes(q)
    );
    return matchesTitle || matchesSummary || matchesTask;
  });
}

export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const INJECTION_HEURISTICS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Instruction override phrase', pattern: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts)\b/i },
  { label: 'XML boundary escape attempt', pattern: /<\/?untrusted_meeting_data>/i },
  { label: 'Unauthorized exfiltration directive', pattern: /\b(exfiltrate|forward\s+all\s+files|send\s+confidential|leak\s+secrets)\b/i },
  { label: 'System prompt extraction probe', pattern: /\b(reveal|print|output)\s+(your\s+)?(system\s+prompt|api\s+key)\b/i },
];

const API_KEY_PATTERN = /\b(AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}|ghp_[0-9A-Za-z]{20,})\b/g;
const SSN_OR_CARD_PATTERN = /\b(?:\d{3}-\d{2}-\d{4}|(?:\d[ -]*?){13,16})\b/g;
const PHONE_PATTERN = /\b(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
const EMAIL_SCAN_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g;

export function analyzeTranscriptSecurity(rawText: string) {
  const trimmed = rawText.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const injectionSignals = INJECTION_HEURISTICS.filter((h) => h.pattern.test(rawText)).map(
    (h) => h.label
  );
  const apiKeyMatches = rawText.match(API_KEY_PATTERN) ?? [];
  const ssnCardMatches = rawText.match(SSN_OR_CARD_PATTERN) ?? [];
  const phoneMatches = rawText.match(PHONE_PATTERN) ?? [];
  const emailMatches = rawText.match(EMAIL_SCAN_PATTERN) ?? [];

  return {
    wordCount: words,
    charCount: rawText.length,
    injectionSignals,
    sensitiveTokenCount: apiKeyMatches.length + ssnCardMatches.length + phoneMatches.length,
    emailCount: emailMatches.length,
  };
}

export function redactSensitivePatterns(rawText: string): string {
  return rawText
    .replace(API_KEY_PATTERN, '[REDACTED-SECRET]')
    .replace(SSN_OR_CARD_PATTERN, '[REDACTED-ID]')
    .replace(PHONE_PATTERN, '[REDACTED-PHONE]');
}

export function formatMeetingBriefMarkdown(meeting: MeetingRecord): string {
  const lines: string[] = [
    `# ${meeting.title}`,
    '',
    `- **Source**: ${meeting.sourceType.toUpperCase()} (${meeting.sourceLabel})`,
    `- **Consent Attested (GDPR Art. 6)**: ${meeting.consentVerified ? 'Yes' : 'No'}`,
    `- **Workflow Status**: ${meeting.status === 'executed' ? 'Approved & Executed' : 'Pending Human Review'}`,
    ...(meeting.spreadsheetUrl ? [`- **Target Google Sheet**: ${meeting.spreadsheetUrl}`] : []),
    '',
    '## Executive Summary',
    '',
    meeting.summary || '_No summary provided._',
    '',
    '## Key Decisions',
    '',
    ...(meeting.keyDecisions.length > 0
      ? meeting.keyDecisions.map((d) => `- ${d}`)
      : ['_No explicit decisions recorded._']),
  ];

  if (meeting.ambiguities.length > 0) {
    lines.push('', '## Flagged Ambiguities', '', ...meeting.ambiguities.map((a) => `- ${a}`));
  }

  lines.push(
    '',
    '## Action Items',
    '',
    '| Task | Assignee | Email | Due Date | Priority | Confidence | Verified |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
    ...meeting.actionItems.map((item) => {
      const safeTask = item.task.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      const safeAssignee = item.assignee.replace(/\|/g, '\\|');
      return `| ${safeTask} | ${safeAssignee} | ${item.assigneeEmail || '—'} | ${item.dueDate} | ${item.priority} | ${item.confidenceScore.toFixed(2)} | ${item.verifiedByUser ? 'Yes' : 'No'} |`;
    }),
    '',
    '---',
    '_Generated by Cadence • Engineered & Architected by Md Shabbir Mia_'
  );

  return lines.join('\n');
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatAuditLogsCsv(logs: AuditLogRecord[]): string {
  const header = [
    'Timestamp UTC',
    'Audit ID',
    'Meeting ID',
    'Meeting Title',
    'Consent Verified',
    'Human Reviewer',
    'Sheets Rows',
    'Calendar Events',
    'Gmail Drafts',
    'Spreadsheet ID',
    'Actions Summary',
  ].join(',');

  const rows = logs.map((log) =>
    [
      escapeCsvCell(new Date(log.createdAtMs).toISOString()),
      escapeCsvCell(log.id),
      escapeCsvCell(log.meetingId),
      escapeCsvCell(log.meetingTitle),
      escapeCsvCell(log.consentVerified ? 'Yes' : 'No'),
      escapeCsvCell(log.humanReviewer),
      escapeCsvCell(log.sheetsCount),
      escapeCsvCell(log.calendarCount),
      escapeCsvCell(log.gmailDraftCount),
      escapeCsvCell(log.spreadsheetId || ''),
      escapeCsvCell(log.actionsSummary),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
