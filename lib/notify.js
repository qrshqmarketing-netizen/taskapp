import { insert, select, update } from './db';
import { authEnabled, listUsers, roleOf, nameOf } from './supabaseAuth';

// In-app notifications, one row per person (team_notifications), shown under the bell for whoever is signed in.
// Who gets what: the assignee when a task is assigned to them; the assignee, the person who added the task and earlier commenters on a new
// comment; admins (by role) when a task goes to "Waiting / review" and when someone joins the team; the person who added a task when someone
// else closes it. Nobody is notified about their own action. Without Supabase sign-in (local mode) nothing is stored.
const TABLE = 'team_notifications';

let teamCache = { at: 0, users: [] };
export async function teamMembers() {
  if (!authEnabled) return [];
  if (Date.now() - teamCache.at < 60000) return teamCache.users;
  const users = (await listUsers()).filter((u) => roleOf(u)).map((u) => ({ id: u.id, name: nameOf(u), email: u.email, role: roleOf(u) }));
  teamCache = { at: Date.now(), users };
  return users;
}
export const forgetTeam = () => (teamCache = { at: 0, users: [] });
export const adminIds = async () => (await teamMembers()).filter((u) => u.role === 'admin').map((u) => u.id);

export async function notify(userIds, { kind, text, task_id = null, actor }) {
  if (!authEnabled) return;
  const to = [...new Set(userIds.filter(Boolean))].filter((id) => id !== actor?.id && id !== 'local');
  if (!to.length) return;
  try {
    await insert(TABLE, to.map((user_id) => ({ user_id, kind, text: String(text).slice(0, 300), task_id, actor_name: actor?.name || '' })));
  } catch {
    // a notification that can't be saved never stops the change itself
  }
}

export const myNotifications = (userId) => select(TABLE, { where: { user_id: userId }, order: 'created_at.desc', limit: 50 });

export async function markRead(userId, ids) {
  const now = new Date().toISOString();
  if (ids === 'all') return update(TABLE, { user_id: userId, read_at: null }, { read_at: now });
  for (const id of ids.slice(0, 100)) await update(TABLE, { id, user_id: userId }, { read_at: now });
}
