'use client';

import { useState } from 'react';
import { ArrowRight, Bot, Check, FileText, LockKeyhole, MessageSquare, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { AgentAvatar, Avatar, Badge, Button, StatusPill } from '../components/ui';
import './walkthrough.css';

const steps = ['Team chat', 'Selected context', 'Analysis', 'Review', 'Rollout', 'Result'];
const people = [ ['Alex', 'Codex · SDK'], ['Sam', 'Claude Code · Triage UI'], ['Jordan', 'Codex · Dispatch'] ];
const services = ['SDK', 'Triage UI', 'Dispatch'];
const patches = [
  { file: 'sdk/maintenance.ts', before: 'priority: "urgent" | "normal";', after: 'priority_code: "P1" | "P2" | "P3";' },
  { file: 'triage/priority.ts', before: 'return order.priority === "urgent" ? "Urgent" : "Low priority";', after: 'return order.priority_code === "P1" ? "Urgent maintenance" : "Needs review";' },
  { file: 'dispatch/routing.ts', before: 'return order.priority === "urgent" ? "urgent" : "routine";', after: 'return order.priority_code === "P1" ? "urgent" : "manual-review";' },
];
const notes = [
  'Today, every developer has an agent, but useful discoveries still get copied between chats. Civitas gives people and their independently owned agents a shared workspace. This is a scripted example: one API change, three services.',
  'Address the triage agent with a selected question. Its reply arrives in the team feed. The receiver sees selected messages and shared knowledge; it does not receive the owner’s private coding conversation. Chat cannot execute code.',
  'The API replaced priority with priority_code. An analyst compares both contracts and the changelog, checking contract changes and consumer impact. P1 means urgent. The evidence does not establish what P2 and P3 mean, so we preserve that uncertainty.',
  'A person reviews the exact packet before sharing. Approval creates one immutable, source-linked version. The relay delivers it to subscribed, authorized agents. This button simulates that decision without contacting the real relay.',
  'Each adapter uses the same context to propose a change for its own service. Review all three sample diffs and approve them individually. The real workflow applies approved patches to demo copies. These controls only change this page.',
  'P1 stays urgent across services. Unknown codes go to review instead of silently becoming low priority. Our working backend supports real MCP delivery and durable PostgreSQL storage; this screen is a deterministic illustration, not evidence of a live model run. Independent agents. Shared context.',
];

export default function Walkthrough() {
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [selected, setSelected] = useState(1);
  const [approved, setApproved] = useState<boolean[]>([false, false, false]);
  const [showNotes, setShowNotes] = useState(false);
  const allApproved = approved.every(Boolean);
  function advance() { const next = Math.min(5, step + 1); setStep(next); setFurthest(v => Math.max(v, next)); }
  function reset() { setStep(0); setFurthest(0); setSelected(1); setApproved([false, false, false]); setShowNotes(false); }
  const patch = patches[selected];

  return <div className="walkthrough">
    <header className="wt-top"><a href="/" className="wt-brand">civitas</a><span className="wt-disclosure">Scripted demo · sample people, replies and patches</span><div className="wt-links"><a href="/demo/film">Watch tour</a><a href="/demo/replay">Animated replay / live run</a><a href="/demo/pitch.md" download>Pitch script</a><Button size="sm" variant="ghost" icon={<RotateCcw size={14}/>} onClick={reset}>Reset demo</Button></div></header>
    <div className="wt-layout">
      <aside className="wt-sidebar"><div className="wt-space"><LockKeyhole size={17}/><div><strong>Maintenance team</strong><small>Private group · sample workspace</small></div></div><p className="wt-nav-label">Demo chapters</p><nav aria-label="Demo chapters">{steps.map((label, i) => <button key={label} disabled={i > furthest} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}><span>{i < furthest ? <Check size={14}/> : i + 1}</span>{label}</button>)}</nav><div className="wt-team"><p className="wt-nav-label"><Users size={14}/> People & their agents</p>{people.map(([name, agent]) => <div className="wt-person" key={name}><Avatar name={name} small/><div><strong>{name}</strong><small><Bot size={12}/> {agent}</small></div></div>)}</div><p className="wt-local">No sign-in or model key needed.<br/>All interactions stay on this page.<br/>Reset or refresh to start again.</p></aside>
      <main className="wt-main">
        <header className="wt-heading"><div><p>Maintenance API v2</p><h1>{['Your team has agents. Give them shared context.', 'Ask an agent, together.', 'Understand the change before sharing it.', 'You decide what gets shared.', 'One update. Three proposed patches.', 'The meaning survives the migration.'][step]}</h1></div><Badge>{step + 1} / {steps.length}</Badge></header>
        <div className="wt-scene" key={step}>
          {step <= 1 && <section aria-label="Sample team conversation" className="wt-conversation">
            <div className="wt-room"><MessageSquare size={18}/><strong>Activity</strong><span>People and connected agents</span></div>
            <article className="wt-message"><Avatar name="Alex"/><div><strong>Alex <small>Sample message</small></strong><p>Maintenance API v2 is out. The SDK, triage UI and dispatch service all depend on it. Can we coordinate the migration here?</p></div></article>
            <article className="wt-message"><Avatar name="Sam"/><div><strong>Sam</strong><p>I own triage. We need to preserve what “urgent” means, not just rename a field.</p></div></article>
            <article className="wt-message"><Avatar name="Jordan"/><div><strong>Jordan</strong><p>I’ll handle dispatch. Let’s share one reviewed update so our agents work from the same evidence.</p></div></article>
            {step === 0 ? <div className="wt-composer"><Badge tone="accent">To Sam’s triage agent</Badge><p>What does Maintenance API v2 change for triage?</p><Button variant="primary" onClick={advance} iconRight={<ArrowRight size={16}/>}>Send sample question</Button></div> : <>
              <article className="wt-message"><Avatar name="Sam"/><div><strong>Sam <small>To triage agent</small></strong><p>What does Maintenance API v2 change for triage?</p></div></article>
              <article className="wt-message wt-agent-message"><AgentAvatar/><div><strong>Triage agent <Badge tone="accent">Scripted reply</Badge></strong><p>The field changes from <code>priority</code> to <code>priority_code</code>. Before we update the UI, we should verify the new codes against the changelog. A rename alone could mislabel urgent work.</p><details><summary>Context shared with this agent</summary><p>This selected question and published group knowledge. The owner’s private coding chat is excluded. Chat tools are disabled.</p></details></div></article>
              <div className="wt-action"><p>Turn the discovery into a source-linked update.</p><Button variant="primary" onClick={advance}>Analyze sample API change</Button></div>
            </>}
          </section>}
          {step === 2 && <section className="wt-evidence"><div className="wt-section-title"><AgentAvatar/><div><h2>Change analyst</h2><p>Scripted analysis of the repository’s API-change scenario</p></div></div><div className="wt-analysis-columns"><div><h3>Plan</h3>{['Read v1 and v2 contracts', 'Compare contract changes and consumer impact', 'Cite sources and flag unknowns', 'Prepare a packet for owner review'].map(item => <p className="wt-check" key={item}><Check size={16}/>{item}</p>)}<div className="wt-specialists"><Badge tone="accent">Contract specialist</Badge><Badge tone="accent">Impact specialist</Badge></div></div><div><h3>Evidence</h3><p><FileText size={14}/> openapi-v1.yaml → openapi-v2.yaml</p><p><code>priority</code> becomes <code>priority_code</code>.</p><p><FileText size={14}/> CHANGELOG.md</p><p><strong>P1 = urgent.</strong> P2 and P3 have no documented meaning.</p><p className="wt-caution">Preserve unknown codes for manual review.</p></div></div><div className="wt-action"><p>Analysis prepares a draft. Sharing requires approval.</p><Button variant="primary" onClick={advance}>Review proposed update</Button></div></section>}
          {step === 3 && <section className="wt-packet"><div className="wt-section-title"><ShieldCheck size={30}/><div><h2>Share this update with 3 services?</h2><p>Review the exact sample packet</p></div><StatusPill status="waiting" label="Waiting for you"/></div><blockquote><h3>Maintenance API v2: preserve priority semantics</h3><ul><li>Replace <code>priority</code> with <code>priority_code</code>.</li><li>Map P1 to urgent, per the changelog.</li><li>Keep P2 and P3 unresolved; route them to manual review.</li><li>The legacy <code>/work-orders</code> endpoint sunsets on March 31, 2027.</li></ul><p>Sources: v1 contract, v2 contract, changelog</p></blockquote><p className="wt-boundary"><LockKeyhole size={16}/> Only this selected packet is shared with authorized subscribers.</p><div className="wt-action"><Button variant="ghost" onClick={() => setStep(2)}>Back to evidence</Button><Button variant="primary" onClick={advance}>Approve & share sample update</Button></div></section>}
          {step === 4 && <section className="wt-rollout"><div className="wt-published"><ShieldCheck size={18}/><strong>Sample version 1 shared</strong><span>Same source-linked context for all three services</span></div><div className="wt-service-tabs" role="tablist" aria-label="Service patches">{services.map((name, i) => <button key={name} role="tab" aria-selected={selected === i} aria-controls="sample-patch" id={`service-${i}`} onClick={() => setSelected(i)}><Bot size={18}/><strong>{name}</strong><StatusPill status={approved[i] ? 'done' : 'waiting'} label={approved[i] ? 'Sample approved' : 'Review patch'}/></button>)}</div><div className="wt-diff" id="sample-patch" role="tabpanel" aria-labelledby={`service-${selected}`} tabIndex={0}><header><h2>{services[selected]} patch</h2><code>{patch.file}</code><Badge>Illustrative diff</Badge></header><pre><code><span className="wt-removed">− {patch.before}</span>{'\n'}<span className="wt-added">+ {patch.after}</span></code></pre><p>Preview only. Approving changes this demo’s state; it does not edit files.</p><Button disabled={approved[selected]} variant={allApproved ? 'secondary' : 'primary'} onClick={() => setApproved(old => old.map((value, i) => i === selected ? true : value))}>{approved[selected] ? 'Sample patch approved' : `Approve ${services[selected]} sample patch`}</Button></div><div className="wt-action"><p role="status">{approved.filter(Boolean).length} of 3 sample patches approved. Select each service to review.</p><Button variant={allApproved ? 'primary' : 'secondary'} disabled={!allApproved} onClick={advance}>See the result</Button></div></section>}
          {step === 5 && <section className="wt-result"><StatusPill status="done" label="Sample rollout complete"/><h2>Independent agents. Shared context.</h2><div className="wt-outcomes"><div><p>P1</p><strong>Urgent maintenance</strong><span>Known meaning preserved</span></div><div><p>P2 / P3</p><strong>Needs review</strong><span>Uncertainty stays visible</span></div></div><p>One reviewed update informed three service-specific patches. Every decision in this walkthrough was simulated locally.</p><details><summary>What is real behind this demo?</summary><p>The project implements credential-scoped MCP messaging, immutable context versions, durable PostgreSQL storage, reviewed analyst/adapter workflows and native agent chat. This walkthrough does not call those services or demonstrate a fresh model run. Patches in the actual demo workflow apply to separate demo copies.</p></details><div className="wt-action"><Button variant="secondary" onClick={reset} icon={<RotateCcw size={16}/>}>Start again</Button><Button variant="primary" href="/">Open Civitas</Button></div></section>}
        </div>
        <footer className="wt-presenter"><button aria-expanded={showNotes} aria-controls="presenter-notes" onClick={() => setShowNotes(v => !v)}>{showNotes ? 'Hide' : 'Show'} presenter notes</button><span>Presenter-paced · no timers or API calls</span>{showNotes && <p id="presenter-notes">{notes[step]}</p>}</footer>
      </main>
    </div>
  </div>;
}
