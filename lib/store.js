import { insert, remove, select, update } from './db';
import { AREA_IDS, DISPOSITION_IDS, PRIORITY_IDS, REPEAT_IDS, STATUS_IDS, dispositionName, nextDue } from './areas';
import { adminIds, notify } from './notify';
export { storageName, usingSupabase } from './db';

// Tasks (team_tasks) and their comments (team_task_comments): reading, adding, changing and deleting, with the notifications each change sends.
const TASKS = 'team_tasks';
const COMMENTS = 'team_task_comments';

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
  if (has('assignee_id')) out.assignee_id = /^[0-9a-f-]{36}$/i.test(input.assignee_id || '') ? input.assignee_id : null;
  if (has('due')) out.due = isDate(input.due) ? input.due : null;
  if (has('repeat')) out.repeat = pick(input.repeat || '', REPEAT_IDS, '');
  if (has('link')) out.link = /^https?:\/\//i.test(input.link || '') ? clip(input.link, 500) : '';
  if (has('notes')) out.notes = clip(input.notes, 4000);
  if (has('disposition')) out.disposition = pick(input.disposition || '', ['', ...DISPOSITION_IDS], '');
  if (has('disposition_note')) out.disposition_note = clip(input.disposition_note, 500);
  return out;
}

const q = (t) => `“${t.title}”`;

export const listTasks = () => select(TASKS, { order: 'created_at.asc' });
export const getTask = async (id) => (await select(TASKS, { where: { id }, limit: 1 }))[0] || null;

// actor: the signed-in person ({ id, name, email, role })
export async function createTasks(inputs, actor) {
  const now = new Date().toISOString();
  const rows = inputs
    .map((t) => {
      const row = cleanTask(t);
      if (row.status === 'done') row.disposition ||= 'completed';
      return { ...row, created_by: clip(actor?.email || actor?.name, 60), created_by_id: actor?.id && actor.id !== 'local' ? actor.id : null, done_at: row.status === 'done' ? now : null };
    })
    .filter((t) => t.title);
  if (!rows.length) throw new Error('A task needs a title.');
  const made = await insert(TASKS, rows);
  for (const t of made) if (t.assignee_id) await notify([t.assignee_id], { kind: 'assigned', text: `${actor?.name || 'Someone'} assigned you ${q(t)}`, task_id: t.id, actor });
  return made;
}

// Saves an edit. A repeating task marked Done also makes its next copy (same task, next due date, back to To do); both come back.
export async function updateTask(id, input, actor) {
  const changes = cleanTask(input, true);
  if ('title' in changes && !changes.title) throw new Error('A task needs a title.');
  const before = await getTask(id);
  if (!before) throw new Error('That task no longer exists.');
  const now = new Date().toISOString();
  if (changes.status) {
    changes.done_at = changes.status === 'done' ? before.done_at || now : null;
    if (changes.status === 'done' && !changes.disposition && !before.disposition) changes.disposition = 'completed';
    if (changes.status !== 'done') Object.assign(changes, { disposition: '', disposition_note: '' });
  }
  changes.updated_at = now;
  const [saved] = await update(TASKS, { id }, changes);

  const who = actor?.name || 'Someone';
  if (saved.assignee_id && saved.assignee_id !== before.assignee_id) await notify([saved.assignee_id], { kind: 'assigned', text: `${who} assigned you ${q(saved)}`, task_id: id, actor });
  if (saved.status === 'review' && before.status !== 'review') await notify(await adminIds(), { kind: 'review', text: `${q(saved)} is waiting for review (${who})`, task_id: id, actor });
  if (saved.status === 'done' && before.status !== 'done')
    await notify([saved.created_by_id, saved.assignee_id], { kind: 'done', text: `${who} closed ${q(saved)}: ${dispositionName(saved.disposition) || 'Completed'}`, task_id: id, actor });

  let next = null;
  if (saved.status === 'done' && before.status !== 'done' && saved.repeat) {
    const { title, area, priority, owner, assignee_id, repeat, link, notes } = saved;
    [next] = await insert(TASKS, [{ title, area, priority, owner, assignee_id, repeat, link, notes, status: 'todo', due: nextDue(saved.due, repeat), created_by: saved.created_by, created_by_id: saved.created_by_id }]);
  }
  return { task: saved, next };
}

export async function deleteTask(id) {
  await remove(COMMENTS, { task_id: id }); // Supabase also cascades; the local files don't
  await remove(TASKS, { id });
}

// Comments
export const listComments = (taskId) => select(COMMENTS, { where: { task_id: taskId }, order: 'created_at.asc', limit: 500 });
export const getComment = async (id) => (await select(COMMENTS, { where: { id }, limit: 1 }))[0] || null;

export async function addComment(taskId, body, actor) {
  const text = clip(body, 4000);
  if (!text) throw new Error('Write something first.');
  const task = await getTask(taskId);
  if (!task) throw new Error('That task no longer exists.');
  const [comment] = await insert(COMMENTS, [{ task_id: taskId, body: text, author_id: actor.id === 'local' ? null : actor.id, author_name: actor.name || actor.email || 'Me' }]);
  const earlier = (await listComments(taskId)).map((c) => c.author_id);
  await notify([task.assignee_id, task.created_by_id, ...earlier], { kind: 'comment', text: `${actor.name || 'Someone'} commented on ${q(task)}: ${text.slice(0, 120)}`, task_id: taskId, actor });
  return comment;
}

export async function editComment(id, body) {
  const text = clip(body, 4000);
  if (!text) throw new Error('A comment can’t be empty.');
  const [saved] = await update(COMMENTS, { id }, { body: text, updated_at: new Date().toISOString() });
  return saved;
}

export const deleteComment = (id) => remove(COMMENTS, { id });
