import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

interface PromptRow {
  id: number;
  category: string;
  question: string;
  is_custom: number;
  is_active: number;
  created_at: string;
}

function dateHash(dateStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// GET /api/prompts/today?date=YYYY-MM-DD&offset=0
router.get('/today', (req, res) => {
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const dateStr =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : defaultDate;
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const prompts = db
    .prepare('SELECT * FROM prompts WHERE is_active = 1 ORDER BY id ASC')
    .all() as PromptRow[];

  if (prompts.length === 0) {
    res.json({ prompt: null });
    return;
  }

  // Use a prime stride on offset so shuffling jumps across categories naturally
  const baseIndex = dateHash(dateStr) % prompts.length;
  const idx = (baseIndex + offset * 7) % prompts.length;

  res.json({ prompt: prompts[idx], totalPrompts: prompts.length });
});

// GET /api/prompts
router.get('/', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const rows = category
    ? db
        .prepare('SELECT * FROM prompts WHERE is_active = 1 AND category = ? ORDER BY is_custom DESC, id ASC')
        .all(category)
    : db
        .prepare('SELECT * FROM prompts WHERE is_active = 1 ORDER BY is_custom DESC, category ASC, id ASC')
        .all();

  const categories = (
    db
      .prepare('SELECT DISTINCT category FROM prompts WHERE is_active = 1 ORDER BY category ASC')
      .all() as { category: string }[]
  ).map((c) => c.category);

  res.json({ prompts: rows, categories });
});

// POST /api/prompts
router.post('/', (req, res) => {
  const { category = 'Personal', question } = req.body as {
    category?: string;
    question?: string;
  };
  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    res.status(400).json({ error: 'Please write a question of at least 5 characters.' });
    return;
  }

  try {
    const info = db
      .prepare('INSERT INTO prompts (category, question, is_custom) VALUES (?, ?, 1)')
      .run(String(category).trim() || 'Personal', question.trim());
    const created = db
      .prepare('SELECT * FROM prompts WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ prompt: created });
  } catch {
    res.status(409).json({ error: 'That question already exists in your library.' });
  }
});

// DELETE /api/prompts/:id
router.delete('/:id', (req, res) => {
  const row = db
    .prepare('SELECT id, is_custom FROM prompts WHERE id = ?')
    .get(req.params.id) as { id: number; is_custom: number } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Prompt not found.' });
    return;
  }

  if (row.is_custom) {
    db.prepare('DELETE FROM prompts WHERE id = ?').run(row.id);
  } else {
    db.prepare('UPDATE prompts SET is_active = 0 WHERE id = ?').run(row.id);
  }

  res.json({ ok: true });
});

export default router;
