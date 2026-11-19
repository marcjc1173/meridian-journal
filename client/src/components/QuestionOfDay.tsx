import { RefreshCw, PenLine, Compass } from 'lucide-react';
import type { Prompt } from '../types';

interface QuestionOfDayProps {
  prompt: Prompt | null;
  loading?: boolean;
  onShuffle: () => void;
  onAnswer: (prompt: Prompt) => void;
}

export function QuestionOfDay({
  prompt,
  loading,
  onShuffle,
  onAnswer,
}: QuestionOfDayProps) {
  if (!prompt && !loading) return null;

  return (
    <section
      className="relative overflow-hidden rounded-xl border p-5 sm:p-6"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: 'var(--accent)' }}
      />

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent)' }}
          >
            Question of the Day
          </span>
          {prompt && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              {prompt.category}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onShuffle}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:opacity-85"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
          title="Draw a different question"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Another
        </button>
      </div>

      {prompt ? (
        <>
          <p className="font-journal text-lg sm:text-xl leading-snug mb-4">
            “{prompt.question}”
          </p>

          <button
            type="button"
            onClick={() => onAnswer(prompt)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-stone-950 transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <PenLine className="h-4 w-4" />
            Write About This
          </button>
        </>
      ) : (
        <div className="h-12 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-subtle)' }} />
      )}
    </section>
  );
}
