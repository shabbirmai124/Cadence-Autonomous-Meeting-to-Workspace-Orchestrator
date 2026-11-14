import React, { useState } from 'react';
import { CheckCircle2, Globe, ShieldCheck, Trash2 } from 'lucide-react';
import { extractSpreadsheetId } from '../utils/meetingLogic';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { UserProfileRecord } from '../types/meeting';

interface SettingsViewProps {
  profile: UserProfileRecord | null;
  hasWorkspaceToken: boolean;
  isSignedIn: boolean;
  onSignIn: () => void;
  onSavePreferences: (updates: {
    defaultSpreadsheetId: string;
    timezone: string;
  }) => Promise<void>;
  onRequestPurge: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  hasWorkspaceToken,
  isSignedIn,
  onSignIn,
  onSavePreferences,
  onRequestPurge,
}) => {
  const [sheetInput, setSheetInput] = useState(profile?.defaultSpreadsheetId || '');
  const [timezone, setTimezone] = useState(
    profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    setErrorMessage(null);

    const trimmedSheet = sheetInput.trim();
    let resolvedId = '';
    if (trimmedSheet) {
      const parsed = extractSpreadsheetId(trimmedSheet);
      if (!parsed) {
        setErrorMessage('Enter a valid Google Spreadsheet ID or full Google Sheets URL.');
        return;
      }
      resolvedId = parsed;
    }

    setIsSaving(true);
    try {
      await onSavePreferences({
        defaultSpreadsheetId: resolvedId,
        timezone: timezone.trim() || 'UTC',
      });
      setSaveMessage('Workspace preferences saved to Cloud Firestore.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5 shadow-xs">
        <div className="border-b border-zinc-200 pb-4">
          <h2 className="text-lg font-semibold text-zinc-950">Workspace Connection & OAuth Scopes</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Least-privilege Google Workspace permissions scoped strictly to Sheets, Calendar Events,
            and Gmail Drafts. Access tokens are held only in browser memory.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <ShieldCheck className="h-4 w-4 text-zinc-900" />
              <span>
                {isSignedIn
                  ? `Signed in as ${profile?.email || profile?.displayName}`
                  : 'Not signed in with Google'}
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              {hasWorkspaceToken
                ? 'Active in-memory OAuth session authorized for Google Sheets, Google Calendar, and Gmail Drafts.'
                : isSignedIn
                ? 'Firestore session active. Re-authenticate with Google when executing Workspace syncs.'
                : 'Sign in with Google to persist meeting history in Firestore and execute Workspace actions.'}
            </p>
          </div>
          <GoogleSignInButton
            onClick={onSignIn}
            label={hasWorkspaceToken ? 'Refresh Workspace Token' : 'Sign in with Google'}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3 text-xs border-t border-zinc-200 pt-4">
          {[
            {
              api: 'Google Sheets API',
              scope: 'auth/spreadsheets',
              purpose: 'Create tracker sheets or append rows to your designated spreadsheet tab.',
            },
            {
              api: 'Google Calendar API',
              scope: 'auth/calendar.events',
              purpose: 'Schedule due-date events on your primary calendar with optional attendees.',
            },
            {
              api: 'Gmail API (Drafts Only)',
              scope: 'auth/gmail.compose',
              purpose: 'Save follow-up drafts in Gmail Drafts; never reads inbox or auto-sends mail.',
            },
          ].map((s) => (
            <div key={s.api} className="space-y-1">
              <div className="font-semibold text-zinc-950">{s.api}</div>
              <div className="font-mono text-zinc-500">{s.scope}</div>
              <p className="leading-relaxed text-zinc-600">{s.purpose}</p>
            </div>
          ))}
        </div>
      </section>

      {isSignedIn && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5 shadow-xs">
          <div className="border-b border-zinc-200 pb-4">
            <h3 className="text-base font-semibold text-zinc-950">
              Default Workspace Preferences
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Configure your default target Google Sheet and Calendar scheduling timezone.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <label
                htmlFor="default-sheet-input"
                className="block text-xs font-medium text-zinc-700"
              >
                Default Google Spreadsheet URL or ID (optional)
              </label>
              <input
                id="default-sheet-input"
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="Leave blank to create a fresh sheet per meeting"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="timezone-input"
                  className="block text-xs font-medium text-zinc-700"
                >
                  Calendar Timezone (IANA)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
                >
                  <Globe className="h-3 w-3" />
                  <span>Detect Browser Timezone</span>
                </button>
              </div>
              <input
                id="timezone-input"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            {errorMessage && (
              <p role="alert" className="text-xs text-red-700">
                {errorMessage}
              </p>
            )}
            {saveMessage && (
              <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{saveMessage}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </form>

          <div className="border-t border-zinc-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-950">
                  Right to Erasure (GDPR / CCPA)
                </div>
                <p className="text-xs text-zinc-500">
                  Permanently delete all saved meetings, action items, and user preferences from
                  Firestore. Immutable compliance audit records remain tamper-evident.
                </p>
              </div>
              <button
                type="button"
                onClick={onRequestPurge}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Purge All My Data</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
