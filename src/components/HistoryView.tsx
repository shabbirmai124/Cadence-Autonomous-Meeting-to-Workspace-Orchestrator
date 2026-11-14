import React, { useMemo, useState } from 'react';
import { ExternalLink, FolderOpen, Search, Trash2 } from 'lucide-react';
import { filterMeetings } from '../utils/meetingLogic';
import type { MeetingRecord, MeetingStatus, SourceType } from '../types/meeting';

interface HistoryViewProps {
  meetings: MeetingRecord[];
  isLoading: boolean;
  isSignedIn: boolean;
  onOpenMeeting: (meeting: MeetingRecord) => void;
  onDeleteMeeting: (meeting: MeetingRecord) => void;
  onNewMeeting: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  meetings,
  isLoading,
  isSignedIn,
  onOpenMeeting,
  onDeleteMeeting,
  onNewMeeting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MeetingStatus>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | SourceType>('all');

  const stats = useMemo(() => {
    const executed = meetings.filter((m) => m.status === 'executed').length;
    const pending = meetings.length - executed;
    const totalTasks = meetings.reduce((acc, m) => acc + m.actionItems.length, 0);
    return { total: meetings.length, executed, pending, totalTasks };
  }, [meetings]);

  const filtered = useMemo(() => {
    const base = filterMeetings(meetings, searchQuery, statusFilter);
    return sourceFilter === 'all' ? base : base.filter((m) => m.sourceType === sourceFilter);
  }, [meetings, searchQuery, statusFilter, sourceFilter]);

  return (
    <div className="space-y-5">
      {/* Live Operational Metrics Strip */}
      <section
        aria-label="Meeting Operations Summary"
        className="grid grid-cols-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-xs sm:grid-cols-4 sm:divide-x sm:divide-y-0"
      >
        {[
          { label: 'Total Meetings', value: stats.total },
          { label: 'Pending Review', value: stats.pending },
          { label: 'Executed Plans', value: stats.executed },
          { label: 'Tracked Action Items', value: stats.totalTasks },
        ].map((metric) => (
          <div key={metric.label} className="px-5 py-4">
            <div className="text-xs font-medium text-zinc-500">{metric.label}</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metric.value}
            </div>
          </div>
        ))}
      </section>

      <section
        aria-label="Meeting History"
        className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Meeting History</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isSignedIn
                ? 'Stored privately in Cloud Firestore under your verified Google identity.'
                : 'Sign in with Google to persist meeting records across sessions.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                aria-label="Search meetings by title or assignee"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title or owner..."
                className="rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter meetings by source type"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | SourceType)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-zinc-950 focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="text">Transcript</option>
              <option value="audio">Audio</option>
              <option value="image">Handwritten</option>
            </select>

            <div
              role="tablist"
              aria-label="Filter meetings by status"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'draft', label: 'Pending Review' },
                  { id: 'executed', label: 'Executed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2.5" aria-busy="true">
            <div className="h-10 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-10 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-10 w-full animate-pulse rounded bg-zinc-100" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {meetings.length === 0
                ? 'No meetings recorded yet'
                : 'No meetings match your current filter'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {meetings.length === 0
                ? 'Ingest a transcript, audio recording, or whiteboard photo in Operations Console to get started.'
                : 'Try clearing the search box or switching status/source filters.'}
            </p>
            {meetings.length === 0 && (
              <button
                type="button"
                onClick={onNewMeeting}
                className="mt-4 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
              >
                Open Operations Console
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">
                  <th className="px-3.5 py-2.5">Meeting</th>
                  <th className="px-3.5 py-2.5">Source</th>
                  <th className="px-3.5 py-2.5 text-right">Items</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Created</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-3.5 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenMeeting(m)}
                        className="text-left font-medium text-zinc-950 hover:underline cursor-pointer"
                      >
                        {m.title}
                      </button>
                      <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                        {m.summary}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-xs capitalize text-zinc-600">
                      {m.sourceType}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono text-xs tabular-nums text-zinc-700">
                      {m.actionItems.length}
                    </td>
                    <td className="px-3.5 py-3 text-xs">
                      <span
                        className={`font-medium ${
                          m.status === 'executed' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {m.status === 'executed' ? 'Executed' : 'Pending Review'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-xs tabular-nums text-zinc-500">
                      {new Date(m.createdAtMs).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {m.spreadsheetUrl && (
                          <a
                            href={m.spreadsheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open Google Sheet for ${m.title}`}
                            className="rounded border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label={`Open meeting ${m.title}`}
                          onClick={() => onOpenMeeting(m)}
                          className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 cursor-pointer"
                        >
                          <FolderOpen className="h-3 w-3" />
                          <span>Open</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete meeting ${m.title}`}
                          onClick={() => onDeleteMeeting(m)}
                          className="rounded border border-zinc-200 p-1.5 text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
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
