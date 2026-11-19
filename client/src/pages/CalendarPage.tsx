import { useCallback, useEffect, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { api } from '../api';
import {
  formatReadableDate,
  getMoodMeta,
  getTodayYmd,
  type CalendarDayInfo,
  type Entry,
} from '../types';
import { EntryCard } from '../components/EntryCard';
import { EntryEditor } from '../components/EntryEditor';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarPageProps {
  onTagClick: (tag: string) => void;
}

export function CalendarPage({ onTagClick }: CalendarPageProps) {
  const today = getTodayYmd();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [daysMap, setDaysMap] = useState<Record<string, CalendarDayInfo>>({});
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dayEntries, setDayEntries] = useState<Entry[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const [isComposing, setIsComposing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const loadMonth = useCallback(async () => {
    try {
      const res = await api.getCalendar(year, month);
      setDaysMap(res.days);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    }
  }, [year, month]);

  const loadSelectedDay = useCallback(async (dateStr: string) => {
    setLoadingDay(true);
    try {
      const res = await api.listEntries({ date: dateStr });
      setDayEntries(res.entries);
    } catch (err) {
      console.error('Failed to load day entries:', err);
    } finally {
      setLoadingDay(false);
    }
  }, []);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    loadSelectedDay(selectedDate);
  }, [selectedDate, loadSelectedDay]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelectedDate(today);
  };

  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const daysWithEntriesCount = Object.keys(daysMap).length;

  const handleDelete = async (entry: Entry) => {
    if (!window.confirm('Delete this entry and its photos?')) return;
    await api.deleteEntry(entry.id);
    loadMonth();
    loadSelectedDay(selectedDate);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {daysWithEntriesCount === 0
              ? 'No entries recorded this month yet'
              : `${daysWithEntriesCount} ${
                  daysWithEntriesCount === 1 ? 'day' : 'days'
                } with entries in ${monthTitle}`}
          </p>
        </div>

        <button
          type="button"
          onClick={jumpToToday}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-85"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Today
        </button>
      </header>

      {/* Calendar Card */}
      <div
        className="rounded-xl border p-4 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border p-2 transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold">{monthTitle}</h2>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border p-2 transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((dayNum, idx) => {
            if (dayNum === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;
            const info = daysMap[dateStr];
            const hasEntries = Boolean(info && info.count > 0);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const primaryMood = info?.moods?.[0] ? getMoodMeta(info.moods[0]) : null;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  setSelectedDate(dateStr);
                  setIsComposing(false);
                  setEditingEntry(null);
                }}
                className="relative flex aspect-square flex-col items-center justify-between rounded-xl border p-1.5 sm:p-2 transition"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--accent)'
                    : hasEntries
                    ? 'var(--accent-soft)'
                    : 'transparent',
                  borderColor: isSelected
                    ? 'var(--accent)'
                    : hasEntries
                    ? 'var(--accent)'
                    : isToday
                    ? 'var(--text-muted)'
                    : 'var(--border)',
                  color: isSelected
                    ? '#141517'
                    : hasEntries
                    ? 'var(--text)'
                    : 'var(--text-muted)',
                }}
              >
                <span
                  className={`text-xs sm:text-sm ${
                    hasEntries || isToday || isSelected ? 'font-bold' : 'font-normal'
                  }`}
                >
                  {dayNum}
                </span>

                {/* Entry indicators */}
                {hasEntries ? (
                  <div className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? '#141517'
                          : primaryMood
                          ? primaryMood.color
                          : 'var(--accent)',
                      }}
                    />
                    {info.count > 1 && (
                      <span className="text-[10px] font-semibold leading-none opacity-80">
                        {info.count}
                      </span>
                    )}
                    {info.photoCount > 0 && (
                      <Camera className="h-2.5 w-2.5 opacity-80" />
                    )}
                  </div>
                ) : (
                  <span className="h-1.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded border"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
              }}
            />
            Day with entries
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            Includes photos
          </span>
        </div>
      </div>

      {/* Selected Day Entries */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{formatReadableDate(selectedDate)}</h2>
          {!isComposing && (
            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setIsComposing(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-85"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <PenLine className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              Add Entry for This Day
            </button>
          )}
        </div>

        {isComposing && (
          <EntryEditor
            initialEntry={editingEntry}
            initialDate={selectedDate}
            onSaved={() => {
              setIsComposing(false);
              setEditingEntry(null);
              loadMonth();
              loadSelectedDay(selectedDate);
            }}
            onCancel={() => {
              setIsComposing(false);
              setEditingEntry(null);
            }}
          />
        )}

        {loadingDay ? (
          <div
            className="h-24 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          />
        ) : dayEntries.length > 0 ? (
          <div className="space-y-3">
            {dayEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                showDate={false}
                onEdit={(e) => {
                  setEditingEntry(e);
                  setIsComposing(true);
                }}
                onDelete={handleDelete}
                onTagClick={onTagClick}
              />
            ))}
          </div>
        ) : (
          !isComposing && (
            <div
              className="rounded-xl border border-dashed p-5 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              No entries on this day.
            </div>
          )
        )}
      </section>
    </div>
  );
}
