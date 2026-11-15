'use client';

// Context: the group's published context, newest first, with a propagation row per subscribed
// receiver. Data comes from GET /api/context (server-side, workspace analyst credential).
// Event content is agent-authored: rendered as text only.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bot, Layers } from 'lucide-react';
import type { Receiver, Stage } from '../../lib/agents';
import { useShell } from '../components/app-shell';
import { AgentBadge, Badge, Button, Card, CopyId, EmptyState, InfoTip, Page, PageHeader } from '../components/ui';
import { call, fullTime, relTime, useNow } from '../agents/client';
import '../styles/agents.css';

type FeedEvent = {
  eventId: string; contextId: string; version: number; title: string; topic: string; content: string; tags: string[]; breaking: boolean | null;
  source: { uri: string; revision: string }; publishedAt: string;
  publisher: { agentId: string; label: string; isAgent: boolean }; analystThreadId?: string;
  receivers: Receiver[]; deliveredCount: number; retrievedCount: number; acknowledgedCount: number;
};
type Feed = { enabled: boolean; storage?: 'memory' | 'postgres'; runsAvailable?: boolean; events: FeedEvent[] };

const STEPS = ['Delivered', 'Retrieved', 'Adapting', 'Patch ready', 'Applied'] as const;
// Stage → index of the furthest reached step, plus how the current step reads.
const STAGE: Record<Stage, { at: number; tone?: 'live' | 'ask' | 'bad'; label?: string }> = {
  pending: { at: -1 }, delivered: { at: 0 }, retrieved: { at: 1 }, adapting: { at: 2, tone: 'live' }, patch_ready: { at: 3, tone: 'ask' },
  applied: { at: 4 }, acknowledged: { at: 4, label: 'Acknowledged' }, dismissed: { at: 4, tone: 'bad', label: 'Dismissed' },
  rejected: { at: 3, tone: 'bad', label: 'Patch rejected' }, failed: { at: 2, tone: 'bad', label: 'Adapter failed' },
};

export default function ContextView() {
  const { spaceId } = useShell();
  const now = useNow();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!spaceId) return;
    try { setFeed(await call<Feed>(`/api/context?space=${encodeURIComponent(spaceId)}`)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load context.'); }
  }, [spaceId]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 5000); return () => clearInterval(t); }, [load]);
  const q = `?space=${encodeURIComponent(spaceId)}`;

  return <Page>
    <PageHeader title="Context" description="Reviewed context published in this group and how far it has reached."
      actions={feed?.storage === 'memory' && <Badge tone="waiting" title="The relay runs with in-memory storage: a restart clears all context.">In-memory relay</Badge>}/>
    {error && <div className="alert" role="alert">{error}</div>}
    {!spaceId ? <EmptyState icon={<Layers/>} title="Create a group first"/>
      : !feed ? <p className="subtle">Loading context…</p>
      : !feed.enabled ? <EmptyState icon={<Bot/>} title="No workspace agents yet" description="Context is published by this group’s agents. Enable them to start." action={<Button variant="primary" href={`/agents${q}`}>Enable workspace agents</Button>}/>
      : !feed.events.length ? <EmptyState icon={<Layers/>} title="Nothing published yet" description="Approved analyses appear here with their delivery to each subscribed agent." action={<Button variant="secondary" href={`/agents${q}`}>Go to Agents</Button>}/>
      : feed.events.map(event => <Card key={event.eventId} padded={false} title={event.title}
          description={<span className="cx-meta"><Badge mono>{event.topic}</Badge><Badge mono>v{event.version}</Badge>{event.breaking && <Badge tone="failed">Breaking</Badge>}</span>}
          actions={event.analystThreadId && <Button size="sm" variant="ghost" href={`/agents${q}&run=${encodeURIComponent(event.analystThreadId)}`}>View analysis</Button>}>
          <div className="list">
            <div className="list-row cx-meta">
              <AgentBadge label={event.publisher.label}/>
              <span title={`${event.source.uri}@${event.source.revision}`}><span className="mono">{event.source.uri.split('/').pop()}</span> @ <span className="mono">{event.source.revision}</span></span>
              <time dateTime={event.publishedAt} title={fullTime(event.publishedAt)}>{relTime(event.publishedAt, now)}</time>
              <CopyId id={event.eventId}/>
              <details className="cx-content"><summary className="text-button">Content</summary><pre className="ag-pre ag-file">{event.content}</pre></details>
            </div>
            <div className="list-row cx-meta">
              <strong className="cx-label">Propagation</strong>
              <span>{event.deliveredCount} delivered · {event.retrievedCount} retrieved · {event.acknowledgedCount} acknowledged</span>
              <InfoTip text="Delivery state comes from the relay; Adapting / Patch ready / Applied come from this group's adapter runs. The relay snapshot doesn't name each delivery's receiver, so receivers without an adapter run are matched only when all their deliveries share one state (marked inferred)."/>
            </div>
            {!event.receivers.length && <div className="list-row subtle">No agents were subscribed to this topic when it was published.</div>}
            {event.receivers.map(r => <ReceiverRow key={r.key} r={r} q={q}/>)}
          </div>
        </Card>)}
  </Page>;
}

function ReceiverRow({ r, q }: { r: Receiver; q: string }) {
  const s = r.stage === 'failed' && r.run?.stopped ? { ...STAGE.failed, label: 'Adapter stopped' } : STAGE[r.stage];
  return <div className="list-row cx-receiver">
    <strong>{r.label}{r.inferred && <span className="subtle" title="Matched by elimination: the relay snapshot does not name the receiving agent."> *</span>}</strong>
    <ol className="cx-steps" aria-label={`${r.label}: ${s.label ?? (s.at >= 0 ? STEPS[s.at] : 'Not delivered')}`}>
      {STEPS.map((step, i) => {
        const current = i === s.at;
        const cls = [i <= s.at ? 'reached' : '', current ? `current ${s.tone ?? ''}` : ''].join(' ');
        return <li key={step} className={cls}><span className="dot" aria-hidden="true"/>{current && s.label ? s.label : step}</li>;
      })}
    </ol>
    {r.run ? <Button size="sm" variant="ghost" href={`/agents${q}&run=${encodeURIComponent(r.run.threadId)}`}>Run</Button> : null}
  </div>;
}
