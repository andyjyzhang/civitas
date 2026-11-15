'use client';

// Inbox: every agent request waiting for the signed-in owner's decision, across owned groups.
// Each row opens the item in that group's Activity feed.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Inbox } from 'lucide-react';
import type { InboxItem } from '../../lib/agents';
import { AgentAvatar, Card, EmptyState, Page, PageHeader, StatusPill } from '../components/ui';
import { call, fullTime, relTime, useNow } from '../agents/client';
import '../styles/agents.css';

/** "Publish context: X" → "Share “X”"; "Apply patch to Y" stays. */
const askText = (item: InboxItem) => item.kind === 'analyst' ? `Share “${item.ask.replace(/^Publish context:\s*/, '')}”` : item.ask;

export default function InboxView() {
  const now = useNow();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [down, setDown] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const d = await call<{ items: InboxItem[]; agentServerDown: boolean }>('/api/inbox'); setItems(d.items); setDown(d.agentServerDown); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your inbox.'); }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 10_000); return () => clearInterval(t); }, [load]);
  return <Page>
    <PageHeader title="Inbox" description="Agent requests waiting for your decision."/>
    {error && <div className="alert" role="alert">{error}</div>}
    {down && <div className="alert" role="status">Agents are offline, so waiting requests can’t be listed.</div>}
    {!items ? <p className="subtle">Loading…</p> : !items.length
      ? <EmptyState icon={<Inbox/>} title="You’re all caught up" description="When an agent needs your approval to share an update or apply a patch, it shows up here."/>
      : <Card padded={false}>
        <div className="list">{items.map(item => <Link key={item.threadId} className="list-row ib-row" href={`/activity?space=${encodeURIComponent(item.spaceId)}&item=${encodeURIComponent(item.threadId)}`}>
          <AgentAvatar/>
          <span className="ag-run-text">
            <span className="ag-run-title">{askText(item)}</span>
            <span className="subtle">{item.spaceName}</span>
          </span>
          <StatusPill status="waiting" label="Needs your review"/>
          <time dateTime={item.waitingSince} title={fullTime(item.waitingSince)}>{relTime(item.waitingSince, now)}</time>
          <ChevronRight aria-hidden="true" className="ag-row-icon"/>
        </Link>)}</div>
      </Card>}
  </Page>;
}
