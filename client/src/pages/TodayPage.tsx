import { useCallback, useEffect, useState } from 'react';
import { Flame, PenLine } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  formatReadableDate,
  getTodayYmd,
  type Entry,
  type JournalStats,
  type Prompt,
} from '../types';
import { QuestionOfDay } from '../components/QuestionOfDay';
import {
  clearSavedDraft,
  EntryEditor,
  loadSavedDraft,
  NEW_DRAFT_KEY,
} from '../components/EntryEditor';
import { EntryCard } from '../components/EntryCard';
import { BackOnThisDay } from '../components/BackOnThisDay';

interface TodayPageProps {
  pendingPrompt?: Prompt | null;
  onClearPendingPrompt?: () => void;
  onTagClick: (tag: string) => void;
}

export function TodayPage({
  pendingPrompt,
  onClearPendingPrompt,
  onTagClick,
}: TodayPageProps) {
  const { status } = useAuth();
  const today = getTodayYmd();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptOffset, setPromptOffset] = useState(0);
  const [promptLoading, setPromptLoading] = useState(true);

  const [todayEntries, setTodayEntries] = useState<Entry[]>([]);
  const [onThisDay, setOnThisDay] = useState<{
    entries: Entry[];
    recentThrowback: Entry[];
    recentLabel: string;
  }>({ entries: [], recentThrowback: [], recentLabel: '' });
  const [stats, setStats] = useState<JournalStats | null>(null);

  const [isComposing, setIsComposing] = useState(false);
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(() =>
    Boolean(loadSavedDraft(NEW_DRAFT_KEY))
  );

  const loadData = useCallback(async () => {
    try {
      const [entriesRes, otdRes, statsRes] = await Promise.all([
        api.listEntries({ date: today }),
        api.getOnThisDay(today),
        api.getStats(),
      ]);
      setTodayEntries(entriesRes.entries);
      setOnThisDay({
        entries: otdRes.entries,
        recentThrowback: otdRes.recentThrowback,
        recentLabel: otdRes.recentLabel,
      });
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load today view:', err);
    }
  }, [today]);

  const loadPrompt = useCallback(
    async (offset: number) => {
      setPromptLoading(true);
      try {
        const res = await api.getTodayPrompt(today, offset);
        setPrompt(res.prompt);
      } catch (err) {
        console.error('Failed to load prompt:', err);
      } finally {
        setPromptLoading(false);
      }
    },
    [today]
  );

  useEffect(() => {
    loadData();
    loadPrompt(0);
  }, [loadData, loadPrompt]);

  useEffect(() => {
    if (pendingPrompt) {
      setEditingEntry(null);
      setActivePrompt(pendingPrompt);
      setIsComposing(true);
      onClearPendingPrompt?.();
    }
  }, [pendingPrompt, onClearPendingPrompt]);

  const handleShuffle = () => {
    const next = promptOffset + 1;
    setPromptOffset(next);
    loadPrompt(next);
  };

  const handleAnswerPrompt = (p: Prompt) => {
    setEditingEntry(null);
    setActivePrompt(p);
    setIsComposing(true);
  };

  const handleStartFreeWrite = () => {
    setEditingEntry(null);
    setActivePrompt(null);
    setIsComposing(true);
  };

  const handleEdit = (entry: Entry) => {
    setActivePrompt(null);
    setEditingEntry(entry);
    setIsComposing(true);
  };

  const handleDelete = async (entry: Entry) => {
    if (!window.confirm('Delete this entry and its photos? This cannot be undone.')) return;
    await api.deleteEntry(entry.id);
    loadData();
  };

  const handleSaved = () => {
    setIsComposing(false);
    setEditingEntry(null);
    setActivePrompt(null);
    setHasUnsavedDraft(Boolean(loadSavedDraft(NEW_DRAFT_KEY)));
    loadData();
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent)' }}
          >
            {formatReadableDate(today)}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
            {greeting}
            {status?.displayName ? `, ${status.displayName}` : ''}.
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {stats && stats.totalDays > 0 && (
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <Flame className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              {stats.streak > 0
                ? `${stats.streak} day streak`
                : `${stats.totalDays} days journaled`}
            </div>
          )}

          {!isComposing && (
            <button
              type="button"
              onClick={handleStartFreeWrite}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-stone-950 transition hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <PenLine className="h-4 w-4" />
              New Entry
            </button>
          )}
        </div>
      </header>

      {/* Unsaved draft banner (e.g. after Auto-Lock or refresh) */}
      {!isComposing && hasUnsavedDraft && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
          }}
        >
          <span>You have an unsaved draft waiting.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearSavedDraft(NEW_DRAFT_KEY);
                setHasUnsavedDraft(false);
              }}
              className="rounded-lg border px-3 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleStartFreeWrite}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-stone-950"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Resume Draft
            </button>
          </div>
        </div>
      )}

      {/* Editor when composing or editing */}
      {isComposing && (
        <EntryEditor
          initialEntry={editingEntry}
          initialDate={today}
          initialPrompt={activePrompt}
          onSaved={handleSaved}
          onCancel={() => {
            setIsComposing(false);
            setEditingEntry(null);
            setActivePrompt(null);
            setHasUnsavedDraft(Boolean(loadSavedDraft(NEW_DRAFT_KEY)));
          }}
        />
      )}

      {/* Question of the Day */}
      {!isComposing && (
        <QuestionOfDay
          prompt={prompt}
          loading={promptLoading}
          onShuffle={handleShuffle}
          onAnswer={handleAnswerPrompt}
        />
      )}

      {/* Today's Entries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Today’s Entries {todayEntries.length > 0 ? `(${todayEntries.length})` : ''}
          </h2>
        </div>

        {todayEntries.length > 0 ? (
          <div className="space-y-4">
            {todayEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                showDate={false}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTagClick={onTagClick}
              />
            ))}
          </div>
        ) : (
          !isComposing && (
            <div
              className="rounded-xl border border-dashed p-6 text-center"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <p className="text-sm">
                Nothing written yet today. Take five minutes to clear your head—or answer the
                question above.
              </p>
              <button
                type="button"
                onClick={handleStartFreeWrite}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition hover:opacity-85"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <PenLine className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                Start writing
              </button>
            </div>
          )
        )}
      </section>

      {/* Back on This Day */}
      <BackOnThisDay
        currentDate={today}
        entries={onThisDay.entries}
        recentThrowback={onThisDay.recentThrowback}
        recentLabel={onThisDay.recentLabel}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTagClick={onTagClick}
      />
    </div>
  );
}
