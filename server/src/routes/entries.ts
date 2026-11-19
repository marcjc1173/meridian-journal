import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db, THUMBS_DIR, UPLOADS_DIR } from '../db.js';

const router = Router();

interface EntryRow {
  id: string;
  title: string;
  content: string;
  entry_date: string;
  entry_time: string;
  entry_timestamp: string;
  mood: string | null;
  energy: number | null;
  prompt_id: number | null;
  prompt_text: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  entry_id: string;
  filename: string;
  thumb_filename: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string;
  sort_order: number;
  created_at: string;
}

function hydrateEntries(rows: EntryRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const tagRows = db
    .prepare(
      `SELECT et.entry_id, t.name
       FROM entry_tags et
       JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id IN (${placeholders})
       ORDER BY t.name ASC`
    )
    .all(...ids) as { entry_id: string; name: string }[];

  const photoRows = db
    .prepare(
      `SELECT * FROM photos
       WHERE entry_id IN (${placeholders})
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all(...ids) as PhotoRow[];

  const tagsByEntry = new Map<string, string[]>();
  for (const tr of tagRows) {
    const list = tagsByEntry.get(tr.entry_id) || [];
    list.push(tr.name);
    tagsByEntry.set(tr.entry_id, list);
  }

  const photosByEntry = new Map<string, ReturnType<typeof serializePhoto>[]>();
  for (const pr of photoRows) {
    const list = photosByEntry.get(pr.entry_id) || [];
    list.push(serializePhoto(pr));
    photosByEntry.set(pr.entry_id, list);
  }

  return rows.map((r) => ({
    ...r,
    tags: tagsByEntry.get(r.id) || [],
    photos: photosByEntry.get(r.id) || [],
  }));
}

export function serializePhoto(p: PhotoRow) {
  return {
    id: p.id,
    entry_id: p.entry_id,
    original_name: p.original_name,
    mime_type: p.mime_type,
    size_bytes: p.size_bytes,
    caption: p.caption,
    url: `/api/photos/${p.id}`,
    thumbUrl: `/api/photos/${p.id}/thumb`,
    created_at: p.created_at,
  };
}

function syncTags(entryId: string, rawTags?: string[]): void {
  db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(entryId);
  if (!Array.isArray(rawTags) || rawTags.length === 0) return;

  const cleaned = [
    ...new Set(
      rawTags
        .map((t) => String(t).trim().toLowerCase().replace(/^#/, ''))
        .filter((t) => t.length > 0 && t.length <= 40)
    ),
  ];

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const linkTag = db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)');

  for (const name of cleaned) {
    insertTag.run(name);
    const row = getTag.get(name) as { id: number } | undefined;
    if (row) {
      linkTag.run(entryId, row.id);
    }
  }
}

// GET /api/entries/stats
router.get('/stats', (_req, res) => {
  const totalEntries = (
    db.prepare('SELECT COUNT(*) as c FROM entries').get() as { c: number }
  ).c;
  const totalDays = (
    db.prepare('SELECT COUNT(DISTINCT entry_date) as c FROM entries').get() as { c: number }
  ).c;
  const totalPhotos = (
    db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }
  ).c;

  // Compute current streak ending today or yesterday
  const dates = (
    db
      .prepare('SELECT DISTINCT entry_date FROM entries ORDER BY entry_date DESC')
      .all() as { entry_date: string }[]
  ).map((d) => d.entry_date);

  let streak = 0;
  if (dates.length > 0) {
    const today = new Date();
    const toYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    const todayStr = toYmd(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toYmd(yesterday);

    let cursor: Date | null = null;
    if (dates[0] === todayStr) {
      cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    } else if (dates[0] === yesterdayStr) {
      cursor = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    }

    const dateSet = new Set(dates);
    while (cursor && dateSet.has(toYmd(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  res.json({ totalEntries, totalDays, totalPhotos, streak });
});

// GET /api/entries/tags
router.get('/tags', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT t.name, COUNT(et.entry_id) as count
       FROM tags t
       JOIN entry_tags et ON et.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC, t.name ASC`
    )
    .all();
  res.json({ tags: rows });
});

// GET /api/entries/calendar?year=2026&month=11
router.get('/calendar', (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const rows = db
    .prepare(
      `SELECT
         e.entry_date as date,
         COUNT(DISTINCT e.id) as count,
         GROUP_CONCAT(DISTINCT e.mood) as moods,
         COUNT(DISTINCT p.id) as photoCount
       FROM entries e
       LEFT JOIN photos p ON p.entry_id = e.id
       WHERE substr(e.entry_date, 1, 7) = ?
       GROUP BY e.entry_date
       ORDER BY e.entry_date ASC`
    )
    .all(prefix) as {
    date: string;
    count: number;
    moods: string | null;
    photoCount: number;
  }[];

  const days: Record<
    string,
    { date: string; count: number; moods: string[]; photoCount: number }
  > = {};
  for (const r of rows) {
    days[r.date] = {
      date: r.date,
      count: r.count,
      moods: r.moods ? r.moods.split(',').filter(Boolean) : [],
      photoCount: r.photoCount,
    };
  }

  res.json({ year, month, days });
});

// GET /api/entries/on-this-day?date=YYYY-MM-DD
router.get('/on-this-day', (req, res) => {
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const dateStr =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : defaultDate;

  const year = dateStr.slice(0, 4);
  const mmdd = dateStr.slice(5, 10); // MM-DD

  const pastYearRows = db
    .prepare(
      `SELECT * FROM entries
       WHERE substr(entry_date, 6, 5) = ? AND substr(entry_date, 1, 4) < ?
       ORDER BY entry_date DESC, entry_time DESC`
    )
    .all(mmdd, year) as EntryRow[];

  // Also check 1 month ago if pastYears is empty, so newer journals still get a throwback
  let recentThrowback: ReturnType<typeof hydrateEntries> = [];
  let recentLabel = '';
  if (pastYearRows.length === 0) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const oneMonthAgo = new Date(y, m - 2, d);
    const monthAgoStr = `${oneMonthAgo.getFullYear()}-${String(
      oneMonthAgo.getMonth() + 1
    ).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

    const monthAgoRows = db
      .prepare(
        `SELECT * FROM entries WHERE entry_date = ? ORDER BY entry_time DESC`
      )
      .all(monthAgoStr) as EntryRow[];

    if (monthAgoRows.length > 0) {
      recentThrowback = hydrateEntries(monthAgoRows);
      recentLabel = 'One month ago';
    }
  }

  res.json({
    date: dateStr,
    entries: hydrateEntries(pastYearRows),
    recentThrowback,
    recentLabel,
  });
});

// GET /api/entries
router.get('/', (req, res) => {
  const { date, month, search, tag, mood, limit = '50', offset = '0' } = req.query as Record<
    string,
    string | undefined
  >;

  const where: string[] = [];
  const params: unknown[] = [];

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.push('e.entry_date = ?');
    params.push(date);
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.push('substr(e.entry_date, 1, 7) = ?');
    params.push(month);
  }
  if (mood) {
    where.push('e.mood = ?');
    params.push(mood);
  }
  if (tag) {
    where.push(
      `EXISTS (
         SELECT 1 FROM entry_tags et
         JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id = e.id AND t.name = ?
       )`
    );
    params.push(tag.toLowerCase());
  }
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    where.push(
      `(e.title LIKE ? OR e.content LIKE ? OR e.prompt_text LIKE ? OR EXISTS (
         SELECT 1 FROM entry_tags et
         JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id = e.id AND t.name LIKE ?
       ))`
    );
    params.push(q, q, q, q);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const rows = db
    .prepare(
      `SELECT e.* FROM entries e
       ${whereSql}
       ORDER BY e.entry_date DESC, e.entry_time DESC, e.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, lim, off) as EntryRow[];

  const total = (
    db
      .prepare(`SELECT COUNT(*) as c FROM entries e ${whereSql}`)
      .get(...params) as { c: number }
  ).c;

  res.json({ entries: hydrateEntries(rows), total });
});

// GET /api/entries/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as
    | EntryRow
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Entry not found.' });
    return;
  }
  res.json({ entry: hydrateEntries([row])[0] });
});

// POST /api/entries
router.post('/', (req, res) => {
  const {
    title = '',
    content = '',
    entry_date,
    entry_time,
    mood = null,
    energy = null,
    prompt_id = null,
    prompt_text = null,
    tags = [],
  } = req.body as {
    title?: string;
    content?: string;
    entry_date?: string;
    entry_time?: string;
    mood?: string | null;
    energy?: number | null;
    prompt_id?: number | null;
    prompt_text?: string | null;
    tags?: string[];
  };

  const now = new Date();
  const dateVal =
    entry_date && /^\d{4}-\d{2}-\d{2}$/.test(entry_date)
      ? entry_date
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate()
        ).padStart(2, '0')}`;
  const timeVal =
    entry_time && /^\d{2}:\d{2}$/.test(entry_time)
      ? entry_time
      : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const id = uuidv4();
  const timestamp = `${dateVal}T${timeVal}:00`;

  db.prepare(
    `INSERT INTO entries (id, title, content, entry_date, entry_time, entry_timestamp, mood, energy, prompt_id, prompt_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    String(title).trim(),
    String(content),
    dateVal,
    timeVal,
    timestamp,
    mood || null,
    energy !== null && energy !== undefined ? Number(energy) : null,
    prompt_id || null,
    prompt_text || null
  );

  syncTags(id, tags);

  const created = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as EntryRow;
  res.status(201).json({ entry: hydrateEntries([created])[0] });
});

// PUT /api/entries/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as
    | EntryRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Entry not found.' });
    return;
  }

  const {
    title = existing.title,
    content = existing.content,
    entry_date = existing.entry_date,
    entry_time = existing.entry_time,
    mood = existing.mood,
    energy = existing.energy,
    prompt_id = existing.prompt_id,
    prompt_text = existing.prompt_text,
    tags,
  } = req.body as {
    title?: string;
    content?: string;
    entry_date?: string;
    entry_time?: string;
    mood?: string | null;
    energy?: number | null;
    prompt_id?: number | null;
    prompt_text?: string | null;
    tags?: string[];
  };

  const timestamp = `${entry_date}T${entry_time}:00`;

  db.prepare(
    `UPDATE entries
     SET title = ?, content = ?, entry_date = ?, entry_time = ?, entry_timestamp = ?,
         mood = ?, energy = ?, prompt_id = ?, prompt_text = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(title).trim(),
    String(content),
    entry_date,
    entry_time,
    timestamp,
    mood || null,
    energy !== null && energy !== undefined ? Number(energy) : null,
    prompt_id || null,
    prompt_text || null,
    existing.id
  );

  if (tags !== undefined) {
    syncTags(existing.id, tags);
  }

  const updated = db.prepare('SELECT * FROM entries WHERE id = ?').get(existing.id) as EntryRow;
  res.json({ entry: hydrateEntries([updated])[0] });
});

// DELETE /api/entries/:id
router.delete('/:id', (req, res) => {
  const photos = db
    .prepare('SELECT filename, thumb_filename FROM photos WHERE entry_id = ?')
    .all(req.params.id) as { filename: string; thumb_filename: string | null }[];

  const result = db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Entry not found.' });
    return;
  }

  for (const p of photos) {
    try {
      fs.unlinkSync(path.join(UPLOADS_DIR, p.filename));
    } catch {
      // ignore missing file
    }
    if (p.thumb_filename) {
      try {
        fs.unlinkSync(path.join(THUMBS_DIR, p.thumb_filename));
      } catch {
        // ignore missing file
      }
    }
  }

  res.json({ ok: true });
});

export default router;
