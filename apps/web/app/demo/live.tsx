'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountOverview } from '@civitas/contracts';
import type { RunDetail, SubagentTrace } from '../../lib/agents';
import { agentActions } from '../agents/client';
import RunView from '../agents/run-view';
import { Button, StatusPill } from '../components/ui';
import { downloadRecording, selectedRun, type Recording } from './recording';
import '../styles/agents.css';

// Uses the same authenticated routes and approval cards as Agents. Never auto-approves a live run.
export default function LiveDemo({ initialSpace, onRecording }: { initialSpace: string; onRecording: (r: Recording) => void }) {
  const [groups, setGroups] = useState<AccountOverview['spaces']>([]);
  const [space, setSpace] = useState(initialSpace);
  const [ids, setIds] = useState<string[]>([]);
  const [runs, setRuns] = useState<Record<string, RunDetail>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [offline, setOffline] = useState(false);
  const capture = useRef<Recording | null>(null);
  const seen = useRef(new Map<string, string>());
  const begun = useRef(0);
  const rolloutStarted = useRef(false);
  useEffect(() => {
    if (window.location.protocol === 'file:') { setOffline(true); return; }
    let active = true;
    fetch('/api/account', { cache: 'no-store' }).then(async response => {
      if (response.status === 401) { if (active) setSignedIn(false); return; }
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not load groups.');
      if (!active) return;
      const owned = (result as AccountOverview).spaces.filter(g => g.kind === 'group' && g.role === 'owner');
      setGroups(owned); setSpace(s => owned.some(g => g.spaceId === s) ? s : owned[0]?.spaceId || '');
    }).catch(e => { if (active) setError(String(e.message)); });
    return () => { active = false; };
  }, []);
  const observe = useCallback((run: RunDetail, subagents: Record<string, SubagentTrace>) => {
    const selected = selectedRun(run);
    const fingerprint = JSON.stringify({ run: selected, subagents });
    if (seen.current.get(run.threadId) === fingerprint) return;
    seen.current.set(run.threadId, fingerprint);
    setRuns(old => ({ ...old, [run.threadId]: selected }));
    if (capture.current && capture.current.frames.length < 2000) {
      const at = Math.round(performance.now() - begun.current);
      capture.current.frames.push({ at, run: selected, subagents }); capture.current.durationMs = at;
    }
  }, []);
  async function start() {
    setBusy(true); setError('');
    try {
      const { threadId } = await agentActions.sample(space);
      begun.current = performance.now(); seen.current.clear(); rolloutStarted.current = false;
      capture.current = { version: 1, kind: 'recorded', title: 'Maintenance API v2', recordedAt: new Date().toISOString(), model: null, costUsd: null, durationMs: null, approvalMode: 'interactive', langsmithUrl: null, frames: [] };
      setRuns({}); setIds([threadId]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start analysis.'); }
    finally { setBusy(false); }
  }
  async function rollout() {
    if (rolloutStarted.current) return;
    rolloutStarted.current = true; setBusy(true); setError('');
    // Each role is started exactly once; retain successful starts even if another fails.
    const results = await Promise.allSettled(['sdk', 'triage', 'dispatch'].map(async role => {
      const { threadId } = await agentActions.startAdapter(space, role);
      setIds(old => [...old, threadId]);
    }));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length) setError(failures.map(r => r.reason instanceof Error ? r.reason.message : 'Adapter could not start.').join(' '));
    setBusy(false);
  }
  const analyst = Object.values(runs).find(r => r.kind === 'analyst');
  const active = ids.some(id => !runs[id] || ['running', 'waiting'].includes(runs[id].status));
  if (offline) return <section className="demo-live"><h1>Run live on the local website.</h1><p>The offline copy contains the complete replay. Live runs need the website, relay and agent server.</p><a className="btn btn-primary" href="http://127.0.0.1:3000/demo">Open local website</a></section>;
  return <section className="demo-live">
    <h1>Run it for real.</h1><p>Real models, source files and patches. Review each exact update and diff before approving. This takes a few minutes and uses your configured model account.</p>
    {!signedIn ? <p><a className="btn btn-primary" href="/">Sign in to run live</a> Return here after signing in. The replay is available without an account.</p> : <div className="demo-live-start"><label>Group <select aria-label="Live demo group" disabled={ids.length > 0} value={space} onChange={e => setSpace(e.target.value)}>{!groups.length && <option value="">No owned groups</option>}{groups.map(g => <option key={g.spaceId} value={g.spaceId}>{g.name}</option>)}</select></label><Button disabled={!space || busy || ids.length > 0} onClick={() => void start()}>{busy && !ids.length ? 'Starting…' : 'Start live analysis'}</Button>{!groups.length && <a href="/groups">Create a group</a>}</div>}
    {error && <p className="alert" role="alert">{error}</p>}
    {!!ids.length && <>
      <p className="demo-live-note">Nothing is shared or applied until you approve below. Returning to replay leaves these runs available in Agents.</p>
      <div className="demo-services">{['sdk', 'triage', 'dispatch'].map((role, i) => {
        const run = Object.values(runs).find(r => r.role === role);
        return <section className="demo-service" key={role}><h3>{['SDK', 'Triage UI', 'Dispatch'][i]}</h3><StatusPill status={run?.status === 'applied' ? 'done' : run?.status === 'waiting' ? 'waiting' : run?.status === 'failed' ? 'failed' : 'working'} label={run?.status === 'applied' ? 'Updated ✓' : run?.status === 'waiting' ? 'Needs your review' : run?.status || 'Waiting for shared update'}/></section>;
      })}</div>
      {analyst?.status === 'published' && !rolloutStarted.current && <Button disabled={busy} onClick={() => void rollout()}>Start rollout to 3 services</Button>}
      <div className="demo-live-runs">{ids.map(id => <RunView key={id} threadId={id} onChange={() => undefined} onSnapshot={observe}/>)}</div>
      <div className="demo-wrap"><Button variant="secondary" disabled={active || !capture.current?.frames.length} onClick={() => capture.current && downloadRecording(capture.current)}>Export selected run JSON</Button><Button disabled={active || !capture.current?.frames.length} onClick={() => capture.current && onRecording(structuredClone(capture.current))}>Watch captured run</Button><a href={`/agents?space=${encodeURIComponent(space)}`}>Open in Agents</a></div>
      <p className="subtle">The export includes this run’s plan, steps, selected evidence, approval requests and diffs. Model, cost and LangSmith URL remain unknown unless independently captured. Review the JSON before sharing.</p>
    </>}
  </section>;
}
