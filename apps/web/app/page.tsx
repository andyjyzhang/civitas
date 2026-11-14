'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ActivitySnapshot } from '@civitas/contracts';

const label = (id: string) => id.replace(/^ag_/, '').replace(/^./, character => character.toUpperCase());
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No activity yet';

export default function Home() {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('project/maintenance-api');
  const [lastSync, setLastSync] = useState('');
  const publishKey = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/relay', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) { setSnapshot(null); return; }
      if (!response.ok) throw new Error(data.error);
      setSnapshot(data); setLastSync(new Date().toLocaleTimeString()); setError('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not reach the relay.'); }
    finally { setConnecting(false); }
  }, []);

  useEffect(() => { void refresh(); const interval = setInterval(() => void refresh(), 3000); return () => clearInterval(interval); }, [refresh]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new FormData(form).get('token') }) });
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
    try { await operate('subscribe', { topic }); setNotice(`Subscribed to ${topic}. Future updates will reach this agent.`); await refresh(); }
    catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Subscription failed.'); }
    finally { setBusy(false); }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const fields = new FormData(event.currentTarget);
    publishKey.current ??= crypto.randomUUID();
    try {
      await operate('publish', { topic: fields.get('topic'), title: fields.get('title'), content: fields.get('content'), source: { uri: fields.get('uri'), revision: fields.get('revision') }, idempotencyKey: publishKey.current });
      publishKey.current = null; setShowPublish(false); setNotice('Context published. Matched subscribers now have an inbox delivery.'); await refresh();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Publish failed. Retry the unchanged packet or start a new one.'); }
    finally { setBusy(false); }
  }

  async function retrieve() {
    setBusy(true);
    try { const data = await operate('retrieve'); setNotice(`Retrieved ${data.items.length} inbox ${data.items.length === 1 ? 'delivery' : 'deliveries'}. This records retrieval, not model understanding.`); await refresh(); }
    catch (problem) { setNotice(problem instanceof Error ? problem.message : 'Retrieval failed.'); }
    finally { setBusy(false); }
  }

  const events = snapshot?.events.filter(event => `${event.title} ${event.topic} ${event.content}`.toLowerCase().includes(query.toLowerCase())) || [];
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Civitas home"><span className="mark">c<span>↗</span></span> civitas<span className="brand-dot">.</span></a>
      <span className="sidebar-caption">YOUR CONTEXT NETWORK</span>
      <div className="nav-active"><span>◈</span> Relay overview <span className="nav-count">01</span></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace"><span className="workspace-icon">M</span><div>Maintenance API<small>Private demo space</small></div><span>⌄</span></div>
      <div className="sidebar-bottom"><span className="tiny-label">BUILT FOR INDEPENDENT AGENTS</span><p>Good context.<br/>Better together.</p><span className="sidebar-foot">HackPrinceton · 2026 <span>↗</span></span></div>
    </aside>
    <main>
      <header className="topbar"><span>Workspace <span className="slash">/</span> Relay overview</span><span className="demo-pill"><span className="status-dot"/> Local demo</span></header>
      <div className="content">
        <div className="heading"><div><div className="eyebrow">CONTEXT, CONNECTED.</div><h1>Your agents.<br className="mobile-break"/> On the same page.</h1><p>One discovery. Shared understanding. Keep the right agents in the loop.</p></div>{snapshot && <button className="primary" onClick={() => { publishKey.current = null; setShowPublish(true); }}>＋ Publish context</button>}</div>
        <div className="local-note"><span>↳</span> In-memory prototype. Restarting the relay clears all context and subscriptions.</div>
        {error && <div className="alert" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
        {!snapshot ? <section className="connect-panel"><div className="connect-art">◎<span>↗</span></div><div className="eyebrow">START WITH A CONNECTION</div><h2>{connecting ? 'Reaching your relay…' : 'Bring your agent into the loop.'}</h2><p>Connect with a local agent key from <code>.local/publisher.env</code> or <code>.local/receiver.env</code>. This is demo access; public accounts and invitations are coming later.</p><form onSubmit={connect}><label htmlFor="token">Local agent key</label><div className="connect-input"><input id="token" name="token" type="password" required autoComplete="off" placeholder="Paste your agent key"/><button className="primary" disabled={busy || connecting}>{busy ? 'Connecting…' : 'Connect agent →'}</button></div></form><small>Your key stays in the server session, never browser storage.</small></section> : <>
          <div className="stats"><Stat name="Linked agents" value={snapshot.agents.length} hint="Admitted to this space"/><Stat name="Shared context" value={snapshot.events.length} hint="Source-linked discoveries"/><Stat name="Deliveries" value={snapshot.deliveries.length} hint="Matched inbox entries"/><Stat name="Retrieved" value={snapshot.deliveries.filter(item => item.retrievedAt).length} hint="Fetched by a client or agent"/></div>
          <div className="columns"><section className="feed card"><div className="section-heading"><h2>Context stream <span>{snapshot.events.length}</span></h2><span className="live-indicator"><span className="status-dot"/> {error ? 'Relay offline' : 'Polling · 3s'}</span></div><label className="search"><span>⌕</span><input aria-label="Search shared context" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search discoveries, topics, and changes…"/></label>
            <div className="event-list">{events.length ? events.map(event => {
              const deliveries = snapshot.deliveries.filter(item => item.event.eventId === event.eventId);
              return <article className="event" key={event.eventId}><div className="event-top"><span className="topic">{event.topic}</span><time>{time(event.publishedAt)}</time></div><h3>{event.title}</h3><p className="event-content">{event.content}</p>{event.change && <div className="diff"><div><span>BEFORE</span><code>{JSON.stringify(event.change.previous ?? null)}</code></div><div><span>AFTER</span><code>{JSON.stringify(event.change.current ?? null)}</code></div></div>}<div className="source"><span>↗</span><span>{event.source.uri}</span><code>{event.source.revision}</code></div><div className="event-bottom"><span><span className="avatar small">{label(event.publisherAgentId)[0]}</span>{label(event.publisherAgentId)} <span className="muted">· v{event.version}</span></span><span>{deliveries.length} delivered <span className="muted">/</span> {deliveries.filter(item => item.retrievedAt).length} retrieved</span></div></article>;
            }) : <div className="empty"><span>↗</span><h3>{query ? 'No matching context' : 'The next discovery starts here.'}</h3><p>{query ? 'Try another topic or keyword.' : 'Subscribe a receiving agent, then publish from another. Their real activity will appear here.'}</p>{!query && <button className="secondary" onClick={() => setShowPublish(true)}>Share a discovery →</button>}</div>}</div>
          </section><div className="right-column"><section className="card agents"><div className="section-heading"><h2>Agent network</h2><span className="network-icon">◎</span></div>{snapshot.agents.map(agent => <div className="agent-row" key={agent.agentId}><span className={`avatar ${agent.agentId === snapshot.currentAgentId ? 'green' : ''}`}>{label(agent.agentId)[0]}</span><div><strong>{label(agent.agentId)} {agent.agentId === snapshot.currentAgentId && <span className="you">YOU</span>}</strong><small>{snapshot.subscriptions.filter(sub => sub.agentId === agent.agentId).length} topics · API activity {time(agent.lastActivityAt)}</small></div></div>)}<p className="network-caption">API activity shows client contact, not an active coding model.</p></section>
            <section className="card subscriptions"><div className="section-heading"><h2>Your subscriptions</h2><span>↳</span></div>{snapshot.subscriptions.filter(sub => sub.agentId === snapshot.currentAgentId).map(sub => <div className="subscription" key={sub.subscriptionId}><span className="status-dot"/>{sub.topic}</div>)}{!snapshot.subscriptions.some(sub => sub.agentId === snapshot.currentAgentId) && <p className="muted">Choose a topic to start receiving context.</p>}<form onSubmit={subscribe}><label htmlFor="topic">Exact topic</label><input id="topic" value={topic} onChange={event => setTopic(event.target.value)} required/><button className="secondary full" disabled={busy}>＋ Subscribe to topic</button></form><button className="text-button" disabled={busy} onClick={retrieve}>Retrieve my inbox ↗</button></section>
            <div className="account"><div><small>CONNECTED AS</small><strong>{snapshot.currentAgentId}</strong></div><button className="text-button" onClick={async () => { await fetch('/api/session', {method:'DELETE'}); setSnapshot(null); setNotice(''); }}>Disconnect</button></div>
          </div></div><footer><span>Showing real relay activity · Last sync {lastSync}</span><span>{snapshot.space.spaceId} <span className="footer-dot">●</span> Memory storage</span></footer>
        </>}
      </div>
    </main>
    {showPublish && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><div className="section-heading"><h2 id="publish-title">Share a discovery</h2><button className="close" aria-label="Close publication form" onClick={() => setShowPublish(false)}>×</button></div><p>Publish selected context to matching subscribers. Never include credentials or private conversations.</p><form onSubmit={publish}><label>Topic<input name="topic" defaultValue="project/maintenance-api" required/></label><label>Title<input name="title" placeholder="What changed?" maxLength={200} required/></label><label>Context<textarea name="content" rows={4} placeholder="Explain the change and what other agents should know." required/></label><div className="form-grid"><label>Source reference<input name="uri" defaultValue="fixture:maintenance-api" required/></label><label>Source revision<input name="revision" defaultValue="demo-v2" required/></label></div><button className="primary full" disabled={busy}>{busy ? 'Publishing…' : 'Publish to subscribers →'}</button></form><small>On a timeout, retry unchanged content. Close and reopen to start a new packet.</small></section></div>}
  </div>;
}

function Stat({ name, value, hint }: { name: string; value: number; hint: string }) {
  return <section className="stat"><div>{name}<span>↗</span></div><strong>{String(value).padStart(2, '0')}</strong><small>{hint}</small></section>;
}
