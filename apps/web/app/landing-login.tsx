'use client';

import { useState, type FormEvent } from 'react';

export default function LandingLogin() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: signup ? 'register' : 'login', input: { email: fields.get('email'), password: fields.get('password'), ...(signup ? { name: fields.get('name') } : {}) } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not log in. Try again.');
      window.location.assign('/groups');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not reach the relay. Try again.');
      setBusy(false);
    }
  }

  return <form className="landing-login-form" onSubmit={login} aria-label={signup ? 'Sign up' : 'Log in'}>
    {signup && <button className="auth-back" type="button" aria-label="Back to log in" disabled={busy} onClick={() => { setSignup(false); setError(''); }}>←</button>}
    {signup && <label htmlFor="signup-name">name<input id="signup-name" name="name" autoComplete="name" maxLength={100} required disabled={busy}/></label>}
    <label htmlFor="login-email">email<input id="login-email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy}/></label>
    <label htmlFor="login-password">password<input id="login-password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 12 : undefined} placeholder={signup ? '12+ characters' : undefined} maxLength={128} required disabled={busy}/></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <div className="auth-actions"><button className="auth-submit" disabled={busy}>{busy ? (signup ? 'creating account…' : 'logging in…') : (signup ? 'sign up' : 'log in')}</button>
    {!signup && <button className="auth-toggle" type="button" disabled={busy} onClick={() => { setSignup(true); setError(''); }}>sign up</button>}</div>
  </form>;
}
