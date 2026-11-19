import { useState } from 'react';
import { Clock, Edit3, Trash2, Tag, Quote, Battery } from 'lucide-react';
import {
  formatShortDate,
  formatTime12h,
  getMoodMeta,
  type Entry,
} from '../types';
import { PhotoLightbox } from './PhotoLightbox';

interface EntryCardProps {
  entry: Entry;
  showDate?: boolean;
  badgeText?: string;
  onEdit?: (entry: Entry) => void;
  onDelete?: (entry: Entry) => void;
  onTagClick?: (tag: string) => void;
}

export function EntryCard({
  entry,
  showDate = true,
  badgeText,
  onEdit,
  onDelete,
  onTagClick,
}: EntryCardProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const mood = getMoodMeta(entry.mood);

  return (
    <>
      <article
        className="rounded-xl border p-5 transition-colors"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Top meta bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {badgeText && (
              <span
                className="rounded-full px-2.5 py-0.5 font-medium"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                {badgeText}
              </span>
            )}
            {showDate && (
              <span className="font-medium" style={{ color: 'var(--text)' }}>
                {formatShortDate(entry.entry_date)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime12h(entry.entry_time)}
            </span>
            {mood && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
                style={{
                  backgroundColor: `${mood.color}22`,
                  color: mood.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: mood.color }}
                />
                {mood.label}
              </span>
            )}
            {entry.energy && (
              <span className="inline-flex items-center gap-1">
                <Battery className="h-3.5 w-3.5" />
                Energy {entry.energy}/5
              </span>
            )}
          </div>

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="rounded-lg p-1.5 transition hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  title="Edit entry"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  className="rounded-lg p-1.5 transition hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  title="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Prompt banner if this entry answered a question */}
        {entry.prompt_text && (
          <div
            className="mb-3 flex items-start gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm italic"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderLeftColor: 'var(--accent)',
              color: 'var(--text-muted)',
            }}
          >
            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <span>{entry.prompt_text}</span>
          </div>
        )}

        {/* Title */}
        {entry.title && (
          <h3 className="mb-2 text-lg font-semibold tracking-tight">{entry.title}</h3>
        )}

        {/* Content */}
        {entry.content && (
          <div className="font-journal whitespace-pre-wrap text-[15.5px] leading-relaxed">
            {entry.content}
          </div>
        )}

        {/* Photos */}
        {entry.photos.length > 0 && (
          <div
            className={`mt-4 grid gap-2.5 ${
              entry.photos.length === 1
                ? 'grid-cols-1 max-w-md'
                : entry.photos.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {entry.photos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightboxIdx(idx)}
                className="group relative overflow-hidden rounded-lg border text-left focus:outline-none"
                style={{ borderColor: 'var(--border)' }}
              >
                <img
                  src={photo.thumbUrl}
                  alt={photo.caption || photo.original_name}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                {photo.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 py-1.5 text-xs text-white truncate">
                    {photo.caption}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {entry.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition hover:opacity-85"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </article>

      {lightboxIdx !== null && (
        <PhotoLightbox
          photos={entry.photos}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
        />
      )}
    </>
  );
}
