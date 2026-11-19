import React, { useCallback, useEffect, useState } from 'react';
import { PenLine, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Prompt } from '../types';

interface PromptsPageProps {
  onSelectPrompt: (prompt: Prompt) => void;
}

export function PromptsPage({ onSelectPrompt }: PromptsPageProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('Personal');
  const [newQuestion, setNewQuestion] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.listPrompts(selectedCategory || undefined);
      setPrompts(res.prompts);
      setCategories(res.categories);
    } catch (err) {
      console.error(err);
    }
  }, [selectedCategory]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newQuestion.trim().length < 5) {
      setError('Write a question of at least 5 characters.');
      return;
    }
    setAdding(true);
    try {
      await api.createPrompt(newCategory, newQuestion);
      setNewQuestion('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add question.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (p: Prompt) => {
    if (!window.confirm('Remove this question from your rotation?')) return;
    await api.deletePrompt(p.id);
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Question Library</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Grounded daily reflection questions written for men navigating their 45–60s. Pick
          any question to write about right now, or add your own.
        </p>
      </header>

      {/* Add custom question */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Add Your Own Question
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category"
            className="sm:w-40 rounded-lg border px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="e.g. What is one thing I want to let go of before the weekend?"
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-stone-950 transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && (
          <div className="text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        )}
      </form>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedCategory('')}
          className="rounded-full border px-3 py-1 text-xs font-medium transition"
          style={{
            borderColor: !selectedCategory ? 'var(--accent)' : 'var(--border)',
            backgroundColor: !selectedCategory ? 'var(--accent-soft)' : 'transparent',
            color: !selectedCategory ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          All ({prompts.length})
        </button>
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(active ? '' : cat)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--border)',
                backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Prompt list */}
      <div className="space-y-2.5">
        {prompts.map((p) => (
          <div
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {p.category}
                </span>
                {p.is_custom === 1 && (
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--accent)' }}
                  >
                    Custom
                  </span>
                )}
              </div>
              <p className="font-journal text-[15px] leading-snug">{p.question}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onSelectPrompt(p)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-85"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <PenLine className="h-3.5 w-3.5" />
                Write
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p)}
                className="rounded-lg p-1.5 transition hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                title="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
