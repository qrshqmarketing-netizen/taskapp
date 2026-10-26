'use client';

import { useEffect, useState } from 'react';

// The Team page (admins only): add people by email with a role, change roles, send a new sign-in link, remove access.
// Admins manage the team and can delete any task; members add, edit and move tasks and delete their own.
const ROLE_LABELS = { admin: 'Admin', member: 'Member' };
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never');

export default function TeamManager({ me }) {
  const [users, setUsers] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch('/api/users', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setUsers(data.users);
    else setError(data.error || 'Could not load the team.');
  };
  useEffect(() => {
    load();
  }, []);

  const act = async (body) => {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'That didn’t work.'), false;
    setUsers(data.users);
    setMessage(data.message || '');
    return true;
  };

  const invite = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (await act({ action: 'invite', email: f.get('email'), name: f.get('name'), role: f.get('role') })) form.reset();
  };

  return (
    <div className="app team">
      <header className="top team-top">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true">Q</span> QRS Tasks
        </p>
        <a className="btn" href="/">
          ← Back to the board
        </a>
      </header>

      <h1>Team</h1>
      <p className="muted">
        People sign in with a one-time link sent to their email. <b>Admins</b> manage the team and can delete any task; <b>members</b> add, edit and
        move tasks and delete their own.
      </p>

      <form className="form invite" onSubmit={invite}>
        <h2>Add a person</h2>
        <div className="row three">
          <label>
            Email
            <input name="email" type="email" required placeholder="name@qualityroofingspecialists.com" />
          </label>
          <label>
            Name
            <input name="name" maxLength={60} placeholder="First and last name" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          Add and send a sign-in link
        </button>
      </form>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="list-wrap">
        {!users ? (
          <p className="empty">Loading…</p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last sign-in</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b> {self && <span className="muted">(you)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {self ? (
                        ROLE_LABELS[u.role]
                      ) : (
                        <select value={u.role} disabled={busy} onChange={(e) => act({ action: 'role', id: u.id, role: e.target.value })} aria-label={`Role for ${u.name}`}>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td>{when(u.last_sign_in_at)}</td>
                    <td className="actions">
                      <button className="btn" disabled={busy} onClick={() => act({ action: 'resend', id: u.id })}>
                        Send link
                      </button>
                      {!self && (
                        <button className="btn btn-danger" disabled={busy} onClick={() => window.confirm(`Remove ${u.email} from the task board?`) && act({ action: 'remove', id: u.id })}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
