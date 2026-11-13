export type SourceType = 'audio' | 'image' | 'text';

export type MeetingStatus = 'draft' | 'executed';

export type ActionItemStatus = 'pending' | 'executed' | 'failed';

export type ActionItemPriority = 'High' | 'Medium' | 'Low';

export interface ActionItemDraft {
  id: string;
  task: string;
  assignee: string;
  assigneeEmail: string;
  dueDate: string; // YYYY-MM-DD
  priority: ActionItemPriority;
  confidenceScore: number; // 0.0 - 1.0
  verifiedByUser: boolean;
  emailSubject: string;
  emailBody: string;
  status: ActionItemStatus;
  calendarEventUrl?: string;
  gmailDraftId?: string;
  sheetUpdated: boolean;
  errorMessage?: string;
}

export interface ExtractedMeetingPlan {
  title: string;
  summary: string;
  keyDecisions: string[];
  ambiguities: string[];
  actionItems: Omit<ActionItemDraft, 'id' | 'status' | 'sheetUpdated'>[];
}

export interface MeetingRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceType: SourceType;
  sourceLabel: string;
  consentVerified: boolean;
  summary: string;
  keyDecisions: string[];
  ambiguities: string[];
  status: MeetingStatus;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  actionItemCount: number;
  createdAtMs: number;
  updatedAtMs: number;
  executedAtMs?: number;
  actionItems: ActionItemDraft[];
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  meetingId: string;
  meetingTitle: string;
  consentVerified: boolean;
  humanReviewer: string;
  actionsSummary: string;
  sheetsCount: number;
  calendarCount: number;
  gmailDraftCount: number;
  spreadsheetId?: string;
  createdAtMs: number;
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  defaultSpreadsheetId?: string;
  defaultSpreadsheetName?: string;
  timezone: string;
}

export interface WorkspaceExecutionTargets {
  sheets: boolean;
  calendar: boolean;
  gmail: boolean;
}

export interface WorkspaceExecutionItemResult {
  id: string;
  sheetUpdated: boolean;
  calendarEventUrl?: string;
  gmailDraftId?: string;
  status: 'executed' | 'failed';
  error?: string;
}

export interface WorkspaceExecutionResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  results: WorkspaceExecutionItemResult[];
}

export interface TranscriptSecurityScan {
  wordCount: number;
  charCount: number;
  injectionSignals: string[];
  sensitiveTokenCount: number;
  emailCount: number;
}
