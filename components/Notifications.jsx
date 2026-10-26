'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The bell: the signed-in person's notifications (assigned to them, comments on their tasks, reviews for admins, a task they added closed,
// new teammates for admins), plus their own tasks that are overdue or due today (worked out from the board, not stored). Clicking one opens
// its task and marks it read. Checked every minute and when the tab comes back.
const ago = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const ICON = { assigned: '👤', comment: '💬', review: '👀', done: '✓', team: '➕', due: '⏰', overdue: '⚠️' };

export default function Notifications({ user, reminders, onOpenTask }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const load = useCallback(async () => {
    if (user.local) return;
    const res = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setItems((await res.json()).notifications);
  }, [user.local]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const read = (ids) => fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids === 'all' ? { all: true } : { ids }) }).catch(() => {});
  const unread = items.filter((n) => !n.read_at);
  const count = unread.length + reminders.length;

  const click = (n) => {
    if (!n.read_at && n.id) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      read([n.id]);
    }
    setOpen(false);
    if (n.task_id) onOpenTask(n.task_id);
  };
  const markAll = () => {
    setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    read('all');
  };

  return (
    <div className="bell-wrap" ref={box}>
      <button className="bell" aria-label={`Notifications${count ? `, ${count} new` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <b>Notifications</b>
            {unread.length > 0 && (
              <button className="link small" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {reminders.length > 0 && (
            <ul className="bell-list">
              {reminders.map((r) => (
                <li key={`r-${r.task_id}`}>
                  <button className="bell-item unread" onClick={() => click(r)}>
                    <span aria-hidden="true">{ICON[r.kind]}</span>
                    <span>
                      {r.text}
                      <span className="muted small"> · your task</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.length === 0 && reminders.length === 0 ? (
            <p className="muted small bell-empty">{user.local ? 'Notifications start once team sign-in is set up.' : 'Nothing new.'}</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button className={'bell-item' + (n.read_at ? '' : ' unread')} onClick={() => click(n)}>
                    <span aria-hidden="true">{ICON[n.kind] || '•'}</span>
                    <span>
                      {n.text}
                      <span className="muted small"> · {ago(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
