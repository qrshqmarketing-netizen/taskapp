import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { authEnabled, getUser, nameOf, roleOf } from './supabaseAuth';

// Sessions: after a magic link is verified (app/auth/confirm), the app sets its own signed cookie (30 days) with the person's Supabase id.
// Every request re-reads that person from Supabase (cached for a minute), so a changed role or removed access applies within a minute.
// Without Supabase Auth configured: on your own computer the board opens as a local admin; on Vercel everything stays locked.
export const COOKIE = 'qrs_tasks';
const DAYS = 30;
const onVercel = () => Boolean(process.env.VERCEL);
const DEV_SECRET = crypto.randomBytes(32).toString('hex'); // local only, when SESSION_SECRET is unset (sessions end when the server restarts)
const secret = () => process.env.SESSION_SECRET || (onVercel() ? '' : DEV_SECRET);

const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + DAYS * 864e5 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(value) {
  if (!value || !secret()) return null;
  const [payload, mac] = String(value).split('.');
  if (!payload || !mac) return null;
  const good = sign(payload);
  if (good.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(mac))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() && data.id ? data : null;
  } catch {
    return null;
  }
}

export const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DAYS * 86400 };

// { id, email, name, role } for a Supabase user with task access, else null
export const toMember = (user) => {
  const role = roleOf(user);
  return role ? { id: user.id, email: user.email || '', name: nameOf(user), role } : null;
};

const cache = new Map(); // id -> { at, member }
async function memberById(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 60000) return hit.member;
  let member = null;
  try {
    member = toMember(await getUser(id));
  } catch (err) {
    if (err.status && err.status < 500) member = null; // deleted or unknown
    else if (hit) return hit.member; // Supabase briefly unreachable: keep the last answer
  }
  cache.set(id, { at: Date.now(), member });
  return member;
}
export const forgetMember = (id) => cache.delete(id);

export const localMode = () => !authEnabled && !onVercel();

// Open board (owner, October 26 2026: "without login, anyone can see it with the url and add tasks"): unless REQUIRE_LOGIN=true, nobody signs
// in and everyone can view, add, edit and delete. Each person types their name once (the `qrs_name` cookie, set in the browser); it is used as
// the author of their comments and tasks and for "My tasks". The magic-link sign-in and roles below come back with REQUIRE_LOGIN=true.
export const openAccess = () => process.env.REQUIRE_LOGIN !== 'true';
export const NAME_COOKIE = 'qrs_name';

// The signed-in team member ({ id, email, name, role }), or null
export async function currentUser() {
  if (openAccess() || localMode()) {
    let name = '';
    try {
      name = decodeURIComponent((await cookies()).get(NAME_COOKIE)?.value || '').replace(/[<>]/g, '').trim().slice(0, 40);
    } catch {}
    return { id: 'local', email: '', name, role: 'admin', local: true, open: openAccess() };
  }
  if (!authEnabled || !secret()) return null;
  const session = readSession((await cookies()).get(COOKIE)?.value);
  return session ? memberById(session.id) : null;
}
