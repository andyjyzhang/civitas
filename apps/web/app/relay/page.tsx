'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import WorkspaceNav from '../components/workspace-nav';
import type { ActivitySnapshot, ContextEvent, Delivery } from '@civitas/contracts';

const label = (id: string) => id.replace(/^ag_/, '').replace(/^./, character => character.toUpperCase());
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No activity yet';

export default function Home() {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [editingContext, setEditingContext] = useState<ContextEvent | null>(null);
  const [inbox, setInbox] = useState<Delivery[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('project/maintenance-api');
  const publishKey = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/relay', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) { setSnapshot(null); return; }
      if (!response.ok) throw new Error(data.error);
      setSnapshot(data); setError('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not reach the relay.'); }
    finally { setConnecting(false); }
  }, []);

  useEffect(() => { void refresh(); const interval = setInterval(() => void refresh(), 3000); return () => clearInterval(interval); }, [refresh]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new FormData(form).get('token'), spaceId: new FormData(form).get('spaceId') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      form.reset(); await refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Connection failed.'); }
    finally { setBusy(false); }
  }

  async function operate(operation: string, input?: unknown) {
    const response = await fetch('/api/relay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, input }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    try { await operate('subscribe', { topic }); setNotice(`Subscribed to ${topic}.`); await refresh(); }
    catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Subscription failed.'); }
    finally { setBusy(false); }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const fields = new FormData(event.currentTarget);
    publishKey.current ??= crypto.randomUUID();
    try {
      await operate('publish', { ...(editingContext ? { contextId: editingContext.contextId, expectedVersion: editingContext.version, change: editingContext.change, tags: editingContext.tags } : {}), topic: fields.get('topic'), title: fields.get('title'), content: fields.get('content'), source: { uri: fields.get('uri'), revision: fields.get('revision') }, idempotencyKey: publishKey.current });
      publishKey.current = null; setEditingContext(null); setShowPublish(false); setNotice('Context published.'); await refresh();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Publish failed. Retry the unchanged packet or start a new one.'); }
    finally { setBusy(false); }
  }

  async function retrieve(append = false) {
    setBusy(true);
    try {
      const data = await operate('retrieve', { limit: 20, ...(append && nextCursor ? { cursor: nextCursor } : {}) });
      setInbox(previous => append ? [...(previous || []), ...data.items] : data.items); setNextCursor(data.nextCursor);
      setNotice(`Retrieved ${data.items.length} updates.`); await refresh();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Retrieval failed.'); }
    finally { setBusy(false); }
  }
  async function acknowledge(deliveryId: string, status: 'acknowledged' | 'dismissed') {
    setBusy(true);
    try {
      const record = await operate('acknowledge', { deliveryId, status });
      setInbox(previous => previous?.map(item => item.deliveryId === deliveryId ? { ...item, status: record.status, acknowledgedAt: record.acknowledgedAt } : item) || null);
      setNotice(`Delivery ${status}.`); await refresh();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Could not record disposition.'); }
    finally { setBusy(false); }
  }

  const events = snapshot?.events.filter(event => `${event.title} ${event.topic} ${event.content}`.toLowerCase().includes(query.toLowerCase())) || [];
  const inboxView = inbox && snapshot && <section className="card inbox-panel" aria-label="Inbox" tabIndex={0}><div className="section-heading"><h2>Your inbox</h2><button className="text-button" onClick={() => setInbox(null)}>Close inbox</button></div><p>Review sources before acting. Acknowledgement is final.</p><div className="inbox-list">{inbox.map(item => <article className="inbox-item" key={item.deliveryId}><strong>{item.event.title} · v{item.event.version}</strong><p className="event-content">{item.event.content}</p><small>{item.event.source.uri} @ {item.event.source.revision} · {item.status}</small>{item.status === 'pending' && <div className="button-row"><button className="secondary" disabled={busy} onClick={() => acknowledge(item.deliveryId, 'acknowledged')}>Acknowledge</button><button className="text-button" disabled={busy} onClick={() => acknowledge(item.deliveryId, 'dismissed')}>Dismiss delivery</button></div>}</article>)}</div>{inbox.length === 0 && <p>No updates.</p>}{nextCursor && <button className="secondary" disabled={busy} onClick={() => retrieve(true)}>Load more</button>}</section>;
  return <div className="shell">
    <WorkspaceNav active="relay"/>
    <main>
      <header className="topbar"><span>{snapshot?.space.name || 'Relay'}</span><a className="text-button" href="/settings">People &amp; access</a><span className="demo-pill"><span className="status-dot"/> Local relay</span></header>
      <div className="content">
        <div className="heading"><h1>Agent context</h1>{snapshot && <button className="primary" onClick={() => { publishKey.current = null; setEditingContext(null); setShowPublish(true); }}>＋ Publish context</button>}</div>
        {snapshot && <div className="storage-status">{snapshot.storage === 'postgres' ? 'PostgreSQL' : 'Memory · clears on restart'}</div>}
        {error && <div className="alert" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}

        {!snapshot ? <section className="connect-panel"><h2>{connecting ? 'Reaching your relay…' : 'Connect agent'}</h2><p>Advanced MCP connection: use your Civitas credential and project ID. This is not a model API key. <a href="/settings">Manage agents</a></p><form onSubmit={connect}><label htmlFor="space-id">Space ID</label><input id="space-id" name="spaceId" defaultValue="sp_demo" required/><label htmlFor="token">Civitas agent credential</label><div className="connect-input"><input id="token" name="token" type="password" required autoComplete="off" placeholder="Paste your agent key"/><button className="primary" disabled={busy || connecting}>{busy ? 'Connecting…' : 'Connect agent →'}</button></div></form></section> : <>
          <div className="stats"><Stat name="Linked agents" value={snapshot.agents.length}/><Stat name="Shared context" value={snapshot.events.length}/><Stat name="Deliveries" value={snapshot.deliveries.length}/><Stat name="Retrieved" value={snapshot.deliveries.filter(item => item.retrievedAt).length}/></div>
          <div className="columns">{inbox ? inboxView : <section className="feed card"><div className="section-heading"><h2>Context stream <span>{snapshot.events.length}</span></h2><span className="live-indicator"><span className="status-dot"/> {error ? 'Relay offline' : 'Polling · 3s'}</span></div><label className="search"><span>⌕</span><input aria-label="Search shared context" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search context…"/></label>
            <div className="event-list" role="region" aria-label="Context stream" tabIndex={0}>{events.length ? events.map(event => {
              const deliveries = snapshot.deliveries.filter(item => item.event.eventId === event.eventId);
              return <article className="event" key={event.eventId}><div className="event-top"><span className="topic">{event.topic}</span><time>{time(event.publishedAt)}</time></div><h3>{event.title}</h3><p className="event-content">{event.content}</p>{event.change && <div className="diff"><div><span>BEFORE</span><code>{JSON.stringify(event.change.previous ?? null)}</code></div><div><span>AFTER</span><code>{JSON.stringify(event.change.current ?? null)}</code></div></div>}<div className="source"><span>↗</span><span>{event.source.uri}</span><code>{event.source.revision}</code></div><div className="event-bottom">{event.publisherAgentId === snapshot.currentAgentId && <button className="text-button" onClick={() => { publishKey.current = null; setEditingContext(event); setShowPublish(true); }}>Append version</button>}<span><span className="avatar small">{label(event.publisherAgentId)[0]}</span>{label(event.publisherAgentId)} <span className="muted">· v{event.version}</span></span><span>{deliveries.length} delivered <span className="muted">/</span> {deliveries.filter(item => item.retrievedAt).length} retrieved</span></div></article>;
            }) : <div className="empty"><span>↗</span><h3>{query ? 'No matching context' : 'No context yet.'}</h3><p>{query ? 'Try another topic or keyword.' : 'Subscribe to a topic, then publish from another agent.'}</p>{!query && <button className="secondary" onClick={() => setShowPublish(true)}>Publish context</button>}</div>}</div>
          </section>}<div className="right-column" role="region" aria-label="Agents and subscriptions" tabIndex={0}><section className="card agents"><div className="section-heading"><h2>Agent network</h2><span className="network-icon">◎</span></div>{snapshot.agents.map(agent => <div className="agent-row" key={agent.agentId}><span className={`avatar ${agent.agentId === snapshot.currentAgentId ? 'green' : ''}`}>{label(agent.agentId)[0]}</span><div><strong>{label(agent.agentId)} {agent.agentId === snapshot.currentAgentId && <span className="you">You</span>}</strong><small>{snapshot.subscriptions.filter(sub => sub.agentId === agent.agentId).length} topics · API activity {time(agent.lastActivityAt)}</small></div></div>)}</section>
            <section className="card subscriptions"><div className="section-heading"><h2>Subscriptions</h2><span>↳</span></div>{snapshot.subscriptions.filter(sub => sub.agentId === snapshot.currentAgentId).map(sub => <div className="subscription" key={sub.subscriptionId}><span className="status-dot"/>{sub.topic}</div>)}{!snapshot.subscriptions.some(sub => sub.agentId === snapshot.currentAgentId) && <p className="muted">No subscriptions.</p>}<form onSubmit={subscribe}><label htmlFor="topic">Exact topic</label><input id="topic" value={topic} onChange={event => setTopic(event.target.value)} required/><button className="secondary full" disabled={busy}>Subscribe</button></form><button className="text-button" disabled={busy} onClick={() => retrieve()}>Open inbox</button></section>
            <div className="account"><div><small>Connected as</small><strong>{snapshot.currentAgentId}</strong></div><button className="text-button" onClick={async () => { await fetch('/api/session', {method:'DELETE'}); setSnapshot(null); setInbox(null); setNotice(''); }}>Disconnect</button></div>
          </div></div>
        </>}
      </div>
    </main>
    {showPublish && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><div className="section-heading"><h2 id="publish-title">{editingContext ? `Append version ${editingContext.version + 1}` : 'Share a discovery'}</h2><button className="close" aria-label="Close publication form" onClick={() => setShowPublish(false)}>×</button></div><p>Share selected context. Never include secrets.</p><form onSubmit={publish}><label>Topic<input name="topic" defaultValue={editingContext?.topic || "project/maintenance-api"} required/></label><label>Title<input name="title" defaultValue={editingContext?.title || ""} placeholder="What changed?" maxLength={200} required/></label><label>Context<textarea name="content" defaultValue={editingContext?.content || ""} rows={4} placeholder="Explain the change and what other agents should know." required/></label><div className="form-grid"><label>Source reference<input name="uri" defaultValue={editingContext?.source.uri || "fixture:maintenance-api"} required/></label><label>Source revision<input name="revision" defaultValue={editingContext?.source.revision || "demo-v2"} required/></label></div><button className="primary full" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</button></form><small>Retry unchanged content after a timeout.</small></section></div>}
  </div>;
}

function Stat({ name, value }: { name: string; value: number }) {
  return <section className="stat"><div>{name}</div><strong>{String(value).padStart(2, '0')}</strong></section>;
}
