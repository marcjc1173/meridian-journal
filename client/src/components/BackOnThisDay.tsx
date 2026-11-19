import { History } from 'lucide-react';
import { EntryCard } from './EntryCard';
import type { Entry } from '../types';

interface BackOnThisDayProps {
  currentDate: string;
  entries: Entry[];
  recentThrowback: Entry[];
  recentLabel: string;
  onEdit?: (entry: Entry) => void;
  onDelete?: (entry: Entry) => void;
  onTagClick?: (tag: string) => void;
}

export function BackOnThisDay({
  currentDate,
  entries,
  recentThrowback,
  recentLabel,
  onEdit,
  onDelete,
  onTagClick,
}: BackOnThisDayProps) {
  const currentYear = Number(currentDate.slice(0, 4));
  const hasPastYears = entries.length > 0;
  const hasRecent = !hasPastYears && recentThrowback.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Back on This Day
        </h2>
      </div>

      {hasPastYears ? (
        <div className="space-y-3">
          {entries.map((entry) => {
            const entryYear = Number(entry.entry_date.slice(0, 4));
            const diff = currentYear - entryYear;
            const badge = diff === 1 ? '1 year ago' : `${diff} years ago`;
            return (
              <EntryCard
                key={entry.id}
                entry={entry}
                badgeText={badge}
                onEdit={onEdit}
                onDelete={onDelete}
                onTagClick={onTagClick}
              />
            );
          })}
        </div>
      ) : hasRecent ? (
        <div className="space-y-3">
          {recentThrowback.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              badgeText={recentLabel}
              onEdit={onEdit}
              onDelete={onDelete}
              onTagClick={onTagClick}
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl border border-dashed p-5 text-sm"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          No entries from this date in previous years yet. As you keep writing, this space
          will surface where your head was at on this exact day in years past—a grounded way
          to see how far you’ve come.
        </div>
      )}
    </section>
  );
}
