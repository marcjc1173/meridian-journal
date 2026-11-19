import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Photo } from '../types';

interface PhotoLightboxProps {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
}

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const current = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onNavigate]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 transition"
        aria-label="Close photo viewer"
      >
        <X className="h-5 w-5" />
      </button>

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          className="absolute left-3 sm:left-6 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 transition"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <div
        className="flex max-h-[90vh] max-w-[92vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={current.caption || current.original_name}
          className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        <div className="mt-3 flex items-center gap-3 text-sm text-stone-300">
          {current.caption && <span>{current.caption}</span>}
          <span className="text-xs text-stone-500">
            {index + 1} / {photos.length}
          </span>
        </div>
      </div>

      {index < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          className="absolute right-3 sm:right-6 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 transition"
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
