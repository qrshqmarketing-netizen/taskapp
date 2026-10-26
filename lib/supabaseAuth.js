// Supabase Auth over plain REST (no client library): magic-link sign-in and the team list (admins and members).
// Server-only: it uses the secret key. The team role lives in the user's app_metadata as `tasks_role` ('admin' or 'member'), which only the
// secret key can change. It is deliberately NOT `role`: the website's /admin/ dashboard (same Supabase project) uses `role`, so giving someone
// task access never lets them into the website dashboard, and the other way round.

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
export const authEnabled = Boolean(URL_ && SECRET && PUBLISHABLE);

export const ROLES = ['admin', 'member'];
export const roleOf = (user) => (ROLES.includes(user?.app_metadata?.tasks_role) && !(user.banned_until && Date.parse(user.banned_until) > Date.now()) ? user.app_metadata.tasks_role : '');
export const nameOf = (user) => String(user?.user_metadata?.name || user?.user_metadata?.full_name || '').trim() || String(user?.email || '').split('@')[0];

// The new sb_publishable_ / sb_secret_ keys go in `apikey` only; the older JWT keys (eyJ...) also as a Bearer token
const headers = (key, extra = {}) => ({ apikey: key, ...(key.startsWith('eyJ') && { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json', ...extra });

async function call(path, { key = SECRET, method = 'GET', body, query = '' } = {}) {
  const res = await fetch(`${URL_}/auth/v1/${path}${query}`, { method, headers: headers(key), body: body && JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const err = new Error(data?.msg || data?.message || data?.error_description || `Supabase Auth ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Emails a sign-in link. create_user false: only people already on the team (or in TASKS_ADMIN_EMAILS) can get one.
// redirectTo must be listed under Authentication -> URL Configuration -> Redirect URLs, and the Magic Link email template must use it (README).
export const sendMagicLink = (email, redirectTo) =>
  call('otp', { key: PUBLISHABLE, method: 'POST', body: { email, create_user: false }, query: `?redirect_to=${encodeURIComponent(redirectTo)}` });

// Checks the link's token_hash and returns the signed-in Supabase user
export async function verifyLink(tokenHash, type = 'email') {
  const data = await call('verify', { key: PUBLISHABLE, method: 'POST', body: { type, token_hash: tokenHash } });
  return data?.user || null;
}

export const getUser = (id) => call(`admin/users/${encodeURIComponent(id)}`);

export async function listUsers() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const data = await call('admin/users', { query: `?page=${page}&per_page=200` });
    const users = data?.users || [];
    all.push(...users);
    if (users.length < 200) break;
  }
  return all;
}

export const findUserByEmail = async (email) => (await listUsers()).find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;

// A new person: a confirmed account (no password; they sign in by magic link) with their task role
export const createUser = (email, name, role) =>
  call('admin/users', { method: 'POST', body: { email, email_confirm: true, app_metadata: { tasks_role: role }, user_metadata: { name } } });

// app_metadata is merged, so this only touches tasks_role (a website dashboard role stays as it is). 'none' = no task access.
export const setTasksRole = (id, role) => call(`admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: { app_metadata: { tasks_role: role } } });
export const setName = (id, name) => call(`admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: { user_metadata: { name } } });

// Emails that are always admins (env TASKS_ADMIN_EMAILS, comma-separated): how the first admin gets in. Their account is made, or given the
// admin role, the first time they ask for a link.
export const bootstrapAdmins = () => (process.env.TASKS_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
