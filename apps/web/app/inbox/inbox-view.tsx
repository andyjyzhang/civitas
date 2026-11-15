'use client';

// Inbox: every agent run waiting for the signed-in owner's decision, across owned groups.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, GitPullRequestArrow, Inbox, Sparkles } from 'lucide-react';
import type { InboxItem } from '../../lib/agents';
import { Card, EmptyState, InfoTip, Page, PageHeader, StatusPill } from '../components/ui';
import { call, fullTime, relTime, useNow } from '../agents/client';
import '../styles/agents.css';

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
    <PageHeader title="Inbox" description="Agent requests waiting for your decision in groups you own."/>
    {error && <div className="alert" role="alert">{error}</div>}
    {down && <div className="alert" role="status">Agent server not running — waiting runs can’t be listed.</div>}
    {!items ? <p className="subtle">Loading…</p> : !items.length
      ? <EmptyState icon={<Inbox/>} title="You're all caught up" description="Publishing context and applying patches need your approval; those requests land here."/>
      : <Card title={<>Waiting for you <InfoTip text="Only group owners can approve. Members see these runs as “Waiting for owner” on the Agents page."/></>} padded={false}>
        <div className="list">{items.map(item => <Link key={item.threadId} className="list-row ib-row" href={`/agents?space=${encodeURIComponent(item.spaceId)}&run=${encodeURIComponent(item.threadId)}`}>
          {item.kind === 'analyst' ? <Sparkles aria-hidden="true" className="ag-row-icon"/> : <GitPullRequestArrow aria-hidden="true" className="ag-row-icon"/>}
          <span className="ag-run-text">
            <span className="ag-run-title">{item.ask}</span>
            <span className="subtle">{item.spaceName} · {item.title}</span>
          </span>
          <time dateTime={item.waitingSince} title={fullTime(item.waitingSince)}>{relTime(item.waitingSince, now)}</time>
          <StatusPill status="waiting" label="Waiting for you"/>
          <ChevronRight aria-hidden="true" className="ag-row-icon"/>
        </Link>)}</div>
      </Card>}
  </Page>;
}
