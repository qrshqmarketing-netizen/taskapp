'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AREAS, PRIORITIES, STARTER_TASKS, STATUSES, areaName, areaOf, dispositionName } from '@/lib/areas';
import TaskDialog from './TaskDialog';
import Notifications from './Notifications';
import Calendar from './Calendar';
import { Card, addDays, shortDate, today } from './shared';

// The team board: area tabs (plus "Content calendar": content, Facebook and GBP on the calendar), three views of the same tasks (Board by
// status with drag and drop, List by due date, Calendar by month), quick counts, search and an owner filter. Changes are saved at once and put
// back with a message if the save fails; the board re-reads the shared list every minute and when the window comes back into focus.

const VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'calendar', label: 'Calendar' },
];
const CONTENT_AREAS = ['content', 'facebook', 'gbp'];

const remember = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
const recall = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export default function TaskApp({ initialTasks, loadError, storage, user }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [area, setArea] = useState('all'); // 'all', an area id, or 'calendar' (the content calendar)
  const [view, setView] = useState('board');
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [quick, setQuick] = useState(''); // '', 'overdue', 'week', 'mine'
  const [editing, setEditing] = useState(null); // a task, or { new: true, ...defaults }
  const [message, setMessage] = useState(loadError ? `Could not load the tasks: ${loadError}` : '');
  const [me, setMe] = useState(user.name); // open board: the name this browser typed (cookie qrs_name); signed in: the account's name
  const [team, setTeam] = useState([]); // the team ({ id, name, role }): the assignee picker and notifications
  const timer = useRef(null);

  // Remembered per browser: the last area and view
  useEffect(() => {
    setArea(recall('qrs-tasks-area', 'all'));
    setView(recall('qrs-tasks-view', 'board'));
    if (!user.local)
      fetch('/api/users')
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d) => setTeam(d.users))
        .catch(() => {});
  }, [user.local]);
  useEffect(() => remember('qrs-tasks-area', area), [area]);
  useEffect(() => remember('qrs-tasks-view', view), [view]);

  const say = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 5000);
  }, []);

  // Re-read the shared list (other people's changes) every minute and when the tab is focused again
  const refresh = useCallback(async () => {
    const res = await fetch('/api/tasks', { cache: 'no-store' }).catch(() => null);
    if (res?.status === 401) return (window.location.href = '/login');
    if (res?.ok) setTasks((await res.json()).tasks);
  }, []);
  useEffect(() => {
    const id = setInterval(refresh, 60000);
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const api = async (url, method, body) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    if (res.status === 401) window.location.href = '/login';
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'The change was not saved.');
    return data;
  };

  const save = async (id, changes) => {
    const before = tasks;
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    try {
      const { task, next } = await api(`/api/tasks/${id}`, 'PATCH', changes);
      setTasks((list) => [...list.map((t) => (t.id === id ? task : t)), ...(next ? [next] : [])]);
      if (next) say(`Done. The next one is due ${shortDate(next.due)}.`);
    } catch (err) {
      setTasks(before);
      say(err.message);
    }
  };

  const create = async (list) => {
    try {
      const { tasks: made } = await api('/api/tasks', 'POST', { tasks: list });
      setTasks((all) => [...all, ...made]);
      return made;
    } catch (err) {
      say(err.message);
      return null;
    }
  };

  const remove = async (id) => {
    const before = tasks;
    setTasks((list) => list.filter((t) => t.id !== id));
    try {
      await api(`/api/tasks/${id}`, 'DELETE');
      say('Task deleted.');
    } catch (err) {
      setTasks(before);
      say(err.message);
    }
  };

  const now = today();
  const weekEnd = addDays(now, 7);
  const areaIds = area === 'calendar' ? CONTENT_AREAS : area === 'all' ? null : [area];
  const owners = useMemo(() => [...new Set([...team.map((m) => m.name), ...tasks.map((t) => t.owner)].filter(Boolean))].sort(), [tasks, team]);
  const isMine = (t) => (user.id && t.assignee_id === user.id) || (me && (t.owner || '').toLowerCase() === me.toLowerCase());

  const inArea = tasks.filter((t) => !areaIds || areaIds.includes(t.area));
  const open = (t) => t.status !== 'done';
  const counts = {
    overdue: inArea.filter((t) => open(t) && t.due && t.due < now).length,
    week: inArea.filter((t) => open(t) && t.due && t.due >= now && t.due <= weekEnd).length,
    doing: inArea.filter((t) => t.status === 'doing').length,
    done: inArea.filter((t) => t.status === 'done' && t.done_at && t.done_at.slice(0, 10) >= addDays(now, -7)).length,
  };

  const q = query.trim().toLowerCase();
  const shown = inArea.filter((t) => {
    if (owner && t.owner !== owner) return false;
    if (q && !`${t.title} ${t.notes} ${t.owner}`.toLowerCase().includes(q)) return false;
    if (quick === 'overdue') return open(t) && t.due && t.due < now;
    if (quick === 'week') return open(t) && t.due && t.due <= weekEnd;
    if (quick === 'mine') return isMine(t);
    return true;
  });

  const currentView = area === 'calendar' ? 'calendar' : view;
  const newTask = (defaults = {}) =>
    setEditing({ new: true, title: '', area: areaIds?.[0] || 'website', status: 'todo', priority: 'normal', owner: me || '', assignee_id: user.local ? '' : user.id, due: '', repeat: '', link: '', notes: '', ...defaults });

  // Starter tasks for an area with nothing open yet: daily ones today, the rest spread over the next two weeks
  const startersFor = (areaList) =>
    areaList.flatMap((id) =>
      (STARTER_TASKS[id] || []).map((s, i) => ({ ...s, area: id, status: 'todo', priority: s.priority || 'normal', owner: '', due: s.repeat === 'daily' ? now : addDays(now, 1 + i * 3) })),
    );
  const emptyAreas = (areaIds || AREAS.map((a) => a.id)).filter((id) => !tasks.some((t) => t.area === id && open(t)));

  // My own open tasks that are overdue or due today, for the bell
  const reminders = !me
    ? []
    : tasks
        .filter((t) => open(t) && isMine(t) && t.due && t.due <= now)
        .map((t) => ({ task_id: t.id, kind: t.due < now ? 'overdue' : 'due', text: `${t.due < now ? 'Overdue' : 'Due today'}: “${t.title}”` }));
  const openTask = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (t) setEditing(t);
    else say('That task was deleted.');
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="app">
      <header className="top">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true">Q</span> QRS Tasks
        </p>
        <nav className="areas" aria-label="Areas">
          <button className={area === 'all' ? 'on' : ''} onClick={() => setArea('all')}>
            All <span>{tasks.filter(open).length}</span>
          </button>
          {AREAS.map((a) => (
            <button key={a.id} className={area === a.id ? 'on' : ''} onClick={() => setArea(a.id)} style={{ '--c': a.color }}>
              <i className="dot" aria-hidden="true" /> {a.short || a.label} <span>{tasks.filter((t) => t.area === a.id && open(t)).length}</span>
            </button>
          ))}
          <button className={'cal-tab' + (area === 'calendar' ? ' on' : '')} onClick={() => setArea('calendar')}>
            Content calendar
          </button>
        </nav>
        <div className="top-end">
          <Notifications user={user} reminders={reminders} onOpenTask={openTask} />
          <span className="storage" title="Where the tasks are saved">
            {storage}
          </span>
          {user.local && (
            <button
              className="who-btn"
              title="Your name goes on the tasks and comments you add"
              onClick={() => {
                const name = (window.prompt('Your name (shown on the tasks and comments you add):', me || '') || '').trim().slice(0, 40);
                if (!name) return;
                document.cookie = `qrs_name=${encodeURIComponent(name)}; path=/; max-age=31536000; samesite=lax`;
                setMe(name);
              }}
            >
              {me ? `You: ${me}` : 'Set your name'}
            </button>
          )}
          {!user.local && (
            <span className="who" title={user.email}>
              {user.name} <span className="muted">· {user.role === 'admin' ? 'Admin' : 'Member'}</span>
            </span>
          )}
          {user.role === 'admin' && !user.local && (
            <a className="link" href="/users">
              Team
            </a>
          )}
          {!user.local && (
            <button className="link" onClick={logout}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <section className="stats" aria-label="At a glance">
        {[
          ['overdue', 'Overdue', counts.overdue],
          ['week', 'Due in 7 days', counts.week],
          ['', 'In progress', counts.doing],
          ['', 'Done this week', counts.done],
        ].map(([id, label, n]) => (
          <button key={label} className={'stat' + (id && quick === id ? ' on' : '') + (id === 'overdue' && n ? ' warn' : '')} disabled={!id} onClick={() => setQuick(quick === id ? '' : id)}>
            <b>{n}</b> {label}
          </button>
        ))}
      </section>

      <div className="toolbar">
        {area !== 'calendar' && (
          <div className="seg" role="tablist" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        )}
        <input className="search" type="search" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search tasks" />
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="">Everyone</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        {me && (
          <button className={'chip' + (quick === 'mine' ? ' on' : '')} onClick={() => setQuick(quick === 'mine' ? '' : 'mine')}>
            My tasks
          </button>
        )}
        <span className="grow" />
        {emptyAreas.length > 0 && (
          <button className="btn" onClick={async () => (await create(startersFor(emptyAreas))) && say('Starter tasks added. Edit or delete any you don’t need.')}>
            Add starter tasks{emptyAreas.length < AREAS.length ? ` (${emptyAreas.map(areaName).join(', ')})` : ''}
          </button>
        )}
        <button className="btn btn-primary" onClick={() => newTask()}>
          + New task
        </button>
      </div>

      {currentView === 'board' && <Board tasks={shown} now={now} onOpen={setEditing} onMove={(id, status) => save(id, { status })} onAdd={(status) => newTask({ status })} />}
      {currentView === 'list' && <List tasks={shown} now={now} onOpen={setEditing} onSave={save} />}
      {currentView === 'calendar' && (
        <Calendar tasks={shown} now={now} onOpen={setEditing} onMove={(id, due) => save(id, { due })} onAdd={(due) => newTask({ due, area: areaIds?.[0] || 'content' })} title={area === 'calendar' ? 'Content calendar: content, Facebook and GBP' : ''} />
      )}

      {editing && (
        <TaskDialog
          task={editing}
          owners={owners}
          team={team}
          user={user}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing.new) {
              if (await create([data])) setEditing(null);
            } else {
              setEditing(null);
              await save(editing.id, data);
            }
          }}
          // Admins delete any task, members the ones they added (the server checks it too)
          onDelete={
            user.role === 'admin' || editing.created_by === (user.email || user.name)
              ? async () => {
                  setEditing(null);
                  await remove(editing.id);
                }
              : null
          }
        />
      )}

      <p className={'toast' + (message ? ' show' : '')} role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || PRIORITIES.findIndex((p) => p.id === a.priority) - PRIORITIES.findIndex((p) => p.id === b.priority);

function Board({ tasks, now, onOpen, onMove, onAdd }) {
  const [over, setOver] = useState('');
  return (
    <div className="board">
      {STATUSES.map((s) => {
        const list = tasks.filter((t) => t.status === s.id).sort(byDue);
        const shownList = s.id === 'done' ? list.sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 30) : list;
        return (
          <section
            key={s.id}
            className={'col' + (over === s.id ? ' over' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s.id);
            }}
            onDragLeave={() => setOver('')}
            onDrop={(e) => {
              e.preventDefault();
              setOver('');
              const id = e.dataTransfer.getData('text/plain');
              const task = tasks.find((t) => t.id === id);
              if (task && task.status !== s.id) onMove(id, s.id);
            }}
          >
            <h2>
              {s.label} <span>{list.length}</span>
            </h2>
            <div className="col-cards">
              {shownList.map((t) => (
                <Card key={t.id} task={t} now={now} onOpen={onOpen} />
              ))}
              {s.id !== 'done' && (
                <button className="add-here" onClick={() => onAdd(s.id)}>
                  + Add a task
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function List({ tasks, now, onOpen, onSave }) {
  const [showDone, setShowDone] = useState(false);
  const rows = tasks.filter((t) => showDone || t.status !== 'done').sort(byDue);
  return (
    <div className="list-wrap">
      <label className="show-done">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done tasks
      </label>
      {rows.length === 0 ? (
        <p className="empty">Nothing here. Add a task, or change the filters.</p>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th aria-label="Done" />
              <th>Task</th>
              <th>Area</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={t.status === 'done' ? 'is-done' : ''}>
                <td>
                  <input type="checkbox" aria-label={`Mark "${t.title}" done`} checked={t.status === 'done'} onChange={(e) => onSave(t.id, { status: e.target.checked ? 'done' : 'todo' })} />
                </td>
                <td>
                  <button className="link title" onClick={() => onOpen(t)}>
                    {t.title}
                  </button>
                  {t.repeat && <span className="repeat"> ↻</span>}
                  {t.priority === 'high' && <span className="prio">High</span>}
                  {t.status === 'done' && t.disposition && <span className="dispo">{dispositionName(t.disposition)}</span>}
                </td>
                <td>
                  <span className="pill" style={{ '--c': areaOf(t.area).color }}>
                    {areaName(t.area)}
                  </span>
                </td>
                <td>
                  <select value={t.status} onChange={(e) => onSave(t.id, { status: e.target.value })} aria-label="Status">
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{t.owner || <span className="muted">—</span>}</td>
                <td className={t.status !== 'done' && t.due && t.due < now ? 'late' : ''}>{t.due ? shortDate(t.due) : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
