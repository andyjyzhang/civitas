'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, Check, Code2, FileText, GitBranch, Pause, Play, RotateCcw, ShieldCheck, SkipForward, X } from 'lucide-react';
import { Button, StatusPill } from '../components/ui';
import { DiffView } from '../agents/diff';
import { summaryBullets } from '../agents/review';
import defaultRecording from '../../public/demo/recording.json';
import { clock, parseRecording, stageAt, stageNames, stages, type Recording } from './recording';
import Trace from './trace';
import LiveDemo from './live';
import './demo.css';

const roles = ['sdk', 'triage', 'dispatch'];
const labels = ['SDK', 'Triage UI', 'Dispatch'];
const fallbackSummary = ['priority → priority_code (breaking)', 'P1 = urgent · CHANGELOG.md', 'P2, P3 meaning unknown → manual review', '/work-orders deprecated · sunset 2027-03-31'];
const fallbackPlan = ['Read both API contracts', 'Compare contract and consumer impact', 'Cite evidence and flag unknowns', 'Prepare an update for review'];

export default function Demo() {
  const [recording, setRecording] = useState<Recording>(() => parseRecording(defaultRecording));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [auto, setAuto] = useState(true);
  const [trace, setTrace] = useState(false);
  const [live, setLive] = useState(false);
  const [liveOpened, setLiveOpened] = useState(false);
  const [space, setSpace] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const stage = stageAt(time);
  useEffect(() => { if (live) setLiveOpened(true); }, [live]);
  const real = recording.kind === 'recorded';
  useEffect(() => { setSpace(new URLSearchParams(window.location.search).get('space') || ''); }, []);
  const seek = useCallback((t: number) => { setTime(Math.max(0, Math.min(90, t))); }, []);
  const next = useCallback(() => { setTime(t => stages.find(s => s > t + .05) ?? 90); }, []);
  useEffect(() => {
    if (!playing || trace || live || time >= 90) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(); const dt = Math.min(1, (now - last) / 1000) * speed; last = now;
      setTime(t => {
        let end = Math.min(90, t + dt);
        // Manual approvals pause at the actual decision. Seeking remains available for rehearsal.
        if (!auto) for (const gate of [27, 53]) if (t < gate && end >= gate) { end = gate; setPlaying(false); break; }
        return end;
      });
    }, 80);
    return () => clearInterval(timer);
  }, [playing, speed, auto, trace, live, time >= 90]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (live || trace || e.altKey || e.ctrlKey || e.metaKey || (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
      if (e.code === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); setTime(t => Math.max(0, t - 5)); }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [next, live, trace]);
  function replay() { setTime(0); setPlaying(true); }
  async function loadFile(file?: File) {
    if (!file) return;
    try { if (file.size > 12_000_000) throw new Error('Recording must be smaller than 12 MB.'); const r = parseRecording(JSON.parse(await file.text())); setRecording(r); setError(''); replay(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load recording.'); }
    if (input.current) input.current.value = '';
  }
  // Re-time the real workflow into the pitch's stages, preserving each stage's original order.
  const analystFrames = recording.frames.filter(f => f.run.kind === 'analyst');
  const waiting = analystFrames.find(f => f.run.status === 'waiting');
  const published = analystFrames.find(f => f.run.status === 'published');
  const analysisEnd = waiting?.at ?? published?.at ?? recording.durationMs ?? 1;
  const rolloutStart = published?.at ?? analysisEnd;
  const rolloutEnd = recording.durationMs ?? recording.frames.at(-1)?.at ?? rolloutStart + 1;
  const originalAt = time < 25 ? Math.max(0, (time - 5) / 20) * analysisEnd : time < 35 ? analysisEnd : time < 70 ? rolloutStart + (time - 35) / 35 * (rolloutEnd - rolloutStart) : rolloutEnd;
  const visibleFrames = recording.frames.filter(f => f.at <= originalAt);
  const analyst = [...visibleFrames].reverse().find(f => f.run.kind === 'analyst')?.run;
  const latestAnalyst = analystFrames.at(-1)?.run;
  const packet = (waiting?.run.approval?.actions[0]?.args ?? {}) as { content?: string; tags?: string[] };
  const summary = real ? summaryBullets(packet.content || latestAnalyst?.result || '', packet.tags || []) : fallbackSummary;
  const plan = real ? analyst?.todos ?? [] : fallbackPlan.map((content, i) => ({ content, status: time > 9 + i * 4 ? 'completed' : 'pending' }));
  const files = real ? Array.from(new Set((analyst?.timeline ?? []).filter(s => s.name === 'read_file').map(s => { try { return String(JSON.parse(s.detail).file_path || ''); } catch { return ''; } }).filter(Boolean))) : ['openapi-v1.yaml', 'openapi-v2.yaml', 'CHANGELOG.md'];
  const specialists = real ? Array.from(new Set((analyst?.timeline ?? []).filter(s => s.kind === 'task').map(s => s.subagent || 'Specialist'))) : ['Contract', 'Impact'];
  const triage = [...visibleFrames].reverse().find(f => f.run.role === 'triage')?.run;
  const triageDiff = Object.entries(triage?.files ?? {}).find(([f]) => f.endsWith('.diff'))?.[1];
  const outcome = roles.map(role => [...recording.frames].reverse().find(f => f.run.role === role)?.run);
  const allApplied = real && outcome.every(r => r?.status === 'applied');
  const recordedLabel = real ? `Recorded run · ${new Date(recording.recordedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${recording.model || 'model not captured'}` : 'Illustrative walkthrough · no recorded model run';
  return <main className="demo">
    <header className="demo-head"><a href="/" className="demo-brand">civitas <span>/ Watch demo</span></a><div className="demo-head-actions"><span className={`demo-label ${real ? '' : 'illustrative'}`}>{live ? 'Live run · real models and approvals' : recordedLabel}</span><Button variant="secondary" onClick={() => { setLive(p => !p); setPlaying(false); }}>{live ? 'Return to replay' : 'Run live instead'}</Button><a href={space ? `/agents?space=${encodeURIComponent(space)}` : '/'} aria-label="Close demo" className="demo-close"><X size={20}/></a></div></header>
    <div hidden={!live}>{liveOpened && <LiveDemo initialSpace={space} onRecording={r => { setRecording(r); setLive(false); replay(); }}/>}</div>
      {!live && <>
      <nav className="demo-stages" aria-label="Demo stages">{stageNames.map((name, i) => <button key={name} aria-current={stage === i ? 'step' : undefined} onClick={() => seek(stages[i])}><span>{i < stage ? <Check size={13}/> : i + 1}</span>{name}</button>)}</nav>
      <div className="demo-canvas">
        <div className="demo-story" key={stage}>
          <p className="demo-step-label">{stageNames[stage]} / Maintenance API v2</p>
          <h1>{['One change. Three services.', 'Understand the change.', 'A person makes the call.', 'Context travels. Code catches up.', 'The right meaning survives.', 'Follow every step.'][stage]}</h1>
          <p className="demo-subtitle">{['Your team’s Maintenance API just shipped v2. Three services depend on it.', 'An analyst checks the contracts and the impact, together.', 'Nothing is shared without a person’s approval.', 'Each service receives the same source-linked update and proposes its own patch.', real ? (allApplied ? 'All three patches were applied in this recording.' : 'The captured outcomes are shown below, including incomplete runs.') : 'P1 stays urgent. Unknown codes stay visible for review.', 'Inspect the evidence, replay the story, or try a real run.'][stage]}</p>
        </div>
        <div className="demo-workspace">
          <section className={`demo-analyst ${stage >= 3 ? 'compact' : ''}`} aria-label="Analyst">
            <div className="demo-agent-heading"><Bot/><div><h2>{stage === 0 ? 'Maintenance API' : 'Change analyst'}</h2><p>{stage === 0 ? 'v1 → v2' : 'Plan, evidence, then approval'}</p></div>{stage > 2 && (!real || published) && <ShieldCheck className="demo-teal"/>}</div>
            {stage === 0 && <div className="demo-change"><code>priority</code><ArrowRight/><code>priority_code</code><span>Breaking change</span></div>}
            {stage === 1 && <>
              <ul className="demo-plan">{plan.length ? plan.map((todo, i) => <li key={i} className={todo.status === 'completed' ? 'complete' : ''}><span>{todo.status === 'completed' ? <Check size={15}/> : '○'}</span>{todo.content}</li>) : <li>Waiting for the recorded plan…</li>}</ul>
              <div className="demo-chips">{specialists.map(name => <span key={name} className="demo-specialist"><GitBranch size={14}/>{name}{real ? ` · ${analyst?.timeline.find(s => s.kind === 'task' && (s.subagent || 'Specialist') === name)?.status || 'working'}` : time < 20 ? ' · working' : ' · done'}</span>)}</div>
              <div className="demo-chips">{files.map((name, i) => <span className={Math.floor(time / 2) % 3 === i ? 'reading' : ''} key={name}><FileText size={13}/>{name.split('/').pop()}</span>)}</div>
            </>}
            {stage >= 2 || (stage === 1 && time >= 21) ? <ul className="demo-summary">{summary.map((s, i) => <li key={i} className={/unknown|unresolved|manual review|no documented/i.test(s) ? 'warning' : ''}>{s}</li>)}</ul> : null}
            {stage === 2 && (!real || waiting) && <div className="demo-approval"><ShieldCheck/><div><h3>Share this update with 3 services?</h3><p>{auto ? 'Replay approval appears after 2 seconds.' : 'Presenter approval · click to continue.'}</p></div><Button onClick={() => { seek(35); setPlaying(true); }}>Approve</Button>{auto && time >= 27 && <span className="demo-replayed">✓ Approval replayed</span>}</div>}
            {stage >= 2 && real && !waiting && <p className="demo-warning">No approval request was captured for this analysis · {latestAnalyst?.status || 'incomplete'}</p>}
          </section>
          <div className={`demo-connections ${stage >= 3 && (!real || published) ? 'active' : ''}`} aria-hidden="true"><svg viewBox="0 0 900 65" preserveAspectRatio="none"><path d="M450 0 V20 M150 65 V20 H750 V65 M450 20 V65"/></svg></div>
          <div className="demo-services">{roles.map((role, i) => {
            const run = [...visibleFrames].reverse().find(f => f.run.role === role)?.run;
            const t = time - 35 - i * 2;
            const illustrativeStatus = t < 0 ? 'Out of date' : t < 4 ? 'Received' : t < 11 ? 'Reading code' : t < (role === 'triage' ? 24 : 18) ? (role === 'triage' ? 'Needs your review' : 'Patch ready') : 'Updated ✓';
            const status = time < 35 ? 'Out of date' : real ? !run ? 'Waiting for run' : run.status === 'applied' ? 'Updated ✓' : run.status === 'waiting' ? 'Needs your review' : run.status === 'failed' ? 'Failed' : run.status === 'rejected' ? 'Rejected' : run.status === 'running' ? 'Reading code' : run.status : illustrativeStatus;
            return <section key={role} className={`demo-service ${status.startsWith('Updated') ? 'updated' : ''}`}><div className="demo-service-top"><Code2 size={23}/><h3>{labels[i]}</h3></div><StatusPill status={status.startsWith('Updated') ? 'done' : /review|ready/.test(status) ? 'waiting' : /Out|Failed|Rejected/.test(status) ? 'failed' : 'working'} label={status}/><p>{['Decodes the API response', 'Shows the priority to operators', 'Routes maintenance work'][i]}</p></section>;
          })}</div>
          {stage === 3 && ((!real && time >= 50 && time < 62) || (real && triage?.status === 'waiting')) && <aside className="demo-patch" aria-label="Triage patch review"><div><h3>Triage UI · Needs your review</h3><p>{real ? 'Exact diff captured before approval.' : 'Illustrative diff · replay only'}</p></div>{real ? <DiffView text={triageDiff}/> : <pre><span className="del">− priority: 'urgent'</span>{'\n'}<span className="add">+ priority_code: 'P1'</span></pre>}<Button onClick={() => { seek(63); setPlaying(true); }}>Approve replayed patch</Button><p className="subtle">This replays a decision; it does not apply code.</p></aside>}
          {stage >= 4 && <section className="demo-result">
            {(!real || allApplied) && <div className="demo-comparison"><div><p>Before · v1 code reads v2 data</p><h3 className="subtle">Low priority</h3></div><ArrowRight/><div><p>After · expected triage behavior{real ? ' (illustration)' : ''}</p><h3 className="demo-urgent">Urgent maintenance</h3><span className="demo-warning">P2 · Needs review</span></div></div>}
            <p className="demo-result-line">{real ? `${outcome.filter(r => r?.status === 'applied').length} of 3 services updated${recording.durationMs !== null ? ` · ${clock(recording.durationMs / 1000)} original run` : ''}${recording.costUsd !== null ? ` · $${recording.costUsd.toFixed(2)}` : ' · cost not captured'} · ${recording.approvalMode === 'interactive' ? 'interactive approvals' : recording.approvalMode === 'automated' ? 'automated verification approvals' : 'approval provenance unknown'}` : 'Illustrative outcome · duration, cost and human approvals are not measured'}</p>
            {stage === 5 && <div className="demo-wrap"><Button onClick={() => { setTrace(true); setPlaying(false); }}>See the full trace</Button><Button variant="secondary" onClick={replay} icon={<RotateCcw/>}>Replay</Button><Button variant="secondary" onClick={() => setLive(true)}>Run live</Button></div>}
          </section>}
        </div>
      </div>
      <footer className="demo-controls"><input aria-label="Playback position" type="range" min="0" max="90" step="0.1" value={time} onChange={e => seek(Number(e.target.value))}/><div className="demo-toolbar"><div><Button variant="ghost" onClick={() => time >= 90 ? replay() : setPlaying(p => !p)} icon={playing && time < 90 ? <Pause/> : <Play/>}>{playing && time < 90 ? 'Pause' : 'Play'}</Button><Button variant="ghost" onClick={next} icon={<SkipForward/>}>Next</Button><span className="demo-time">{clock(time)} / 1:30</span><label>Speed <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="4">4×</option></select></label></div><div><label><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)}/> Auto-play replay approvals</label><Button variant="ghost" onClick={() => { setTrace(true); setPlaying(false); }}>Full trace</Button><Button variant="ghost" onClick={() => input.current?.click()}>Load recording</Button></div></div><p>Space to pause · → next stage · ← back 5s · Replay approvals never perform real actions</p><input ref={input} type="file" accept="application/json,.json" hidden onChange={e => void loadFile(e.target.files?.[0])}/>{error && <p role="alert" className="demo-warning">{error}</p>}</footer>
      {trace && <Trace recording={recording} onClose={() => setTrace(false)}/>}
    </>}
  </main>;
}
