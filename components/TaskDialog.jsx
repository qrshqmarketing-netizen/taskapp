'use client';

import { useEffect, useRef, useState } from 'react';
import { AREAS, DISPOSITIONS, PRIORITIES, REPEATS, STATUSES } from '@/lib/areas';
import Comments from './Comments';

// Add or edit a task, in a native <dialog> (Escape closes it, focus stays inside). With a team (Supabase sign-in) the owner is picked from
// the team, which is what sends them a notification; locally it is free text. Marking it Done asks how it ended (the disposition).
// An existing task shows its comment thread under the form. Delete asks first and only shows for those allowed to delete.
export default function TaskDialog({ task, owners, team = [], user, onClose, onSave, onDelete }) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => ({
    ...task,
    due: task.due || '',
    repeat: task.repeat || '',
    link: task.link || '',
    notes: task.notes || '',
    owner: task.owner || '',
    assignee_id: task.assignee_id || '',
    disposition: task.disposition || '',
    disposition_note: task.disposition_note || '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.open && d.close();
  }, []);

  const pickAssignee = (e) => {
    const id = e.target.value;
    setForm((f) => ({ ...f, assignee_id: id, owner: team.find((m) => m.id === id)?.name || '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    const { title, area, status, priority, owner, assignee_id, due, repeat, link, notes, disposition, disposition_note } = form;
    const done = status === 'done';
    await onSave({
      title, area, status, priority, owner, due, repeat, link, notes,
      ...(team.length && { assignee_id: assignee_id || null }),
      disposition: done ? disposition || 'completed' : '',
      disposition_note: done ? disposition_note : '',
    });
    setBusy(false);
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="dlgTitle">
      <form className="form" onSubmit={submit}>
        <h2 id="dlgTitle">{task.new ? 'New task' : 'Edit task'}</h2>
        <label>
          Task
          <input value={form.title} onChange={set('title')} required maxLength={200} autoFocus={task.new} placeholder="What needs doing?" />
        </label>
        <div className="row">
          <label>
            Area
            <select value={form.area} onChange={set('area')}>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.status === 'done' && (
          <div className="row disposition">
            <label>
              Disposition <span className="muted">(how it ended)</span>
              <select value={form.disposition || 'completed'} onChange={set('disposition')}>
                {DISPOSITIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Outcome note <span className="muted">(optional)</span>
              <input value={form.disposition_note} onChange={set('disposition_note')} maxLength={500} placeholder="e.g. posted to all 3 listings" />
            </label>
          </div>
        )}

        <div className="row">
          {team.length ? (
            <label>
              Assigned to
              <select value={form.assignee_id} onChange={pickAssignee}>
                <option value="">Nobody yet</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.id === user?.id ? ' (me)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Owner
              <input value={form.owner} onChange={set('owner')} list="owners" maxLength={60} placeholder="Who’s on it" />
              <datalist id="owners">
                {owners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </label>
          )}
          <label>
            Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label>
            Due / publish date
            <input type="date" value={form.due} onChange={set('due')} />
          </label>
          <label>
            Repeats
            <select value={form.repeat} onChange={set('repeat')}>
              {REPEATS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Link <span className="muted">(the post, page, listing or doc)</span>
          <input type="url" value={form.link} onChange={set('link')} placeholder="https://" />
        </label>
        {form.link && /^https?:\/\//.test(form.link) && (
          <a className="open-link" href={form.link} target="_blank" rel="noopener noreferrer">
            Open link ↗
          </a>
        )}
        <label>
          Notes
          <textarea value={form.notes} onChange={set('notes')} rows={4} maxLength={4000} placeholder="Details, copy, checklist…" />
        </label>
        {form.repeat && <p className="muted small">When this is marked Done, the next one is added with the due date moved on.</p>}
        {!task.new && task.created_by && <p className="muted small">Added by {task.created_by}.</p>}
        <div className="dialog-actions">
          {!task.new && onDelete && (
            <button type="button" className="btn btn-danger" onClick={() => window.confirm('Delete this task and its comments for good?') && onDelete()}>
              Delete
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : task.new ? 'Add task' : 'Save'}
          </button>
        </div>
      </form>
      {!task.new && <Comments taskId={task.id} user={user} />}
    </dialog>
  );
}
