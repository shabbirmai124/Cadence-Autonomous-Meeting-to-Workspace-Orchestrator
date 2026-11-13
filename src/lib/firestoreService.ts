import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  generateSafeId,
  sanitizeActionItemForBlueprint,
  sanitizeAuditLogForBlueprint,
  sanitizeMeetingForBlueprint,
  truncateStr,
  BLUEPRINT_LIMITS,
} from '../utils/meetingLogic';
import type {
  ActionItemDraft,
  AuditLogRecord,
  MeetingRecord,
  SourceType,
  UserProfileRecord,
  WorkspaceExecutionResponse,
} from '../types/meeting';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function timestampToMs(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts) {
    return (ts as Timestamp).toMillis();
  }
  return Date.now();
}

export async function ensureUserProfile(user: User): Promise<UserProfileRecord> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const detectedTz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: user.uid,
        displayName: String(data.displayName || user.displayName || 'Workspace User'),
        email: String(data.email || user.email || ''),
        defaultSpreadsheetId: data.defaultSpreadsheetId
          ? String(data.defaultSpreadsheetId)
          : undefined,
        defaultSpreadsheetName: data.defaultSpreadsheetName
          ? String(data.defaultSpreadsheetName)
          : undefined,
        timezone: String(data.timezone || detectedTz),
      };
    }

    const payload = {
      uid: truncateStr(user.uid, BLUEPRINT_LIMITS.idMaxLength),
      displayName: truncateStr(
        user.displayName || user.email || 'Workspace User',
        BLUEPRINT_LIMITS.displayNameMaxLength
      ),
      email: truncateStr(user.email || '', BLUEPRINT_LIMITS.assigneeEmailMaxLength),
      timezone: truncateStr(detectedTz, BLUEPRINT_LIMITS.timezoneMaxLength),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return {
      uid: payload.uid,
      displayName: payload.displayName,
      email: payload.email,
      timezone: payload.timezone,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserPreferences(
  uid: string,
  updates: {
    displayName: string;
    email: string;
    defaultSpreadsheetId?: string;
    defaultSpreadsheetName?: string;
    timezone: string;
  }
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      displayName: truncateStr(updates.displayName, BLUEPRINT_LIMITS.displayNameMaxLength),
      email: truncateStr(updates.email, BLUEPRINT_LIMITS.assigneeEmailMaxLength),
      defaultSpreadsheetId: truncateStr(
        updates.defaultSpreadsheetId || '',
        BLUEPRINT_LIMITS.spreadsheetIdMaxLength
      ),
      defaultSpreadsheetName: truncateStr(
        updates.defaultSpreadsheetName || '',
        BLUEPRINT_LIMITS.titleMaxLength
      ),
      timezone: truncateStr(updates.timezone || 'UTC', BLUEPRINT_LIMITS.timezoneMaxLength),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function createMeetingWithItems(params: {
  ownerId: string;
  title: string;
  sourceType: SourceType;
  sourceLabel: string;
  consentVerified: boolean;
  summary: string;
  keyDecisions: string[];
  ambiguities: string[];
  actionItems: ActionItemDraft[];
}): Promise<MeetingRecord> {
  const meetingId = generateSafeId('mtg');
  const meetingPath = `meetings/${meetingId}`;

  try {
    const batch = writeBatch(db);
    const meetingRef = doc(db, 'meetings', meetingId);

    const sanitizedMeeting = sanitizeMeetingForBlueprint({
      id: meetingId,
      ownerId: params.ownerId,
      title: params.title,
      sourceType: params.sourceType,
      sourceLabel: params.sourceLabel,
      consentVerified: params.consentVerified,
      summary: params.summary,
      keyDecisions: params.keyDecisions,
      ambiguities: params.ambiguities,
      status: 'draft',
      actionItemCount: params.actionItems.length,
    });

    batch.set(meetingRef, {
      ...sanitizedMeeting,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const normalizedItems: ActionItemDraft[] = params.actionItems.map((item) => {
      const itemId = item.id || generateSafeId('act');
      const sanitizedItem = sanitizeActionItemForBlueprint({
        id: itemId,
        meetingId,
        ownerId: params.ownerId,
        item: { ...item, id: itemId, status: 'pending', sheetUpdated: false },
      });

      const itemRef = doc(db, 'meetings', meetingId, 'actionItems', itemId);
      batch.set(itemRef, {
        ...sanitizedItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        ...item,
        id: itemId,
        status: 'pending',
        sheetUpdated: false,
      };
    });

    await batch.commit();

    const now = Date.now();
    return {
      ...sanitizedMeeting,
      createdAtMs: now,
      updatedAtMs: now,
      actionItems: normalizedItems,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, meetingPath);
  }
}

export async function updateDraftMeetingMetadata(params: {
  ownerId: string;
  meetingId: string;
  title: string;
  summary: string;
  keyDecisions: string[];
  ambiguities: string[];
  actionItemCount: number;
}): Promise<void> {
  const path = `meetings/${params.meetingId}`;
  try {
    const ref = doc(db, 'meetings', params.meetingId);
    await updateDoc(ref, {
      title: truncateStr(params.title || 'Untitled Meeting', BLUEPRINT_LIMITS.titleMaxLength),
      summary: truncateStr(params.summary || '', BLUEPRINT_LIMITS.summaryMaxLength),
      keyDecisions: params.keyDecisions
        .filter((d) => d.trim().length > 0)
        .slice(0, BLUEPRINT_LIMITS.keyDecisionsMaxCount)
        .map((d) => truncateStr(d, BLUEPRINT_LIMITS.keyDecisionItemMaxLength)),
      ambiguities: params.ambiguities
        .filter((a) => a.trim().length > 0)
        .slice(0, BLUEPRINT_LIMITS.ambiguitiesMaxCount)
        .map((a) => truncateStr(a, BLUEPRINT_LIMITS.ambiguityItemMaxLength)),
      actionItemCount: Math.max(0, Math.min(100, params.actionItemCount)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateDraftActionItem(params: {
  ownerId: string;
  meetingId: string;
  item: ActionItemDraft;
}): Promise<void> {
  const path = `meetings/${params.meetingId}/actionItems/${params.item.id}`;
  try {
    const ref = doc(db, 'meetings', params.meetingId, 'actionItems', params.item.id);
    const sanitized = sanitizeActionItemForBlueprint({
      id: params.item.id,
      meetingId: params.meetingId,
      ownerId: params.ownerId,
      item: params.item,
    });
    await updateDoc(ref, {
      task: sanitized.task,
      assignee: sanitized.assignee,
      assigneeEmail: sanitized.assigneeEmail,
      dueDate: sanitized.dueDate,
      priority: sanitized.priority,
      confidenceScore: sanitized.confidenceScore,
      verifiedByUser: sanitized.verifiedByUser,
      emailSubject: sanitized.emailSubject,
      emailBody: sanitized.emailBody,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createDraftActionItem(params: {
  ownerId: string;
  meetingId: string;
  item: ActionItemDraft;
}): Promise<void> {
  const path = `meetings/${params.meetingId}/actionItems/${params.item.id}`;
  try {
    const ref = doc(db, 'meetings', params.meetingId, 'actionItems', params.item.id);
    const sanitized = sanitizeActionItemForBlueprint({
      id: params.item.id,
      meetingId: params.meetingId,
      ownerId: params.ownerId,
      item: { ...params.item, status: 'pending', sheetUpdated: false },
    });
    await setDoc(ref, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDraftActionItem(params: {
  meetingId: string;
  itemId: string;
}): Promise<void> {
  const path = `meetings/${params.meetingId}/actionItems/${params.itemId}`;
  try {
    await deleteDoc(doc(db, 'meetings', params.meetingId, 'actionItems', params.itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordExecutionAndAuditLog(params: {
  ownerId: string;
  humanReviewer: string;
  meeting: MeetingRecord;
  execution: WorkspaceExecutionResponse;
}): Promise<void> {
  const path = `meetings/${params.meeting.id}`;
  try {
    const batch = writeBatch(db);

    let sheetsCount = 0;
    let calendarCount = 0;
    let gmailDraftCount = 0;

    for (const res of params.execution.results) {
      if (res.sheetUpdated) sheetsCount += 1;
      if (res.calendarEventUrl) calendarCount += 1;
      if (res.gmailDraftId) gmailDraftCount += 1;

      const itemRef = doc(db, 'meetings', params.meeting.id, 'actionItems', res.id);
      batch.update(itemRef, {
        status: res.status,
        sheetUpdated: res.sheetUpdated,
        verifiedByUser: true,
        ...(res.calendarEventUrl
          ? { calendarEventUrl: truncateStr(res.calendarEventUrl, BLUEPRINT_LIMITS.spreadsheetUrlMaxLength) }
          : {}),
        ...(res.gmailDraftId
          ? { gmailDraftId: truncateStr(res.gmailDraftId, BLUEPRINT_LIMITS.idMaxLength) }
          : {}),
        updatedAt: serverTimestamp(),
      });
    }

    const meetingRef = doc(db, 'meetings', params.meeting.id);
    batch.update(meetingRef, {
      status: 'executed',
      spreadsheetId: truncateStr(params.execution.spreadsheetId, BLUEPRINT_LIMITS.spreadsheetIdMaxLength),
      spreadsheetUrl: truncateStr(params.execution.spreadsheetUrl, BLUEPRINT_LIMITS.spreadsheetUrlMaxLength),
      executedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const logId = generateSafeId('log');
    const logRef = doc(db, 'audit_logs', logId);
    const sanitizedLog = sanitizeAuditLogForBlueprint({
      id: logId,
      userId: params.ownerId,
      meetingId: params.meeting.id,
      meetingTitle: params.meeting.title,
      consentVerified: params.meeting.consentVerified,
      humanReviewer: params.humanReviewer,
      actionsSummary: `Sheets: ${sheetsCount} rows · Calendar: ${calendarCount} events · Gmail: ${gmailDraftCount} drafts`,
      sheetsCount,
      calendarCount,
      gmailDraftCount,
      spreadsheetId: params.execution.spreadsheetId,
    });

    batch.set(logRef, {
      ...sanitizedLog,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchMeetingActionItems(
  uid: string,
  meetingId: string
): Promise<ActionItemDraft[]> {
  const path = `meetings/${meetingId}/actionItems`;
  try {
    const q = query(
      collection(db, 'meetings', meetingId, 'actionItems'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        task: String(data.task || ''),
        assignee: String(data.assignee || 'Unassigned'),
        assigneeEmail: String(data.assigneeEmail || ''),
        dueDate: String(data.dueDate || ''),
        priority: (data.priority as ActionItemDraft['priority']) || 'Medium',
        confidenceScore: Number(data.confidenceScore ?? 0.85),
        verifiedByUser: Boolean(data.verifiedByUser ?? true),
        emailSubject: String(data.emailSubject || ''),
        emailBody: String(data.emailBody || ''),
        status: (data.status as ActionItemDraft['status']) || 'pending',
        calendarEventUrl: data.calendarEventUrl ? String(data.calendarEventUrl) : undefined,
        gmailDraftId: data.gmailDraftId ? String(data.gmailDraftId) : undefined,
        sheetUpdated: Boolean(data.sheetUpdated),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeUserMeetings(
  uid: string,
  onData: (meetings: MeetingRecord[]) => void,
  onError: (err: Error) => void
) {
  const path = 'meetings';
  const q = query(collection(db, 'meetings'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    async (snapshot) => {
      try {
        const records = await Promise.all(
          snapshot.docs.map(async (d) => {
            const data = d.data();
            const actionItems = await fetchMeetingActionItems(uid, d.id);
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || uid),
              title: String(data.title || 'Untitled Meeting'),
              sourceType: (data.sourceType as SourceType) || 'text',
              sourceLabel: String(data.sourceLabel || ''),
              consentVerified: Boolean(data.consentVerified ?? true),
              summary: String(data.summary || ''),
              keyDecisions: Array.isArray(data.keyDecisions)
                ? data.keyDecisions.map(String)
                : [],
              ambiguities: Array.isArray(data.ambiguities)
                ? data.ambiguities.map(String)
                : [],
              status: (data.status as MeetingRecord['status']) || 'draft',
              spreadsheetId: data.spreadsheetId ? String(data.spreadsheetId) : undefined,
              spreadsheetUrl: data.spreadsheetUrl ? String(data.spreadsheetUrl) : undefined,
              actionItemCount: Number(data.actionItemCount ?? actionItems.length),
              createdAtMs: timestampToMs(data.createdAt),
              updatedAtMs: timestampToMs(data.updatedAt),
              executedAtMs: data.executedAt ? timestampToMs(data.executedAt) : undefined,
              actionItems,
            } satisfies MeetingRecord;
          })
        );
        records.sort((a, b) => b.createdAtMs - a.createdAtMs);
        onData(records);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeUserAuditLogs(
  uid: string,
  onData: (logs: AuditLogRecord[]) => void,
  onError: (err: Error) => void
) {
  const path = 'audit_logs';
  const q = query(collection(db, 'audit_logs'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLogRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || uid),
          meetingId: String(data.meetingId || ''),
          meetingTitle: String(data.meetingTitle || ''),
          consentVerified: Boolean(data.consentVerified),
          humanReviewer: String(data.humanReviewer || ''),
          actionsSummary: String(data.actionsSummary || ''),
          sheetsCount: Number(data.sheetsCount ?? 0),
          calendarCount: Number(data.calendarCount ?? 0),
          gmailDraftCount: Number(data.gmailDraftCount ?? 0),
          spreadsheetId: data.spreadsheetId ? String(data.spreadsheetId) : undefined,
          createdAtMs: timestampToMs(data.createdAt),
        };
      });
      logs.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(logs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function deleteMeetingRecord(
  uid: string,
  meetingId: string
): Promise<void> {
  const path = `meetings/${meetingId}`;
  try {
    const items = await fetchMeetingActionItems(uid, meetingId);
    const batch = writeBatch(db);
    for (const item of items) {
      batch.delete(doc(db, 'meetings', meetingId, 'actionItems', item.id));
    }
    batch.delete(doc(db, 'meetings', meetingId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function purgeAllUserData(uid: string): Promise<number> {
  const path = `users/${uid}`;
  try {
    const q = query(collection(db, 'meetings'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    let deletedMeetings = 0;

    for (const mDoc of snap.docs) {
      await deleteMeetingRecord(uid, mDoc.id);
      deletedMeetings += 1;
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    }

    return deletedMeetings;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
