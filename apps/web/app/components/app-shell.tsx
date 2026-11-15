'use client';

// Signed-in app shell: group switcher, primary nav (Activity, Inbox, Agents, Members), account
// menu (Explore servers, Sign out). The top bar exists only on narrow screens (menu + title).
// The selected group comes from `?space=` (last choice remembered in localStorage).
// Pages read it with useShell(); page actions can go in the top bar via <ShellActions>.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, Fragment, Suspense, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AccountOverview, Space } from '@civitas/contracts';
import { Activity, Bot, Check, ChevronsUpDown, Compass, Inbox, LogOut, Menu, Plus, Ticket, Users, X } from 'lucide-react';
import { Button } from './ui';

export type NavId = 'activity' | 'inbox' | 'agents' | 'members' | 'servers';
type Dialog = 'create' | 'accept';
export type ShellValue = {
  overview: AccountOverview | null;
  /** The account's groups (kind === 'group'). */
  groups: Space[];
  /** Selected group id, '' when the account has no groups. */
  spaceId: string;
  space: Space | undefined;
  refresh: () => Promise<AccountOverview | null>;
  openDialog: (dialog: Dialog) => void;
  actionsTarget: HTMLElement | null;
};

const ShellContext = createContext<ShellValue | null>(null);
export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside <AppShell>.');
  return value;
}

/** Renders its children into the top bar's right-hand slot. */
export function ShellActions({ children }: { children: ReactNode }) {
  const target = useContext(ShellContext)?.actionsTarget;
  return target ? createPortal(children, target) : null;
}

const STORAGE_KEY = 'civitas:lastGroup';
function readStored() { try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; } }
function writeStored(value: string) { try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* storage unavailable */ } }

async function accountRequest<T>(operation: string, input: unknown = {}): Promise<T> {
  const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, input }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete this action.');
  return data as T;
}

const NAV: { id: NavId; label: string; path: string; Icon: typeof Inbox }[] = [
  { id: 'activity', label: 'Activity', path: '/activity', Icon: Activity },
  { id: 'inbox', label: 'Inbox', path: '/inbox', Icon: Inbox },
  { id: 'agents', label: 'Agents', path: '/agents', Icon: Bot },
  { id: 'members', label: 'Members', path: '/members', Icon: Users },
];

export type AppShellProps = {
  active: NavId;
  /** Page name for the breadcrumb (Group / title). */
  title: string;
  /** Group-scoped page (default). Unscoped pages (servers) don't show the group crumb or rewrite ?space=. */
  scoped?: boolean;
  /** Unread count for the Inbox nav item. */
  inboxCount?: number;
  /** Static top-bar actions; client pages can also use <ShellActions>. */
  actions?: ReactNode;
  children: ReactNode;
};

export default function AppShell(props: AppShellProps) {
  return <Suspense fallback={<div className="app"><aside className="app-sidebar" aria-label="Sidebar"/><div className="app-main"><div className="app-topbar"/><p className="app-loading">Loading…</p></div></div>}><ShellInner {...props}/></Suspense>;
}

/** Polls the number of agent requests waiting for the signed-in owner (GET /api/inbox?count=1). */
function useInboxCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => fetch('/api/inbox?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (typeof d?.count === 'number') setCount(d.count); }).catch(() => undefined);
    void load(); const t = setInterval(load, 10_000); return () => clearInterval(t);
  }, []);
  return count;
}

function ShellInner({ active, title, scoped = true, inboxCount: inboxCountProp, actions, children }: AppShellProps) {
  const polledInbox = useInboxCount();
  const inboxCount = inboxCountProp ?? polledInbox;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const param = params.get('space');
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [error, setError] = useState('');
  const [stored, setStored] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionsTarget, setActionsTarget] = useState<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (response.status === 401) { window.location.assign('/'); return null; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load your account.');
      setOverview(data); setError('');
      return data as AccountOverview;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not reach the relay.'); return null; }
  }, []);
  useEffect(() => { setStored(readStored()); void refresh(); }, [refresh]);
  useEffect(() => { setNavOpen(false); }, [pathname, param]);

  const groups = overview?.spaces.filter(s => s.kind === 'group') ?? [];
  const spaceId = groups.find(g => g.spaceId === param)?.spaceId || groups.find(g => g.spaceId === stored)?.spaceId || groups[0]?.spaceId || '';
  const space = groups.find(g => g.spaceId === spaceId);

  useEffect(() => {
    if (!spaceId) return;
    writeStored(spaceId);
    if (scoped && param !== spaceId) {
      const url = new URL(window.location.href); url.searchParams.set('space', spaceId);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, [spaceId, scoped, param]);

  const q = spaceId ? `?space=${encodeURIComponent(spaceId)}` : '';
  const selectGroup = (id: string) => { writeStored(id); setStored(id); router.push(`${scoped ? pathname : '/activity'}?space=${encodeURIComponent(id)}`); };
  const value: ShellValue = { overview, groups, spaceId, space, refresh, openDialog: setDialog, actionsTarget };

  return <ShellContext.Provider value={value}>
    <div className="app" data-nav-open={navOpen}>
      <aside className="app-sidebar" id="app-sidebar" aria-label="Sidebar">
        <GroupSwitcher groups={groups} space={space} loading={!overview} onSelect={selectGroup} onDialog={setDialog}/>
        <nav className="nav" aria-label="Main">
          {NAV.map(({ id, label, path, Icon }) => <Link key={id} href={path + q} className="nav-link" aria-current={active === id ? 'page' : undefined}>
            <Icon aria-hidden="true"/>{label}{id === 'inbox' && !!inboxCount && <span className="count-badge" aria-label={`${inboxCount} unread`}>{inboxCount > 99 ? '99+' : inboxCount}</span>}
          </Link>)}
        </nav>
        <AccountMenu name={overview?.account.name} email={overview?.account.email}/>
      </aside>
      <button type="button" className="sidebar-scrim" aria-label="Close navigation" tabIndex={-1} onClick={() => setNavOpen(false)}/>
      <div className="app-main">
        <header className="app-topbar">
          <div className="breadcrumb">
            <Button className="menu-toggle" variant="ghost" size="sm" iconOnly aria-label="Open navigation" aria-controls="app-sidebar" aria-expanded={navOpen} icon={<Menu/>} onClick={() => setNavOpen(true)}/>
            {scoped && <><Link className="crumb-group" href={'/activity' + q}>{space?.name || (overview ? 'No group' : '…')}</Link><span className="sep" aria-hidden="true">/</span></>}
            <span aria-current="page">{title}</span>
          </div>
          <div className="topbar-actions" ref={setActionsTarget}>{actions}</div>
        </header>
        <main className="app-content" id="main">
          {error && <div className="page" style={{ paddingBottom: 0 }}><div className="alert" role="alert">{error}</div></div>}
          {overview ? <Fragment key={spaceId}>{children}</Fragment> : !error && <p className="app-loading">Loading…</p>}
        </main>
      </div>
      {dialog && <ShellDialog kind={dialog} onClose={() => setDialog(null)} onDone={async (target, id) => { await refresh(); setDialog(null); writeStored(id); setStored(id); router.push(`${target}?space=${encodeURIComponent(id)}`); }}/>}
    </div>
  </ShellContext.Provider>;
}

function useMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return { open, setOpen, root, button };
}

function GroupSwitcher({ groups, space, loading, onSelect, onDialog }: { groups: Space[]; space?: Space; loading: boolean; onSelect: (id: string) => void; onDialog: (d: Dialog) => void }) {
  const { open, setOpen, root, button } = useMenu();
  const pick = (action: () => void) => () => { setOpen(false); action(); };
  return <div className="switcher" ref={root}>
    <button ref={button} type="button" className="switcher-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      <span className={`group-mark ${space ? '' : 'empty'}`} aria-hidden="true">{space?.name.trim()[0]?.toUpperCase() || '·'}</span>
      <span>{space?.name || (loading ? 'Loading…' : 'No group yet')}</span>
      <ChevronsUpDown aria-hidden="true"/>
    </button>
    {open && <div className="menu" role="menu" aria-label="Groups">
      <div className="menu-label">Groups</div>
      {groups.map(g => <button key={g.spaceId} type="button" role="menuitemradio" aria-checked={g.spaceId === space?.spaceId} className="menu-item" onClick={pick(() => onSelect(g.spaceId))}>
        <span className="group-mark" aria-hidden="true">{g.name.trim()[0]?.toUpperCase() || '·'}</span><span>{g.name}</span>{g.spaceId === space?.spaceId && <Check className="check" aria-hidden="true"/>}
      </button>)}
      {!groups.length && <div className="menu-label">You're not in a group yet.</div>}
      <hr className="divider"/>
      <button type="button" role="menuitem" className="menu-item" onClick={pick(() => onDialog('create'))}><Plus aria-hidden="true"/>Create group</button>
      <button type="button" role="menuitem" className="menu-item" onClick={pick(() => onDialog('accept'))}><Ticket aria-hidden="true"/>Accept invitation</button>
    </div>}
  </div>;
}

function AccountMenu({ name, email }: { name?: string; email?: string }) {
  const { open, setOpen, root, button } = useMenu();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try { await accountRequest('logout'); } catch { /* session may already be gone */ }
    window.location.assign('/');
  }
  return <div className="account-menu" ref={root}>
    {open && <div className="menu" role="menu" aria-label="Account">
      {email && <div className="menu-label" title={email}>{email}</div>}
      <Link role="menuitem" className="menu-item" href="/servers" onClick={() => setOpen(false)}><Compass aria-hidden="true"/>Explore servers</Link>
      <hr className="divider"/>
      <button type="button" role="menuitem" className="menu-item" disabled={busy} onClick={() => void signOut()}><LogOut aria-hidden="true"/>{busy ? 'Signing out…' : 'Sign out'}</button>
    </div>}
    <button ref={button} type="button" className="account-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      <span className="avatar small" aria-hidden="true">{name?.trim()[0]?.toUpperCase() || '·'}</span>
      <span>{name || 'Account'}</span>
      <ChevronsUpDown aria-hidden="true"/>
    </button>
  </div>;
}

function ShellDialog({ kind, onClose, onDone }: { kind: Dialog; onClose: () => void; onDone: (target: string, spaceId: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [onClose]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      if (kind === 'create') {
        const created = await accountRequest<Space>('createSpace', { name: fields.get('name'), kind: 'group', visibility: 'private' });
        await onDone('/activity', created.spaceId);
      } else {
        const accepted = await accountRequest<Space>('acceptInvite', { token: fields.get('token') });
        await onDone(accepted.kind === 'server' ? '/servers' : '/activity', accepted.spaceId);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setBusy(false); }
  }
  const create = kind === 'create';
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="shell-dialog-title">
      <div className="section-heading"><h2 id="shell-dialog-title">{create ? 'Create group' : 'Accept invitation'}</h2><Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<X/>} onClick={onClose}/></div>
      <p>{create ? 'A private space for your people and their agents.' : 'Paste the invitation token sent to your account’s email.'}</p>
      <form onSubmit={submit}>
        {create
          ? <label>Group name<input name="name" required maxLength={100} autoFocus placeholder="Weekend builders"/></label>
          : <label>Invitation token<input name="token" required autoComplete="off" autoFocus className="mono"/></label>}
        {error && <p className="alert" role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? (create ? 'Creating…' : 'Accepting…') : (create ? 'Create group' : 'Accept invitation')}</Button>
      </form>
    </section>
  </div>;
}
