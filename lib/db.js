import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// A small table layer used by tasks, comments and notifications: the Supabase tables (scripts/supabase-tasks.sql) over REST with the secret
// key when SUPABASE_URL and SUPABASE_SECRET_KEY are set, else one JSON file per table in data/ (this computer only, not in git).
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const usingSupabase = Boolean(URL_ && KEY);
export const storageName = usingSupabase ? 'Supabase (shared)' : 'This computer only';

const keyHeaders = { apikey: KEY, ...(KEY.startsWith('eyJ') && { Authorization: `Bearer ${KEY}` }) };

async function rest(pathAndQuery, options = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, {
    ...options,
    headers: { ...keyHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

const file = (table) => path.join(process.cwd(), 'data', `${table}.local.json`);
async function readAll(table) {
  try {
    return JSON.parse(await fs.readFile(file(table), 'utf8'));
  } catch {
    return [];
  }
}
async function writeAll(table, rows) {
  if (process.env.VERCEL) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel: the board cannot save files there.');
  await fs.mkdir(path.dirname(file(table)), { recursive: true });
  await fs.writeFile(file(table), JSON.stringify(rows, null, 2));
}

const matches = (row, where) => Object.entries(where).every(([k, v]) => (v === null ? row[k] == null : row[k] === v));
const qs = (where) => Object.entries(where).map(([k, v]) => (v === null ? `${k}=is.null` : `${k}=eq.${encodeURIComponent(v)}`));

// select('team_task_comments', { where: { task_id: id }, order: 'created_at.asc', limit: 200 })
export async function select(table, { where = {}, order = 'created_at.asc', limit = 5000 } = {}) {
  if (usingSupabase) return rest(`${table}?${['select=*', ...qs(where), `order=${order}`, `limit=${limit}`].join('&')}`);
  const [col, dir] = order.split('.');
  const rows = (await readAll(table)).filter((r) => matches(r, where));
  rows.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (dir === 'desc' ? -1 : 1));
  return rows.slice(0, limit);
}

export async function insert(table, rows) {
  if (!rows.length) return [];
  if (usingSupabase) return rest(table, { method: 'POST', body: JSON.stringify(rows) });
  const now = new Date().toISOString();
  const made = rows.map((r) => ({ id: crypto.randomUUID(), created_at: now, updated_at: now, ...r }));
  await writeAll(table, [...(await readAll(table)), ...made]);
  return made;
}

// Updates the rows matching `where` (usually { id }) and returns them
export async function update(table, where, changes) {
  if (usingSupabase) return rest(`${table}?${qs(where).join('&')}`, { method: 'PATCH', body: JSON.stringify(changes) });
  const all = await readAll(table);
  const changed = [];
  const next = all.map((r) => (matches(r, where) ? (changed.push({ ...r, ...changes }), { ...r, ...changes }) : r));
  await writeAll(table, next);
  return changed;
}

export async function remove(table, where) {
  if (usingSupabase) return rest(`${table}?${qs(where).join('&')}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await writeAll(table, (await readAll(table)).filter((r) => !matches(r, where)));
}
