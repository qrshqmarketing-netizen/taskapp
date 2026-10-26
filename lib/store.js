import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AREA_IDS, PRIORITY_IDS, REPEAT_IDS, STATUS_IDS, nextDue } from './areas';

// Where the tasks live: the Supabase table `team_tasks` (scripts/supabase-tasks.sql) when SUPABASE_URL and SUPABASE_SECRET_KEY are set, so
// everyone on the shared Vercel link sees the same board; otherwise a JSON file on this computer (data/tasks.local.json, not in git).
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const usingSupabase = Boolean(URL_ && KEY);
export const storageName = usingSupabase ? 'Supabase (shared)' : 'This computer only';
const FILE = path.join(process.cwd(), 'data', 'tasks.local.json');

const FIELDS = ['title', 'area', 'status', 'priority', 'owner', 'due', 'repeat', 'link', 'notes'];
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

// Only known fields, trimmed and checked; `partial` leaves out what wasn't sent (for edits)
export function cleanTask(input = {}, partial = false) {
  const out = {};
  const has = (k) => !partial || Object.prototype.hasOwnProperty.call(input, k);
  if (has('title')) out.title = clip(input.title, 200);
  if (has('area')) out.area = pick(input.area, AREA_IDS, 'website');
  if (has('status')) out.status = pick(input.status, STATUS_IDS, 'todo');
  if (has('priority')) out.priority = pick(input.priority, PRIORITY_IDS, 'normal');
  if (has('owner')) out.owner = clip(input.owner, 60);
  if (has('due')) out.due = isDate(input.due) ? input.due : null;
  if (has('repeat')) out.repeat = pick(input.repeat || '', REPEAT_IDS, '');
  if (has('link')) out.link = /^https?:\/\//i.test(input.link || '') ? clip(input.link, 500) : '';
  if (has('notes')) out.notes = clip(input.notes, 4000);
  return out;
}

async function rest(pathAndQuery, options = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, {
    ...options,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

async function readFile() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    return [];
  }
}
async function writeFile(tasks) {
  if (process.env.VERCEL) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel: the board cannot save files there.');
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(tasks, null, 2));
}

export async function listTasks() {
  if (usingSupabase) return rest('team_tasks?select=*&order=created_at.asc&limit=5000');
  return readFile();
}

export async function createTasks(inputs, by = '') {
  const now = new Date().toISOString();
  const rows = inputs.map((t) => ({ ...cleanTask(t), created_by: clip(by, 60), done_at: t.status === 'done' ? now : null })).filter((t) => t.title);
  if (!rows.length) throw new Error('A task needs a title.');
  if (usingSupabase) return rest('team_tasks', { method: 'POST', body: JSON.stringify(rows) });
  const tasks = await readFile();
  const made = rows.map((r) => ({ id: crypto.randomUUID(), created_at: now, updated_at: now, ...r }));
  await writeFile([...tasks, ...made]);
  return made;
}

// Saves an edit. A repeating task marked Done also makes its next copy (same task, next due date, back to To do); both come back.
export async function updateTask(id, input) {
  const changes = cleanTask(input, true);
  if ('title' in changes && !changes.title) throw new Error('A task needs a title.');
  const now = new Date().toISOString();
  const before = await getTask(id);
  if (!before) throw new Error('That task no longer exists.');
  if (changes.status) changes.done_at = changes.status === 'done' ? before.done_at || now : null;
  changes.updated_at = now;

  let saved;
  if (usingSupabase) [saved] = await rest(`team_tasks?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });
  else {
    const tasks = await readFile();
    saved = { ...before, ...changes };
    await writeFile(tasks.map((t) => (t.id === id ? saved : t)));
  }

  let next = null;
  if (saved.status === 'done' && before.status !== 'done' && saved.repeat) {
    const { title, area, priority, owner, repeat, link, notes } = saved;
    [next] = await createTasks([{ title, area, priority, owner, repeat, link, notes, status: 'todo', due: nextDue(saved.due, repeat) }], saved.created_by);
  }
  return { task: saved, next };
}

export async function getTask(id) {
  if (usingSupabase) return (await rest(`team_tasks?id=eq.${encodeURIComponent(id)}&select=*`))[0] || null;
  return (await readFile()).find((t) => t.id === id) || null;
}

export async function deleteTask(id) {
  if (usingSupabase) return rest(`team_tasks?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await writeFile((await readFile()).filter((t) => t.id !== id));
}
