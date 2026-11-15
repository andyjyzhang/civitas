'use client';

// Shared client helpers for the people-facing pages (chat, servers, members):
// account API calls, room polling, time formatting, a dialog and a switch.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Room } from '@civitas/contracts';
import { Button } from './ui';
import '../styles/people.css';

export async function read<T>(query = ''): Promise<T> {
  const response = await fetch('/api/account' + query, { cache: 'no-store' });
  if (response.status === 401) { window.location.assign('/'); throw new Error('Please sign in.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load your workspace.');
  return data as T;
}

export async function operate<T = Record<string, unknown>>(operation: string, input: unknown = {}): Promise<T> {
  const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, input }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete this action.');
  return data as T;
}

export const errorText = (e: unknown, fallback = 'Something went wrong.') => e instanceof Error ? e.message : fallback;

/** "14:05" today, "Mar 3, 14:05" otherwise. */
export function clock(value: string) {
  const date = new Date(value);
  const today = new Date().toDateString() === date.toDateString();
  return date.toLocaleString([], today ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value: string) {
  const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function dayLabel(value: string) {
  const date = new Date(value), now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Polls a room every 4s while mounted. */
export function useRoom(spaceId: string, kind: 'group' | 'server') {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(spaceId));
  const number = useRef(0);
  const reload = useCallback(async () => {
    if (!spaceId) return;
    const current = ++number.current;
    try {
      const result = await read<Room>('?room=' + encodeURIComponent(spaceId));
      if (current !== number.current) return;
      if (result.space.kind !== kind) throw new Error(kind === 'group' ? 'This is a server, not a group.' : 'This is a group, not a server.');
      setRoom(result); setError('');
    } catch (e) { if (current === number.current) { setRoom(null); setError(errorText(e, 'Could not load this space.')); } }
    finally { if (current === number.current) setLoading(false); }
  }, [spaceId, kind]);
  useEffect(() => {
    setRoom(null); setError(''); setLoading(Boolean(spaceId));
    if (!spaceId) return;
    void reload();
    const timer = setInterval(() => void reload(), 4000);
    return () => { clearInterval(timer); number.current++; };
  }, [spaceId, reload]);
  return { room, error, loading, reload };
}

/** Closes on outside click / Escape. */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return { open, setOpen, root };
}

export function Dialog({ title, description, onClose, closeDisabled, children }: { title: string; description?: ReactNode; onClose: () => void; closeDisabled?: boolean; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !closeDisabled) onClose(); };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [onClose, closeDisabled]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !closeDisabled) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="section-heading"><h2>{title}</h2><Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<X/>} disabled={closeDisabled} onClick={onClose}/></div>
      {description && <p>{description}</p>}
      {children}
    </section>
  </div>;
}

/** Copy-to-clipboard button for secrets / commands shown once. */
export function CopyButton({ value, label = 'Copy', size = 'sm' }: { value: string; label?: string; size?: 'sm' | 'md' }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return <Button size={size} onClick={() => void navigator.clipboard?.writeText(value).then(() => setState('copied'), () => setState('failed'))}>
    {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy manually' : label}
  </Button>;
}

export type CreatedInvite = { inviteId: string; token: string; email: string; expiresAt: string };

/** Owner-only: create an invitation token and show it once. */
export function InviteDialog({ spaceId, spaceName, onClose, onCreated }: { spaceId: string; spaceName: string; onClose: () => void; onCreated?: (invite: CreatedInvite) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try { const created = await operate<CreatedInvite>('invite', { spaceId, email: fields.get('email') }); setInvite(created); onCreated?.(created); }
    catch (e) { setError(errorText(e, 'Could not create the invitation.')); }
    finally { setBusy(false); }
  }
  return <Dialog title={`Invite to ${spaceName}`} description={invite ? 'Share this token privately. It is shown only once.' : 'They accept with an account that uses this email. No email is sent.'} onClose={onClose} closeDisabled={busy}>
    {!invite ? <form onSubmit={submit}>
      <label>Email<input name="email" type="email" required autoFocus placeholder="teammate@example.com" maxLength={254}/></label>
      {error && <p className="alert" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create invitation'}</Button>
    </form> : <form onSubmit={e => { e.preventDefault(); onClose(); }}>
      <label>Invitation token<input readOnly value={invite.token} className="mono" onFocus={e => e.currentTarget.select()} aria-describedby="invite-hint"/></label>
      <p className="subtle" id="invite-hint">For {invite.email} · expires {clock(invite.expiresAt)}. They use Accept invitation in the group menu.</p>
      <div className="page-actions"><CopyButton value={invite.token} label="Copy token" size="md"/><Button type="submit" variant="primary">Done</Button></div>
    </form>}
  </Dialog>;
}
