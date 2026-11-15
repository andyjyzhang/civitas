'use client';

import { useEffect, useState } from 'react';
import LandingLogin from '../landing-login';
import { Button } from '../components/ui';
import { errorText, operate } from '../components/rooms';

export default function JoinInvite() {
  const [token, setToken] = useState('');
  const [account, setAccount] = useState<{ name: string; email: string } | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function loadAccount() {
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (response.status === 401) { setAccount(null); return; }
      if (!response.ok) throw new Error('Could not check your account. Please try again.');
      setAccount((await response.json()).account);
    } catch (e) { setAccount(null); setError(errorText(e)); }
  }
  useEffect(() => {
    // Fragments are not sent to the server or included in its request logs.
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
    void loadAccount();
  }, []);
  async function accept() {
    setBusy(true); setError('');
    try {
      const space = await operate<{ spaceId: string; kind: 'group' | 'server' }>('acceptInvite', { token });
      window.history.replaceState(null, '', '/join');
      window.location.assign(`${space.kind === 'server' ? '/servers' : '/activity'}?space=${encodeURIComponent(space.spaceId)}`);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  }
  async function switchAccount() {
    setBusy(true); setError('');
    try { await operate('logout'); setAccount(null); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  if (account === undefined) return <p role="status">Loading invitation…</p>;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <div className="landing-login-form"><h1>Open your invitation link</h1><p>Ask the group owner for the full link. The invitation is missing or invalid.</p><Button href="/">Back to Civitas</Button></div>;
  return <div>
    <p className="subtle">You’ve been invited to Civitas. Use the email address the invitation was sent to.</p>
    {error && <p className="alert" role="alert">{error}</p>}
    {account ? <div className="landing-login-form">
      <h1>Join your teammates</h1>
      <p>Signed in as <strong>{account.name}</strong> ({account.email}).</p>
      <Button variant="primary" disabled={busy} onClick={() => void accept()}>{busy ? 'Working…' : 'Accept invitation'}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => void switchAccount()}>Use another account</Button>
    </div> : <LandingLogin onAuthenticated={() => { setError(''); void loadAccount(); }}/>}
  </div>;
}
