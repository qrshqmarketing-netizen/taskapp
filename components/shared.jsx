'use client';

import { REPEATS, areaOf } from '@/lib/areas';

// Dates as YYYY-MM-DD in the viewer's own time zone
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const shortDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const initials = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();


export function TaskMeta({ task, now }) {
  const late = task.status !== 'done' && task.due && task.due < now;
  return (
    <span className="meta">
      {task.due && <span className={'due' + (late ? ' late' : task.due === now ? ' today' : '')}>{task.due === now ? 'Today' : shortDate(task.due)}</span>}
      {task.repeat && (
        <span className="repeat" title={REPEATS.find((r) => r.id === task.repeat)?.label}>
          ↻
        </span>
      )}
      {task.priority === 'high' && <span className="prio">High</span>}
      {task.link && <span title="Has a link">🔗</span>}
      {task.owner && (
        <span className="avatar" title={task.owner}>
          {initials(task.owner)}
        </span>
      )}
    </span>
  );
}

export function Card({ task, now, onOpen, draggable = true }) {
  const a = areaOf(task.area);
  return (
    <button
      className={'card' + (task.status === 'done' ? ' is-done' : '')}
      style={{ '--c': a.color }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpen(task)}
    >
      <span className="card-area">{a.short || a.label}</span>
      <span className="card-title">{task.title}</span>
      <TaskMeta task={task} now={now} />
    </button>
  );
}

