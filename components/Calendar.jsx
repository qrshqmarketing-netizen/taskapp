'use client';

import { useState } from 'react';
import { Card } from './shared';

// The month calendar (the "Content calendar" tab, or the Calendar view of any area): every task on its due date, colored by area. Drag a task
// to another day to move it, or from "No date yet" onto a day to schedule it; click the empty part of a day to add a task on that date.
// Weeks start on Monday. On phones the month becomes a list of the days that have tasks.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function monthDays(year, month) {
  const first = new Date(year, month, 1, 12);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday
  const last = new Date(year, month + 1, 0, 12);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7))); // on to Sunday
  const days = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(iso(d));
  return days;
}

export default function Calendar({ tasks, now, onOpen, onMove, onAdd, title }) {
  const [cursor, setCursor] = useState(() => ({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) - 1 }));
  const [over, setOver] = useState('');
  const days = monthDays(cursor.y, cursor.m);
  const monthKey = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
  const label = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const byDay = {};
  for (const t of tasks) if (t.due) (byDay[t.due] ||= []).push(t);
  const undated = tasks.filter((t) => !t.due && t.status !== 'done');
  const go = (n) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  const drop = (day) => (e) => {
    e.preventDefault();
    setOver('');
    const id = e.dataTransfer.getData('text/plain');
    const task = tasks.find((t) => t.id === id);
    if (task && task.due !== day) onMove(id, day);
  };
  const dragOver = (day) => (e) => {
    e.preventDefault();
    setOver(day);
  };

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="btn" onClick={() => go(-1)} aria-label="Previous month">
          ‹
        </button>
        <h2>{label}</h2>
        <button className="btn" onClick={() => go(1)} aria-label="Next month">
          ›
        </button>
        <button className="btn" onClick={() => setCursor({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) - 1 })}>
          Today
        </button>
        {title && <p className="muted cal-title">{title}</p>}
      </div>

      <div className="cal-body">
        <div className="cal-grid" role="grid" aria-label={label}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-dow" role="columnheader">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const list = byDay[day] || [];
            const outside = !day.startsWith(monthKey);
            return (
              <div
                key={day}
                role="gridcell"
                className={'cal-day' + (outside ? ' outside' : '') + (day === now ? ' is-today' : '') + (over === day ? ' over' : '') + (list.length ? ' has' : '')}
                onDragOver={dragOver(day)}
                onDragLeave={() => setOver('')}
                onDrop={drop(day)}
                onClick={(e) => e.target === e.currentTarget && onAdd(day)}
              >
                <button className="cal-num" onClick={() => onAdd(day)} title="Add a task on this day">
                  <span className="cal-dow-sm">{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })} </span>
                  {Number(day.slice(8))}
                </button>
                {list.map((t) => (
                  <Card key={t.id} task={t} now={now} onOpen={onOpen} />
                ))}
              </div>
            );
          })}
        </div>

        <aside
          className={'cal-tray' + (over === 'none' ? ' over' : '')}
          onDragOver={(e) => {
            e.preventDefault();
            setOver('none');
          }}
          onDragLeave={() => setOver('')}
          onDrop={(e) => {
            e.preventDefault();
            setOver('');
            const id = e.dataTransfer.getData('text/plain');
            if (tasks.find((t) => t.id === id)?.due) onMove(id, '');
          }}
        >
          <h3>No date yet</h3>
          <p className="muted">Drag one onto a day to schedule it.</p>
          {undated.length ? undated.map((t) => <Card key={t.id} task={t} now={now} onOpen={onOpen} />) : <p className="muted">Everything open has a date.</p>}
        </aside>
      </div>
    </div>
  );
}
