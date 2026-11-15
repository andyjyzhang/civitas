'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, Bot, Check, ChevronDown, ChevronsUpDown, Circle, Code2, FileText, GitBranch, Inbox, Link2, MessageSquare, MoreHorizontal, MousePointer2, Pause, Play, Plus, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { AgentAvatar, Avatar, Badge, Button, Card, PageHeader, StatusPill } from '../../components/ui';
import '../../styles/activity.css';
import '../../styles/people.css';
import '../../styles/agents.css';
import './film.css';

import story from './story.json';
export const filmScenes = story.scenes;
const DURATION = story.duration;
const nav = [{ name: 'Activity', Icon: Activity }, { name: 'Inbox', Icon: Inbox }, { name: 'Agents', Icon: Bot }, { name: 'Members', Icon: Users }];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const typed = (text: string, t: number, start: number, length: number) => text.slice(0, Math.floor(text.length * clamp((t - start) / length)));

function FeedRow({ who, agent, children, status, statusKind = 'working', at = 'just now' }: { who: string; agent?: boolean; children: ReactNode; status?: string; statusKind?: 'working' | 'done' | 'waiting'; at?: string }) {
  return <article className="fe msg film-appear"><div className="fe-gutter">{agent ? <AgentAvatar/> : <Avatar name={who}/>}</div><div className="fe-body"><p className="fe-line"><strong>{who}</strong>{agent && <Badge>Agent</Badge>}{status && <StatusPill status={statusKind} label={status}/>}<time>{at}</time></p><div className="msg-text">{children}</div></div></article>;
}

export default function Film() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [capture, setCapture] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState({left:0, top:0});
  useEffect(() => { setCapture(new URLSearchParams(window.location.search).has('capture')); }, []);
  useEffect(() => {
    const seek = (event: Event) => { setPlaying(false); setTime(Math.max(0, Math.min(DURATION, Number((event as CustomEvent).detail) || 0))); };
    window.addEventListener('civitas-film-seek', seek);
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setPlaying(p => !p); } };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('civitas-film-seek', seek); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => {
    if (!playing || time >= DURATION) return;
    let previous = performance.now();
    const interval = setInterval(() => { const now = performance.now(); setTime(t => Math.min(DURATION, t + (now - previous) / 1000)); previous = now; }, 40);
    return () => clearInterval(interval);
  }, [playing, time >= DURATION]);
  const sceneIndex = Math.max(0, filmScenes.findLastIndex(scene => time >= scene.at));
  const scene = filmScenes[sceneIndex];
  const index = scene.view;
  const local = time - scene.at;
  const section = [1,7].includes(index) ? 'Members' : [3,10,11].includes(index) ? 'Agents' : 'Activity';
  const sent = index === 2 && local >= 4.5;
  const replied = index === 2 && local >= 8.1;
  const approved = [5,6,11].includes(index) || (index === 4 && local >= 6.3);
  const patchApproved = index === 5 && local >= 8.3;
  useLayoutEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [index, sent, replied, patchApproved, index === 5 && local > 4.4]);
  useLayoutEffect(() => {
    const selector = index === 2 ? '.composer-send' : index === 4 ? '.film-share-target' : index === 5 ? '.film-apply-target' : '';
    const target = selector ? document.querySelector(selector) : null;
    const window = document.querySelector<HTMLElement>('.film-window');
    if (!target || !window) return;
    const rect = target.getBoundingClientRect(), outer = window.getBoundingClientRect();
    const scale = outer.width / window.offsetWidth;
    const next = {left:(rect.left + rect.width*.58 - outer.left)/scale, top:(rect.top + rect.height*.55 - outer.top)/scale};
    setCursorPosition(old => Math.abs(old.left-next.left) > .5 || Math.abs(old.top-next.top) > .5 ? next : old);
  }, [index, local]);
  const composerText = index === 1 ? '' : index === 2 && local < 4.5 ? typed('What does API v2 change for our triage service?', local, .8, 2.5) : '';
  // The UI elements below use the product's real classes and primitives. Only the illustrative data and pacing are scripted.
  return <main className={`film ${capture ? 'film-capture' : ''}`} data-scene={scene.name} data-time={time.toFixed(2)}>
    <header className="film-masthead"><a href="/" className="film-wordmark">civitas</a><div className="film-chapters">{filmScenes.map((s, i) => <button key={s.name} className={i === sceneIndex ? 'current' : i < sceneIndex ? 'past' : ''} onClick={() => { setTime(s.at); setPlaying(true); }}>{s.name}</button>)}</div><span className="film-disclosure">Illustrative product walkthrough</span></header>
    <div className="film-title" key={scene.name}><h1>{scene.title}</h1></div>
    <div className={`film-window film-camera-${index}`}>
      <div className="app film-product">
        <aside className="app-sidebar" aria-label="Product sidebar"><div className="switcher"><button className="switcher-button" tabIndex={-1}><span className="group-mark">M</span><span>Maintenance team</span><ChevronsUpDown/></button></div><nav className="nav" aria-label="Product navigation">{nav.map(({name, Icon}) => <button key={name} className="nav-link" aria-current={section === name ? 'page' : undefined} tabIndex={-1}><Icon/>{name}{name === 'Inbox' && index === 4 && !approved && <span className="count-badge">1</span>}</button>)}</nav><div className="account-menu"><button className="account-button" tabIndex={-1}><Avatar name="Andy" small/><span>Andy</span><ChevronsUpDown/></button></div></aside>
        <div className="app-main"><div className="app-content">
          {index === 7 ? <ConnectionScene local={local}/> : index === 8 ? <ContextScene local={local}/> : index === 9 ? <ChangeScene local={local}/> : index === 10 ? <EvidenceScene local={local}/> : index === 11 ? <TraceScene local={local}/> : index === 0 ? <div className="page film-overview">
            <PageHeader title="Civitas" description="A shared context network for independently owned AI agents."/>
            <Card className="film-overview-main"><div className="film-overview-avatars"><span style={{animationDelay:'.15s'}}><Avatar name="Andy"/></span><span style={{animationDelay:'.35s'}}><Avatar name="Ryan"/></span><span style={{animationDelay:'.55s'}}><AgentAvatar/></span><span style={{animationDelay:'.75s'}}><AgentAvatar/></span></div><h2>Your team’s knowledge, connected.</h2><p>People collaborate in private groups. Their agents share selected, versioned context through MCP.</p><div className="film-overview-flow"><span><MessageSquare/>Team chat</span><ArrowRight/><span><FileText/>Shared context</span><ArrowRight/><span><Bot/>Connected agents</span></div></Card>
            <div className="film-overview-grid">{[{Icon:Users,title:'Collaborate',text:'People and their agents, in one group.'},{Icon:Link2,title:'Share context',text:'Source-linked updates across services.'},{Icon:ShieldCheck,title:'Stay in control',text:'Review updates and patches before applying.'}].map(({Icon,title,text},i)=><Card key={title} className="film-stagger" style={{animationDelay:`${.6+i*.25}s`}}><Icon/><h3>{title}</h3><p>{text}</p></Card>)}</div>
          </div> : index === 1 ? <div className="page film-members" key="members"><PageHeader title="Members" description="People and agents in Maintenance team." actions={<Button size="sm" icon={<Plus/>}>Invite people</Button>}/><Card title="People" padded={false}><table className="table"><thead><tr><th>Person</th><th>Role</th><th/></tr></thead><tbody><tr><td><Avatar name="Andy"/> <strong>Andy</strong> <span className="subtle">(you)</span></td><td>Owner</td><td/></tr>{local >= 1.2 && <tr className="film-appear"><td><Avatar name="Ryan"/> <strong>Ryan</strong></td><td>Member</td><td><Badge tone="done">Joined</Badge></td></tr>}</tbody></table></Card><Card title="Agents" actions={<Button size="sm" icon={<Plus/>}>Connect agent</Button>} padded={false}><div className="list">{[{name:'Andy’s Codex',kind:'Codex',at:2.2},{name:'Ryan’s Claude',kind:'Claude Code',at:3.6}].map(a=>local>=a.at&&<div className="list-row film-appear" key={a.name}><AgentAvatar/><div className="row-main"><strong>{a.name}</strong><small className="subtle">{a.kind} · Owner’s local receiver</small></div><StatusPill status="done" label="Listening"/></div>)}</div></Card><div className="notice film-members-note"><ShieldCheck size={18}/><span>Each person keeps their own agent account. Only selected messages and context are shared.</span></div></div>
          : index === 3 ? <div className="page page-wide film-analysis" key="analysis"><PageHeader title="Agents" description="Follow each run step by step: plan, evidence, patches and approvals." actions={<Button size="sm" icon={<Plus/>}>New analysis</Button>}/><div className="ag-split"><div className="ag-side"><Card title="Runs" padded={false}><div className="list-row ag-run-row" aria-current="true"><Sparkles className="ag-row-icon"/><span className="ag-run-text"><span className="ag-run-title">Analyze Maintenance API</span><span className="subtle">just now</span></span><StatusPill status="working" label="Working"/></div></Card><Card title="Services" padded={false}><div className="list">{['SDK decoder','Triage UI','Dispatch service'].map(name=><div className="list-row" key={name}><Code2 size={16}/><span className="row-main">{name}<small className="subtle">Listening for updates</small></span></div>)}</div></Card></div><article className="card ag-detail"><header className="ag-detail-head"><div className="ag-detail-title"><div><h2>Analyze Maintenance API</h2><StatusPill status={local >=7?'waiting':'working'} label={local>=7?'Needs your review':'Working'}/></div><p className="ag-meta">Maintenance API v1 → v2</p></div><MoreHorizontal size={18}/></header><section className="ag-section"><div className="ag-section-head"><h3>Plan</h3><span className="ag-progress"><span style={{width:`${clamp(local/6.7)*100}%`}}/></span></div><ul className="ag-plan">{['Read the API contracts and changelog','Compare contract changes and consumer impact','Cite the evidence; flag unknown meanings','Prepare one update for review'].map((text,i)=><li key={text} className={local >1+i*1.5?'completed':''}>{local>1+i*1.5?<Check/>:<Circle/>}<span>{text}</span></li>)}</ul></section><section className="ag-section"><div className="film-specialists">{['Contract','Impact'].map((s,i)=><div key={s} className={local>1?'active':''}><GitBranch size={18}/><strong>{s}</strong><span>{local>5+i*.4?'Done':'Working in parallel'}</span></div>)}</div></section><div className="tabs">{['openapi-v1.yaml','openapi-v2.yaml','CHANGELOG.md'].map((f,i)=><button key={f} aria-selected={Math.floor(local)%3===i}><FileText size={13}/>{f}</button>)}</div>{local>5.8&&<div className="notice film-appear"><ShieldCheck size={18}/><span>P1 = urgent, cited in CHANGELOG.md. P2 and P3 remain unresolved.</span></div>}</article></div></div>
          : <div className="activity" key={index === 2 ? 'chat' : 'workflow'}><header className="activity-head"><div><h1>{section}</h1><p>{'Messages and agent updates in Maintenance team.'}</p></div><Button size="sm" icon={<Plus/>}>New analysis</Button></header><div className="activity-feed" ref={feed}><div className="activity-col"><div className="day-divider"><span>Today</span></div>
            {index === 2 ? <>
              <FeedRow who="Ryan" at="2m ago">Maintenance API v2 is ready. Can we check the services before rolling out?</FeedRow>
              <FeedRow who="Andy" at="1m ago">Let’s check the contract and keep the rollout here.</FeedRow>
              {sent && <FeedRow who="Andy → Andy’s Codex" status={replied?'Replied':local>6?'Replying…':'Sending…'} statusKind={replied?'done':'working'}>What does API v2 change for our triage service?</FeedRow>}
              {sent&&!replied&&<div className="film-typing film-appear"><AgentAvatar small/><span/><span/><span/></div>}
              {replied&&<FeedRow who="Andy’s Codex" agent><p>v2 replaces <code>priority</code> with <code>priority_code</code>.</p><p><strong>P1 means urgent.</strong> P2 and P3 are undocumented, so keep them in manual review.</p><div className="film-citation"><FileText size={13}/>CHANGELOG.md <Badge>Selected context</Badge></div></FeedRow>}
              {local>10.8&&<FeedRow who="Ryan">Let’s share a reviewed update with SDK and dispatch, too.</FeedRow>}
            </> : <>
              <FeedRow who="Analyst agent" agent status={approved?'Shared':'Needs your review'} statusKind={approved?'done':'waiting'}><span>{approved?'Shared an update with 3 services.':'Proposed an update for review.'}</span><div className={`rv-card ${!approved?'rv-waiting':''}`}><div className="rv-title"><strong>Maintenance API v2: priority codes</strong><Badge tone="failed">Breaking</Badge></div><ul className="rv-bullets"><li><code>priority</code> → <code>priority_code</code></li><li>P1 = urgent · source: CHANGELOG.md</li><li>P2 and P3 → manual review</li><li>/work-orders sunset: March 31, 2027</li></ul>{index===4&&!approved?<><p className="rv-question">Share this update with 3 services?</p><div className="page-actions"><Button variant="primary" size="sm" className={`film-share-target ${local>6?'film-click':''}`} icon={<Check/>}>Approve and share</Button><Button size="sm">Reject…</Button><Button variant="ghost" size="sm">View full report</Button></div></>:<p className="film-shared"><Check size={16}/>Approved and shared</p>}
              {index>=5&&<section className="rollout"><header><h3>Rollout</h3><span className="subtle rollout-all">{index===6?'3 of 3 updated':'Three connected services'}</span></header><ul>{['SDK decoder','Triage UI','Dispatch service'].map((name,i)=>{
                const phase=index===6?99:local-i*.65;
                const done=phase>(i===1?7.65:6.3);
                const waiting=phase>3.8&&!done;
                return <li key={name}><span className="rollout-name">{name}</span><StatusPill status={done?'done':waiting?'waiting':'working'} label={done?'Updated':waiting?'Needs your review':phase<1?'Received':'Reading code'}/><span className="rollout-act">{done?<Check size={16} className="film-done"/>:waiting?<Button size="sm">Review</Button>:<span className="film-working-dot"/>}</span></li>;
              })}</ul></section>}
              </div></FeedRow>
              {index===5&&local>4.4&&local<9.8&&<FeedRow who="Triage adapter" agent status={patchApproved?'Updated':'Needs your review'} statusKind={patchApproved?'done':'waiting'}><div className="rv-card rv-waiting film-patch-card"><div className="rv-title"><strong>Preserve urgent maintenance in triage</strong></div><div className="rv-diff"><div className="del"><span>−</span>priority: 'urgent'</div><div className="add"><span>+</span>priority_code: 'P1'</div><div className="add"><span>+</span>unknown code → 'Needs review'</div></div><div className="page-actions"><Button variant={patchApproved?'secondary':'primary'} size="sm" className={`film-apply-target ${local>8&&local<8.5?'film-click':''}`}>{patchApproved?<><Check size={14}/>Patch applied to demo copy</>:'Apply patch'}</Button><Button variant="ghost" size="sm">View full diff</Button></div></div></FeedRow>}
              {index===6&&<FeedRow who="Triage adapter" agent status="Updated" statusKind="done"><div className="film-result card"><div><p className="subtle">Before · v1 code reads v2</p><h3>Low priority</h3></div><ArrowRight/><div><p className="subtle">After · expected behavior</p><h3>Urgent maintenance</h3><Badge tone="waiting">P2 · Needs review</Badge></div></div><p className="film-result-note">Illustrative outcome · no measured run time or cost</p></FeedRow>}
            </>}
          </div></div>{index===2&&<div className="activity-composer"><div className={`composer-box ${local>1?'to-agent':''}`}><div className="film-composer-text">{composerText || <span className="subtle">{sent?'Message sent':'Message Maintenance team…'}</span>}{composerText&&<span className="film-caret"/>}</div><div className="composer-footer"><label className="composer-to">Send to <span className="film-select">{local>.7?'Andy’s Codex':'People'}<ChevronDown size={12}/></span></label><span className="composer-hint">{local>.7?'Only this message is sent to the agent.':'Visible to people in this group.'}</span><Button size="sm" className={`composer-send ${local>4&&local<4.5?'film-click':''}`} icon={<Send/>}>Send</Button></div></div></div>}
          </div>}
        </div></div>
      </div>
      {(index===2&&local>3.5&&local<5.2)||(index===4&&local>4.5&&local<6.8)||(index===5&&local>7&&local<8.7)?<div style={cursorPosition} className={`film-cursor cursor-${index} ${((index===2&&local>4.1)||(index===4&&local>6)||(index===5&&local>8))?'clicking':''}`}><MousePointer2 fill="white" size={28}/></div>:null}
    </div>
    <footer className="film-caption"><p key={sceneIndex}>{scene.caption}</p><div className="film-progress"><span style={{width:`${time/DURATION*100}%`}}/></div></footer>
    {!capture&&<div className="film-controls"><Button size="sm" variant="ghost" onClick={()=>{if(time>=DURATION)setTime(0);setPlaying(p=>!p);}} icon={playing&&time<DURATION?<Pause/>:<Play/>}>{playing&&time<DURATION?'Pause':'Play'}</Button><input type="range" min="0" max={DURATION} step=".1" value={time} aria-label="Film position" onChange={e=>{setTime(Number(e.target.value));setPlaying(false);}}/><span>{Math.floor(time)} / {DURATION}s</span><Button size="sm" href="/demo">Full workflow & live mode</Button></div>}
  </main>;
}

function ConnectionScene({local}: {local:number}) {
  return <div className="page film-extra"><PageHeader title="Members" description="Connect an agent using the account you already use."/><section className="modal film-inline-modal"><h2>Connect Codex</h2><p>Connect and start automatic chat replies using your Codex account. No model API key needed.</p><h3>1. Run in your Civitas checkout</h3><pre className="setup-command">npm run link -- codex --relay YOUR_RELAY_URL{'\n'}  --code YOUR_ONE_TIME_CODE --listen</pre><p className="subtle">Command shape only · generate a private, single-use code in Members.</p>{local>2&&<div className="film-appear"><h3>2. Keep the receiver terminal open</h3><p className="subtle">It receives addressed messages and replies using your existing CLI login and usage allowance.</p></div>}{local>4.5&&<div className="film-appear"><h3>3. Verify the connection</h3><div className="film-link-check"><AgentAvatar/><span>Andy’s Codex</span><StatusPill status="done" label="Listening"/></div><Button size="sm">Send connection check</Button></div>}<p className="film-explainer">Each person connects their own receiver. Chat generation still takes normal model response time.</p></section></div>;
}
function ContextScene({local}: {local:number}) {
  const selected=['The message addressed to this agent','Recent context updates shared with the group','Recent exchanges addressed to this agent'];
  return <div className="page film-extra"><PageHeader title="Selected context" description="What the local chat receiver can use for its reply."/><Card title="Sent to the connected agent" padded={false}><div className="list">{selected.map((text,i)=>local>i*.9&&<div key={text} className="list-row film-appear"><Check size={16} className="film-done"/><span className="row-main">{text}</span><Badge tone="done">Included</Badge></div>)}</div></Card>{local>3&&<Card title="Kept separate" className="film-appear"><div className="film-context-boundary"><ShieldCheck/><div><h3>Your private coding conversation</h3><p>Connecting an agent does not copy its private chat history into the group.</p></div></div></Card>}{local>5.5&&<div className="notice film-appear"><ShieldCheck size={18}/><span>Chat tools are disabled. Replies do not run commands or edit files.</span></div>}</div>;
}
function ChangeScene({local}: {local:number}) {
  return <div className="page film-extra"><PageHeader title="Maintenance API v2" description="Synthetic API and consumer repositories used for this demonstration."/><Card title="Breaking field replacement"><div className="film-change-compare"><div><Badge>v1 response</Badge><pre className="code-block">{'{\n  "priority": "urgent"\n}'}</pre></div><ArrowRight/><div><Badge tone="waiting">v2 response</Badge><pre className="code-block">{'{\n  "priority_code": "P1"\n}'}</pre></div></div></Card><Card title="Three services depend on this contract" padded={false}><div className="list">{[{name:'SDK decoder',text:'Parses the API response'},{name:'Triage UI',text:'Shows priority to operators'},{name:'Dispatch service',text:'Routes maintenance work'}].map((item,i)=>local>1+i*.8&&<div className="list-row film-appear" key={item.name}><Code2 size={18}/><div className="row-main"><strong>{item.name}</strong><small className="subtle">{item.text}</small></div><StatusPill status="waiting" label="Needs update"/></div>)}</div></Card></div>;
}
function EvidenceScene({local}: {local:number}) {
  const tab=local<3?'openapi-v2.yaml':local<7?'CHANGELOG.md':'Evidence summary';
  return <div className="page film-extra"><PageHeader title="Sources and evidence" description="Inspect the files behind the analyst’s proposed update."/><article className="card ag-detail"><header className="ag-detail-head"><div className="ag-detail-title"><div><h2>Analyze Maintenance API</h2><StatusPill status="waiting" label="Needs your review"/></div><p className="ag-meta">Maintenance API v1 → v2 · synthetic source fixture</p></div></header><div className="tabs">{['openapi-v2.yaml','CHANGELOG.md','Evidence summary'].map(name=><button key={name} aria-selected={name===tab}><FileText size={13}/>{name}</button>)}</div><div key={tab} className="film-appear">{local<3?<pre className="code-block film-evidence-code">{'PriorityCode:\n  type: string\n  enum: [P1, P2, P3]\n\n# The schema lists codes.\n# Their business meaning needs another source.'}</pre>:local<7?<pre className="code-block film-evidence-code">{'CHANGELOG.md — selected excerpt\n\nP1 is the direct successor of the former urgent priority.\n\nP2/P3 semantics will be finalized with the operations team;\ndo not assume P2 = normal or P3 = low.\n\nGET /work-orders/{id} is deprecated.\nRemoval is planned for 2027-03-31.'}</pre>:<ul className="film-evidence-list"><li><Check/>P1 = urgent · documented in CHANGELOG.md</li><li><ShieldCheck/>P2, P3 · unresolved → manual review</li><li><FileText/>Legacy endpoint · sunset March 31, 2027</li></ul>}</div></article><p className="film-explainer">An allowed enum value is not a documented business meaning. Unknown mappings stay explicit.</p></div>;
}
function TraceScene({local}: {local:number}) {
  const steps=[{name:'Plan and delegate',text:'Contract and Impact specialists',icon:GitBranch},{name:'Read sources',text:'openapi-v1.yaml · openapi-v2.yaml · CHANGELOG.md',icon:FileText},{name:'Review and share',text:'Owner approves the context update',icon:ShieldCheck},{name:'Review and apply',text:'Adapters propose diffs; owner approves patches',icon:Code2}];
  return <div className="page film-extra"><PageHeader title="Run detail" description="Inspect the path from source evidence to approved changes."/><Card title="Timeline" description="Illustrative sequence, matching the workflow shown." padded={false}><div className="list">{steps.map((s,i)=>local>i*.8&&<div className="list-row film-appear" key={s.name}><s.icon size={18}/><div className="row-main"><strong>{s.name}</strong><small className="subtle">{s.text}</small></div><Check size={16} className="film-done"/></div>)}</div></Card>{local>3.6&&<Card title="Source-linked context version" className="film-appear"><div className="film-version-row"><Badge>Version 1</Badge><span>Maintenance API v2: priority codes</span><Badge tone="done">Immutable</Badge></div><p className="film-explainer">Later corrections create a new version. The original shared context remains available.</p></Card>}</div>;
}
