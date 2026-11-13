import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  FileCheck2,
  History,
  Info,
  Layers,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/firebase';
import {
  createDraftActionItem,
  createMeetingWithItems,
  deleteDraftActionItem,
  deleteMeetingRecord,
  ensureUserProfile,
  purgeAllUserData,
  recordExecutionAndAuditLog,
  subscribeUserAuditLogs,
  subscribeUserMeetings,
  updateDraftActionItem,
  updateDraftMeetingMetadata,
  updateUserPreferences,
} from './lib/firestoreService';
import { appendAiAssistedFooter, generateSafeId } from './utils/meetingLogic';
import { UploadZone } from './components/UploadZone';
import { ReviewDashboard } from './components/ReviewDashboard';
import { HistoryView } from './components/HistoryView';
import { ComplianceView } from './components/ComplianceView';
import { SettingsView } from './components/SettingsView';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import {
  AboutDeveloperModal,
  DangerConfirmModal,
  ExecuteConfirmModal,
  PrivacyPolicyModal,
} from './components/Modals';
import type {
  ActionItemDraft,
  AuditLogRecord,
  ExtractedMeetingPlan,
  MeetingRecord,
  SourceType,
  UserProfileRecord,
  WorkspaceExecutionResponse,
  WorkspaceExecutionTargets,
} from './types/meeting';

type ActiveView = 'workbench' | 'history' | 'compliance' | 'settings';

function CadenceBrandMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#1D4ED8" />
      <path
        d="M7 14.5V9.5M12 16.5V7.5M17 13.5V10.5"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('workbench');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [consentVerified, setConsentVerified] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<MeetingRecord | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [zeroRetentionNotice, setZeroRetentionNotice] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [pendingExecuteOpts, setPendingExecuteOpts] = useState<{
    createNewSheet: boolean;
    spreadsheetInput: string;
    selectedItemIds: string[];
    targets: WorkspaceExecutionTargets;
  }>({
    createNewSheet: true,
    spreadsheetInput: '',
    selectedItemIds: [],
    targets: { sheets: true, calendar: true, gmail: true },
  });

  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [aboutDevModalOpen, setAboutDevModalOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingRecord | null>(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [isDangerBusy, setIsDangerBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = initAuth(async (user, token) => {
      setAuthUser(user);
      setWorkspaceToken(token || getAccessToken());
      if (user) {
        try {
          const profile = await ensureUserProfile(user);
          setUserProfile(profile);
        } catch (err) {
          console.error('Failed to ensure profile:', err);
        }
      } else {
        setUserProfile(null);
        setMeetings([]);
        setAuditLogs([]);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscriptions when signed in
  useEffect(() => {
    if (!authUser) return;
    setMeetingsLoading(true);
    setAuditLoading(true);

    const unsubMeetings = subscribeUserMeetings(
      authUser.uid,
      (records) => {
        setMeetings(records);
        setMeetingsLoading(false);
      },
      (err) => {
        console.error('Meetings listener error:', err);
        setMeetingsLoading(false);
      }
    );

    const unsubAudit = subscribeUserAuditLogs(
      authUser.uid,
      (logs) => {
        setAuditLogs(logs);
        setAuditLoading(false);
      },
      (err) => {
        console.error('Audit logs listener error:', err);
        setAuditLoading(false);
      }
    );

    return () => {
      unsubMeetings();
      unsubAudit();
    };
  }, [authUser]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const { user, accessToken } = await googleSignIn();
      setAuthUser(user);
      setWorkspaceToken(accessToken);
      const profile = await ensureUserProfile(user);
      setUserProfile(profile);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.'
      );
    }
  };

  const handleSignOut = async () => {
    await logout();
    setAuthUser(null);
    setWorkspaceToken(null);
    setUserProfile(null);
  };

  const persistExtractedPlan = async (
    plan: ExtractedMeetingPlan,
    sourceLabel: string,
    sourceType: SourceType
  ) => {
    const itemsWithIds: ActionItemDraft[] = plan.actionItems.map((item) => ({
      ...item,
      id: generateSafeId('act'),
      emailBody: appendAiAssistedFooter(item.emailBody),
      status: 'pending',
      sheetUpdated: false,
    }));

    if (authUser) {
      const saved = await createMeetingWithItems({
        ownerId: authUser.uid,
        title: plan.title,
        sourceType,
        sourceLabel,
        consentVerified: true,
        summary: plan.summary,
        keyDecisions: plan.keyDecisions,
        ambiguities: plan.ambiguities,
        actionItems: itemsWithIds,
      });
      setCurrentMeeting(saved);
    } else {
      const now = Date.now();
      const localRecord: MeetingRecord = {
        id: generateSafeId('mtg'),
        ownerId: 'local_preview',
        title: plan.title,
        sourceType,
        sourceLabel,
        consentVerified: true,
        summary: plan.summary,
        keyDecisions: plan.keyDecisions,
        ambiguities: plan.ambiguities,
        status: 'draft',
        actionItemCount: itemsWithIds.length,
        createdAtMs: now,
        updatedAtMs: now,
        actionItems: itemsWithIds,
      };
      setCurrentMeeting(localRecord);
      setMeetings((prev) => [localRecord, ...prev]);
    }
  };

  const handleExtractText = async (textContent: string, sourceLabel: string) => {
    setExtractError(null);
    setZeroRetentionNotice(null);
    setIsExtracting(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'text',
          textContent,
          consentVerified,
          referenceDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = (await res.json()) as {
        plan?: ExtractedMeetingPlan;
        error?: string;
      };
      if (!res.ok || !data.plan) {
        throw new Error(data.error || 'Failed to extract action plan.');
      }
      await persistExtractedPlan(data.plan, sourceLabel, 'text');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractMedia = async (params: {
    mode: 'audio' | 'image';
    base64: string;
    mimeType: string;
    fileName: string;
  }) => {
    setExtractError(null);
    setZeroRetentionNotice(null);
    setIsExtracting(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: params.mode,
          fileBase64: params.base64,
          mimeType: params.mimeType,
          fileName: params.fileName,
          consentVerified,
          referenceDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = (await res.json()) as {
        plan?: ExtractedMeetingPlan;
        zeroRetentionPurged?: boolean;
        error?: string;
      };
      if (!res.ok || !data.plan) {
        throw new Error(data.error || 'Failed to extract media action plan.');
      }
      await persistExtractedPlan(data.plan, params.fileName, params.mode);
      if (data.zeroRetentionPurged) {
        setZeroRetentionNotice(
          `Zero-Retention Auto-Purge complete: transient ${params.mode} buffer (${params.fileName}) was discarded immediately after extraction.`
        );
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Media extraction failed.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLoadSamplePlan = async (
    plan: ExtractedMeetingPlan,
    sourceLabel: string,
    sourceType: SourceType
  ) => {
    setExtractError(null);
    setZeroRetentionNotice(null);
    await persistExtractedPlan(plan, sourceLabel, sourceType);
  };

  const handleCloneAsDraft = async () => {
    if (!currentMeeting) return;
    await persistExtractedPlan(
      {
        title: `${currentMeeting.title} (Follow-Up)`,
        summary: currentMeeting.summary,
        keyDecisions: currentMeeting.keyDecisions,
        ambiguities: currentMeeting.ambiguities,
        actionItems: currentMeeting.actionItems.map((item) => ({
          task: item.task,
          assignee: item.assignee,
          assigneeEmail: item.assigneeEmail,
          dueDate: item.dueDate,
          priority: item.priority,
          confidenceScore: item.confidenceScore,
          verifiedByUser: item.verifiedByUser,
          emailSubject: item.emailSubject,
          emailBody: item.emailBody,
        })),
      },
      `${currentMeeting.sourceLabel} (Cloned)`,
      currentMeeting.sourceType
    );
    setStatusBanner('Created an editable follow-up draft from the executed meeting record.');
  };

  const handleUpdateMeetingField = async (updates: {
    title?: string;
    summary?: string;
    keyDecisions?: string[];
  }) => {
    if (!currentMeeting) return;
    const updated: MeetingRecord = {
      ...currentMeeting,
      ...updates,
      updatedAtMs: Date.now(),
    };
    setCurrentMeeting(updated);

    if (authUser && currentMeeting.ownerId === authUser.uid) {
      setIsSaving(true);
      try {
        await updateDraftMeetingMetadata({
          ownerId: authUser.uid,
          meetingId: updated.id,
          title: updated.title,
          summary: updated.summary,
          keyDecisions: updated.keyDecisions,
          ambiguities: updated.ambiguities,
          actionItemCount: updated.actionItems.length,
        });
      } catch (err) {
        console.error('Failed to save meeting update:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleUpdateActionItem = async (updatedItem: ActionItemDraft) => {
    if (!currentMeeting) return;
    const nextItems = currentMeeting.actionItems.map((it) =>
      it.id === updatedItem.id ? updatedItem : it
    );
    setCurrentMeeting({
      ...currentMeeting,
      actionItems: nextItems,
      updatedAtMs: Date.now(),
    });

    if (authUser && currentMeeting.ownerId === authUser.uid) {
      setIsSaving(true);
      try {
        await updateDraftActionItem({
          ownerId: authUser.uid,
          meetingId: currentMeeting.id,
          item: updatedItem,
        });
      } catch (err) {
        console.error('Failed to update action item:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAddActionItem = async (newItem: ActionItemDraft) => {
    if (!currentMeeting) return;
    const nextItems = [...currentMeeting.actionItems, newItem];
    setCurrentMeeting({
      ...currentMeeting,
      actionItems: nextItems,
      actionItemCount: nextItems.length,
      updatedAtMs: Date.now(),
    });

    if (authUser && currentMeeting.ownerId === authUser.uid) {
      setIsSaving(true);
      try {
        await createDraftActionItem({
          ownerId: authUser.uid,
          meetingId: currentMeeting.id,
          item: newItem,
        });
        await updateDraftMeetingMetadata({
          ownerId: authUser.uid,
          meetingId: currentMeeting.id,
          title: currentMeeting.title,
          summary: currentMeeting.summary,
          keyDecisions: currentMeeting.keyDecisions,
          ambiguities: currentMeeting.ambiguities,
          actionItemCount: nextItems.length,
        });
      } catch (err) {
        console.error('Failed to add action item:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteActionItem = async (itemId: string) => {
    if (!currentMeeting) return;
    const nextItems = currentMeeting.actionItems.filter((it) => it.id !== itemId);
    setCurrentMeeting({
      ...currentMeeting,
      actionItems: nextItems,
      actionItemCount: nextItems.length,
      updatedAtMs: Date.now(),
    });

    if (authUser && currentMeeting.ownerId === authUser.uid) {
      setIsSaving(true);
      try {
        await deleteDraftActionItem({
          meetingId: currentMeeting.id,
          itemId,
        });
        await updateDraftMeetingMetadata({
          ownerId: authUser.uid,
          meetingId: currentMeeting.id,
          title: currentMeeting.title,
          summary: currentMeeting.summary,
          keyDecisions: currentMeeting.keyDecisions,
          ambiguities: currentMeeting.ambiguities,
          actionItemCount: nextItems.length,
        });
      } catch (err) {
        console.error('Failed to delete action item:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleRequestExecute = (opts: {
    createNewSheet: boolean;
    spreadsheetInput: string;
    selectedItemIds: string[];
    targets: WorkspaceExecutionTargets;
  }) => {
    setExecutionError(null);
    setPendingExecuteOpts(opts);
    setExecuteModalOpen(true);
  };

  const selectedItemsForModal = currentMeeting
    ? currentMeeting.actionItems.filter((it) =>
        pendingExecuteOpts.selectedItemIds.includes(it.id)
      )
    : [];

  const handleConfirmExecute = async () => {
    if (!currentMeeting || !authUser) return;

    let token = workspaceToken || getAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        token = res.accessToken;
        setWorkspaceToken(token);
      } catch (err) {
        setExecutionError(
          err instanceof Error
            ? err.message
            : 'Google Workspace authorization is required to execute.'
        );
        setExecuteModalOpen(false);
        return;
      }
    }

    setIsExecuting(true);
    setExecutionError(null);
    try {
      let meetingToSync = currentMeeting;
      if (meetingToSync.ownerId !== authUser.uid) {
        meetingToSync = await createMeetingWithItems({
          ownerId: authUser.uid,
          title: meetingToSync.title,
          sourceType: meetingToSync.sourceType,
          sourceLabel: meetingToSync.sourceLabel,
          consentVerified: meetingToSync.consentVerified,
          summary: meetingToSync.summary,
          keyDecisions: meetingToSync.keyDecisions,
          ambiguities: meetingToSync.ambiguities,
          actionItems: meetingToSync.actionItems,
        });
      }

      const selectedSet = new Set(pendingExecuteOpts.selectedItemIds);
      const itemsToExecute = meetingToSync.actionItems
        .filter((it) => selectedSet.size === 0 || selectedSet.has(it.id))
        .map((it) => ({
          ...it,
          emailBody: appendAiAssistedFooter(it.emailBody),
          verifiedByUser: true,
        }));

      const res = await fetch('/api/workspace/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          meetingTitle: meetingToSync.title,
          createNewSheet: pendingExecuteOpts.createNewSheet,
          spreadsheetInput: pendingExecuteOpts.spreadsheetInput,
          timezone:
            userProfile?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            'UTC',
          actionItems: itemsToExecute,
          targets: pendingExecuteOpts.targets,
        }),
      });

      const data = (await res.json()) as WorkspaceExecutionResponse & {
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        if (data.code === 'WORKSPACE_AUTH_ERROR') {
          clearAccessToken();
          setWorkspaceToken(null);
        }
        throw new Error(data.error || 'Workspace execution failed.');
      }

      await recordExecutionAndAuditLog({
        ownerId: authUser.uid,
        humanReviewer: authUser.email || authUser.displayName || authUser.uid,
        meeting: meetingToSync,
        execution: data,
      });

      const resultMap = new Map(data.results.map((r) => [r.id, r]));
      const updatedItems = meetingToSync.actionItems.map((it) => {
        const outcome = resultMap.get(it.id);
        if (!outcome) return it;
        return {
          ...it,
          emailBody: appendAiAssistedFooter(it.emailBody),
          verifiedByUser: true,
          status: outcome.status,
          sheetUpdated: outcome.sheetUpdated,
          calendarEventUrl: outcome.calendarEventUrl,
          gmailDraftId: outcome.gmailDraftId,
          errorMessage: outcome.error,
        };
      });

      setCurrentMeeting({
        ...meetingToSync,
        status: 'executed',
        spreadsheetId: data.spreadsheetId || undefined,
        spreadsheetUrl: data.spreadsheetUrl || undefined,
        executedAtMs: Date.now(),
        actionItems: updatedItems,
      });

      setExecuteModalOpen(false);
      setStatusBanner(
        `Workspace sync complete for "${meetingToSync.title}". Enabled channels executed and immutable audit log recorded.`
      );
    } catch (err) {
      setExecutionError(
        err instanceof Error ? err.message : 'Failed to execute Workspace actions.'
      );
      setExecuteModalOpen(false);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConfirmDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    setIsDangerBusy(true);
    try {
      if (authUser && meetingToDelete.ownerId === authUser.uid) {
        await deleteMeetingRecord(authUser.uid, meetingToDelete.id);
      } else {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingToDelete.id));
      }
      if (currentMeeting?.id === meetingToDelete.id) {
        setCurrentMeeting(null);
      }
      setMeetingToDelete(null);
    } finally {
      setIsDangerBusy(false);
    }
  };

  const handleConfirmPurgeAllData = async () => {
    if (!authUser) return;
    setIsDangerBusy(true);
    try {
      const count = await purgeAllUserData(authUser.uid);
      setCurrentMeeting(null);
      setMeetings([]);
      setUserProfile(null);
      setPurgeConfirmOpen(false);
      setStatusBanner(
        `GDPR Data Purge complete: deleted ${count} meeting record(s) and your profile settings. Immutable compliance audit logs remain preserved per SOC 2 policy.`
      );
    } catch (err) {
      setStatusBanner(
        err instanceof Error ? err.message : 'Failed to purge user data.'
      );
    } finally {
      setIsDangerBusy(false);
    }
  };

  const handleExportDataJson = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      architectedBy: 'Md Shabbir Mia',
      contactEmail: 'mdshabbirmia520@gmail.com',
      profile: userProfile,
      meetings,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadence-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewTitleMap: Record<ActiveView, string> = {
    workbench: 'Operations Console',
    history: 'Meeting History',
    compliance: 'Compliance & Audit',
    settings: 'Workspace Settings',
  };

  const navItems: Array<{
    id: ActiveView;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'workbench', label: 'Operations Console', icon: <Layers className="h-4 w-4" /> },
    { id: 'history', label: 'Meeting History', icon: <History className="h-4 w-4" /> },
    { id: 'compliance', label: 'Compliance & Audit', icon: <FileCheck2 className="h-4 w-4" /> },
    { id: 'settings', label: 'Workspace Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="flex flex-1">
        {/* Desktop Enterprise Slate Rail */}
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex">
          <div className="p-5 space-y-6">
            <div className="flex items-center gap-2.5">
              <CadenceBrandMark />
              <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                Cadence
              </span>
            </div>

            <nav aria-label="Primary Workspace Navigation" className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/20 text-white'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {meetings.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="px-2 text-xs font-medium text-slate-400">
                  Recent Meetings
                </div>
                <div className="space-y-1">
                  {meetings.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setCurrentMeeting(m);
                        setActiveView('workbench');
                      }}
                      className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer"
                    >
                      {m.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 p-4 space-y-3">
            {authUser ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt={authUser.displayName || 'User avatar'}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-slate-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white">
                      {authUser.displayName || 'Google User'}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-400">
                      {authUser.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs leading-relaxed text-slate-400">
                  Sign in to persist Firestore history and authorize Workspace APIs.
                </p>
                <GoogleSignInButton onClick={handleSignIn} compact />
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-50 flex w-64 flex-col justify-between bg-slate-950 p-5 text-slate-200 shadow-xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CadenceBrandMark />
                    <span className="font-display text-lg font-bold text-white">Cadence</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                        activeView === item.id
                          ? 'bg-blue-600/20 text-white'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
              {!authUser ? (
                <GoogleSignInButton onClick={handleSignIn} compact />
              ) : (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200"
                >
                  Sign Out ({authUser.email})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Clean 3-Zone Top Bar */}
          <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="hidden md:inline text-slate-400 whitespace-nowrap">
                  Workspace
                </span>
                <span className="hidden md:inline text-slate-300" aria-hidden="true">
                  /
                </span>
                <span className="font-semibold text-slate-900 truncate">
                  {viewTitleMap[activeView]}
                </span>
                {activeView === 'workbench' && currentMeeting && (
                  <>
                    <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                      /
                    </span>
                    <span className="hidden sm:inline truncate text-slate-600">
                      {currentMeeting.title}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                aria-label="About Developer"
                onClick={() => setAboutDevModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Info className="h-3.5 w-3.5 text-blue-700" />
                <span className="hidden sm:inline">About Developer</span>
              </button>

              {activeView !== 'workbench' || currentMeeting ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMeeting(null);
                    setActiveView('workbench');
                    setZeroRetentionNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Meeting</span>
                </button>
              ) : !authUser ? (
                <GoogleSignInButton onClick={handleSignIn} compact />
              ) : null}
            </div>
          </header>

          {/* Main Viewport */}
          <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
            {authError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
              >
                <span>{authError}</span>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="font-medium underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {statusBanner && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{statusBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="font-medium underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {zeroRetentionNotice && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900"
              >
                <span>{zeroRetentionNotice}</span>
                <button
                  type="button"
                  onClick={() => setZeroRetentionNotice(null)}
                  className="font-medium underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {activeView === 'workbench' && (
              <div className="space-y-6">
                {!currentMeeting && (
                  <UploadZone
                    consentVerified={consentVerified}
                    onConsentChange={setConsentVerified}
                    isExtracting={isExtracting}
                    errorMessage={extractError}
                    onExtractText={handleExtractText}
                    onExtractMedia={handleExtractMedia}
                    onLoadSamplePlan={handleLoadSamplePlan}
                  />
                )}

                {currentMeeting && (
                  <ReviewDashboard
                    meeting={currentMeeting}
                    defaultSpreadsheetId={userProfile?.defaultSpreadsheetId}
                    isSignedIn={Boolean(authUser)}
                    isSaving={isSaving}
                    isExecuting={isExecuting}
                    executionError={executionError}
                    onUpdateMeetingField={handleUpdateMeetingField}
                    onUpdateActionItem={handleUpdateActionItem}
                    onAddActionItem={handleAddActionItem}
                    onDeleteActionItem={handleDeleteActionItem}
                    onCloneAsDraft={handleCloneAsDraft}
                    onRequestExecute={handleRequestExecute}
                    onRequireSignIn={handleSignIn}
                  />
                )}
              </div>
            )}

            {activeView === 'history' && (
              <HistoryView
                meetings={meetings}
                isLoading={meetingsLoading}
                isSignedIn={Boolean(authUser)}
                onOpenMeeting={(m) => {
                  setCurrentMeeting(m);
                  setActiveView('workbench');
                }}
                onDeleteMeeting={(m) => setMeetingToDelete(m)}
                onNewMeeting={() => {
                  setCurrentMeeting(null);
                  setActiveView('workbench');
                }}
              />
            )}

            {activeView === 'compliance' && (
              <ComplianceView
                auditLogs={auditLogs}
                isLoading={auditLoading}
                isSignedIn={Boolean(authUser)}
                onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
                onExportData={handleExportDataJson}
                onRequestPurge={() => setPurgeConfirmOpen(true)}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                profile={userProfile}
                hasWorkspaceToken={Boolean(workspaceToken)}
                isSignedIn={Boolean(authUser)}
                onSignIn={handleSignIn}
                onSavePreferences={async (updates) => {
                  if (!authUser) return;
                  await updateUserPreferences(authUser.uid, {
                    displayName:
                      userProfile?.displayName ||
                      authUser.displayName ||
                      'Workspace User',
                    email: userProfile?.email || authUser.email || '',
                    defaultSpreadsheetId: updates.defaultSpreadsheetId,
                    timezone: updates.timezone,
                  });
                  setUserProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          defaultSpreadsheetId: updates.defaultSpreadsheetId,
                          timezone: updates.timezone,
                        }
                      : prev
                  );
                }}
                onRequestPurge={() => setPurgeConfirmOpen(true)}
              />
            )}
          </main>

          {/* Persistent Governance & Authorship Footer */}
          <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                Engineered & Architected by{' '}
                <strong className="font-medium text-slate-800">Md Shabbir Mia</strong> •{' '}
                <a
                  href="mailto:mdshabbirmia520@gmail.com"
                  className="hover:text-slate-900 hover:underline"
                >
                  mdshabbirmia520@gmail.com
                </a>{' '}
                • © 2026 All Rights Reserved
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setPrivacyModalOpen(true)}
                  className="hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Privacy Policy & Terms
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('compliance')}
                  className="hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Compliance Audit Log
                </button>
                <button
                  type="button"
                  onClick={() => setAboutDevModalOpen(true)}
                  className="hover:text-slate-900 hover:underline cursor-pointer"
                >
                  About Developer
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Modals */}
      <ExecuteConfirmModal
        open={executeModalOpen}
        meetingTitle={currentMeeting?.title || ''}
        items={selectedItemsForModal}
        createNewSheet={pendingExecuteOpts.createNewSheet}
        spreadsheetInput={pendingExecuteOpts.spreadsheetInput}
        targets={pendingExecuteOpts.targets}
        isExecuting={isExecuting}
        onCancel={() => setExecuteModalOpen(false)}
        onConfirm={handleConfirmExecute}
      />

      <PrivacyPolicyModal
        open={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        onExportData={handleExportDataJson}
        onRequestPurge={() => {
          setPrivacyModalOpen(false);
          setPurgeConfirmOpen(true);
        }}
        isSignedIn={Boolean(authUser)}
      />

      <AboutDeveloperModal
        open={aboutDevModalOpen}
        onClose={() => setAboutDevModalOpen(false)}
      />

      <DangerConfirmModal
        open={Boolean(meetingToDelete)}
        title="Delete Meeting Record?"
        description={`This will permanently remove "${
          meetingToDelete?.title || ''
        }" and its action items from your meeting history. Immutable compliance audit records are preserved.`}
        confirmLabel="Delete Meeting"
        isBusy={isDangerBusy}
        onCancel={() => setMeetingToDelete(null)}
        onConfirm={handleConfirmDeleteMeeting}
      />

      <DangerConfirmModal
        open={purgeConfirmOpen}
        title="Purge All My Personal Data?"
        description="This permanently deletes all your saved meetings, action items, and Workspace preferences from Cloud Firestore. Immutable SOC 2 audit log entries remain tamper-evident."
        confirmLabel="Purge All My Data"
        isBusy={isDangerBusy}
        onCancel={() => setPurgeConfirmOpen(false)}
        onConfirm={handleConfirmPurgeAllData}
      />
    </div>
  );
}
