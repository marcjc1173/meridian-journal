import { useCallback, useEffect, useState } from 'react';
import { Search, Tag, X } from 'lucide-react';
import { api } from '../api';
import { MOODS, type Entry } from '../types';
import { EntryCard } from '../components/EntryCard';
import { EntryEditor } from '../components/EntryEditor';

interface JournalPageProps {
  initialTag?: string;
  onClearInitialTag?: () => void;
}

export function JournalPage({ initialTag = '', onClearInitialTag }: JournalPageProps) {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [selectedMood, setSelectedMood] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  useEffect(() => {
    if (initialTag) {
      setSelectedTag(initialTag);
      onClearInitialTag?.();
    }
  }, [initialTag, onClearInitialTag]);

  const loadTags = useCallback(async () => {
    try {
      const res = await api.getTags();
      setTags(res.tags);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listEntries({
        search: search.trim() || undefined,
        tag: selectedTag || undefined,
        mood: selectedMood || undefined,
        limit: 100,
      });
      setEntries(res.entries);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedTag, selectedMood]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEntries();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadEntries]);

  const handleDelete = async (entry: Entry) => {
    if (!window.confirm('Delete this entry and its photos?')) return;
    await api.deleteEntry(entry.id);
    loadEntries();
    loadTags();
  };

  const hasFilters = Boolean(search.trim() || selectedTag || selectedMood);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Entries</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} {total === 1 ? 'entry' : 'entries'}
            {hasFilters ? ' matching your filters' : ' in your journal'}
          </p>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedTag('');
              setSelectedMood('');
            }}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </header>

      {/* Search & Filters */}
      <div
        className="space-y-3 rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border)',
          }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries, questions, or tags..."
            className="w-full bg-transparent text-sm focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Mood filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {MOODS.map((m) => {
            const active = selectedMood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMood(active ? '' : m.id)}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
                style={{
                  borderColor: active ? m.color : 'var(--border)',
                  backgroundColor: active ? `${m.color}22` : 'transparent',
                  color: active ? m.color : 'var(--text-muted)',
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Tag chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Tag className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            {tags.map((t) => {
              const active = selectedTag === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTag(active ? '' : t.name)}
                  className="rounded-md px-2 py-0.5 text-xs transition"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  #{t.name} ({t.count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Editor if editing */}
      {editingEntry && (
        <EntryEditor
          initialEntry={editingEntry}
          onSaved={() => {
            setEditingEntry(null);
            loadEntries();
            loadTags();
          }}
          onCancel={() => setEditingEntry(null)}
        />
      )}

      {/* Entries List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
              onTagClick={(t) => setSelectedTag(t)}
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl border border-dashed p-8 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {hasFilters
            ? 'No entries match your search or filters.'
            : 'Your journal is empty. Head to Today to write your first entry.'}
        </div>
      )}
    </div>
  );
}
