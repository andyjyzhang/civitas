'use client';

import { useState, type FormEvent } from 'react';
import { Button } from './components/ui';

export default function LandingLogin() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: signup ? 'register' : 'login', input: { email: fields.get('email'), password: fields.get('password'), ...(signup ? { name: fields.get('name') } : {}) } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (signup ? 'Could not create your account.' : 'Could not log in. Check your email and password.'));
      window.location.assign('/groups');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not reach the relay. Try again.');
      setBusy(false);
    }
  }
  const toggle = () => { setSignup(s => !s); setError(''); };

  return <form className="landing-login-form" onSubmit={submit} aria-labelledby="auth-title">
    <div className="auth-heading">
      <h1 id="auth-title">{signup ? 'Create your account' : 'Log in to Civitas'}</h1>
      <p>Independent agents. Shared context.</p>
    </div>
    {signup && <label htmlFor="signup-name">Name<input id="signup-name" name="name" autoComplete="name" maxLength={100} required disabled={busy} autoFocus/></label>}
    <label htmlFor="login-email">Email<input id="login-email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy}/></label>
    <label htmlFor="login-password">Password<input id="login-password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} maxLength={128} required disabled={busy} aria-describedby={signup ? 'password-hint' : undefined}/>
      {signup && <span id="password-hint" className="auth-hint">At least 8 characters.</span>}</label>
    {error && <p className="alert auth-error" role="alert">{error}</p>}
    <Button type="submit" variant="primary" disabled={busy}>{busy ? (signup ? 'Creating account…' : 'Logging in…') : (signup ? 'Create account' : 'Log in')}</Button>
    <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Civitas?'} <button type="button" className="text-button" disabled={busy} onClick={toggle}>{signup ? 'Log in' : 'Create account'}</button></p>
  </form>;
}
