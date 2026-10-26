'use client';

import { useEffect, useRef, useState } from 'react';
import { AREAS, PRIORITIES, REPEATS, STATUSES } from '@/lib/areas';

// Add or edit a task, in a native <dialog> (Escape closes it, focus stays inside). Delete asks first.
export default function TaskDialog({ task, owners, onClose, onSave, onDelete }) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => ({ ...task, due: task.due || '', repeat: task.repeat || '', link: task.link || '', notes: task.notes || '', owner: task.owner || '' }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.open && d.close();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    const { title, area, status, priority, owner, due, repeat, link, notes } = form;
    await onSave({ title, area, status, priority, owner, due, repeat, link, notes });
    setBusy(false);
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="dlgTitle">
      <form className="form" onSubmit={submit}>
        <h2 id="dlgTitle">{task.new ? 'New task' : 'Edit task'}</h2>
        <label>
          Task
          <input value={form.title} onChange={set('title')} required maxLength={200} autoFocus placeholder="What needs doing?" />
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
        <div className="row">
          <label>
            Owner
            <input value={form.owner} onChange={set('owner')} list="owners" maxLength={60} placeholder="Who’s on it" />
            <datalist id="owners">
              {owners.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
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
        <div className="dialog-actions">
          {!task.new && onDelete && (
            <button type="button" className="btn btn-danger" onClick={() => window.confirm('Delete this task for good?') && onDelete()}>
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
    </dialog>
  );
}
