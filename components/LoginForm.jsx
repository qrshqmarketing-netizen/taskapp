'use client';

import { useState } from 'react';

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const email = new FormData(e.currentTarget).get('email');
    const res = await fetch('/api/auth/magic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSent(data.message);
    else setError(data.error || 'Could not send the link.');
    setBusy(false);
  };

  if (sent)
    return (
      <div className="sent">
        <p>
          <b>Check your email.</b> {sent}
        </p>
        <button className="link" onClick={() => setSent('')}>
          Use a different email
        </button>
      </div>
    );

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Work email
        <input name="email" type="email" required autoComplete="email" autoFocus placeholder="you@qualityroofingspecialists.com" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
