'use client';

import { useEffect, useState } from 'react';

// A task's comment thread: read, add, edit your own, delete your own (admins can delete any). Posting notifies the assignee, the person who
// added the task and earlier commenters (lib/store.js).
const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

export default function Comments({ taskId, user }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null); // { id, body }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/comments`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
      .catch(() => setComments([]));
  }, [taskId]);

  const call = async (url, method, body) => {
    setBusy(true);
    setError('');
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'That didn’t save.');
      return null;
    }
    return data;
  };

  const post = async (e) => {
    e.preventDefault();
    const data = await call(`/api/tasks/${taskId}/comments`, 'POST', { body: text });
    if (data) {
      setComments((list) => [...list, data.comment]);
      setText('');
    }
  };
  const saveEdit = async () => {
    const data = await call(`/api/comments/${editing.id}`, 'PATCH', { body: editing.body });
    if (data) {
      setComments((list) => list.map((c) => (c.id === editing.id ? data.comment : c)));
      setEditing(null);
    }
  };
  const del = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    if (await call(`/api/comments/${id}`, 'DELETE')) setComments((list) => list.filter((c) => c.id !== id));
  };

  const mine = (c) => user?.local || (c.author_id && c.author_id === user?.id);

  return (
    <section className="comments" aria-label="Comments">
      <h3>Comments {comments?.length ? <span className="muted">{comments.length}</span> : null}</h3>
      {comments === null ? (
        <p className="muted small">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="muted small">No comments yet.</p>
      ) : (
        <ol className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <p className="comment-head">
                <b>{c.author_name || 'Someone'}</b> <span className="muted">{stamp(c.created_at)}{c.updated_at && c.updated_at !== c.created_at && c.updated_at > c.created_at ? ' · edited' : ''}</span>
              </p>
              {editing?.id === c.id ? (
                <div className="comment-edit">
                  <textarea rows={3} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} maxLength={4000} />
                  <div className="comment-actions">
                    <button className="btn" type="button" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="button" disabled={busy} onClick={saveEdit}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="comment-body">{c.body}</p>
              )}
              {editing?.id !== c.id && (mine(c) || user?.role === 'admin') && (
                <p className="comment-actions">
                  {mine(c) && (
                    <button className="link" type="button" onClick={() => setEditing({ id: c.id, body: c.body })}>
                      Edit
                    </button>
                  )}
                  <button className="link danger" type="button" onClick={() => del(c.id)}>
                    Delete
                  </button>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <form className="comment-new" onSubmit={post}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Write a comment…" aria-label="New comment" />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>
          Comment
        </button>
      </form>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
