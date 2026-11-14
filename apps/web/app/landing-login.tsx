'use client';

import { useState, type FormEvent } from 'react';

export default function LandingLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'login', input: { email: fields.get('email'), password: fields.get('password') } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not log in. Try again.');
      const relay = await fetch('/api/relay', { cache: 'no-store' });
      window.location.assign(relay.ok ? '/relay' : '/settings');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not reach the relay. Try again.');
      setBusy(false);
    }
  }

  return <form className="landing-login-form" onSubmit={login} aria-label="Log in">
    <label htmlFor="login-email">email<input id="login-email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy}/></label>
    <label htmlFor="login-password">password<input id="login-password" name="password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy}/></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
  </form>;
}
