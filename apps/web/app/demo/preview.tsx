'use client';

// Entirely local presentation state. This page never mounts the live shell,
// account hooks, run streams or API-backed decision/download handlers.
import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { Activity, Bot, Check, ChevronsUpDown, Inbox, Menu, Plus, RotateCcw, Users } from 'lucide-react';
import { Composer, Message } from '../activity/activity-view';
import { AnalystReview, PatchReview } from '../agents/review';
import { AgentAvatar, Avatar, Badge, Button, Card, EmptyState, Page, PageHeader, StatusPill } from '../components/ui';
import { agents, initialPreviewState, packet, previewReducer, replyDelays, services, visibleRoom, type PreviewAction, type PreviewState } from './preview-data';
import '../styles/people.css';
import './preview.css';

type Tab = 'activity'|'inbox'|'agents'|'members';
const navigation = [{ id:'activity', label:'Activity', Icon:Activity },{ id:'inbox', label:'Inbox', Icon:Inbox },{ id:'agents', label:'Agents', Icon:Bot },{ id:'members', label:'Members', Icon:Users }] as const;
const hidden = new Set<string>();
const unchanged = async () => {};
const previewLabel = <Badge title="Prepared agents, preset responses and local approvals. Nothing is sent to real agents, APIs or databases.">Offline preview</Badge>;

export default function Preview() {
  const [state, dispatch] = useReducer(previewReducer, undefined, () => initialPreviewState());
  const [tab, setTab] = useState<Tab>('activity');
  const [recipient, setRecipient] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const stream = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const room = visibleRoom(state);
  const title = navigation.find(n=>n.id===tab)!.label;
  const pending = (state.phase === 'review' ? 1 : 0) + Object.values(state.patches).filter(p=>p==='ready').length;
  useEffect(() => { dispatch({type:'reset',at:Date.now()}); return () => { timers.current.forEach(clearTimeout); timers.current.clear(); }; }, []);
  useEffect(() => { if (stream.current) stream.current.scrollTop=stream.current.scrollHeight; }, [state.room.posts.length, state.phase, tab]);
  function select(next: Tab) { setTab(next); setNavOpen(false); setAccountOpen(false); setGroupOpen(false); }
  function reset() {
    timers.current.forEach(clearTimeout); timers.current.clear();
    dispatch({type:'reset',at:Date.now()}); setRecipient(''); setEpoch(v=>v+1); select('activity');
  }
  async function post(content: string, target: string) {
    const id='preview_message_'+crypto.randomUUID();
    dispatch({type:'send',id,content,recipient:target,at:Date.now()});
    if (!agents.some(a=>a.agentId===target)) return;
    const timer=setTimeout(()=>{timers.current.delete(timer);dispatch({type:'reply',messageId:id,at:Date.now()});},replyDelays[target] ?? 2000);
    timers.current.add(timer);
  }
  const analysis = () => { dispatch({type:'analyze'}); select('activity'); };
  const analysisButton = <Button variant="secondary" size="sm" icon={<Plus/>} disabled={!['idle','rejected'].includes(state.phase)} onClick={analysis}>New analysis</Button>;

  const feedItems = room.posts.map(p=><Message key={p.postId} post={p} own={p.authorId===room.currentAccountId} continued={false} parent={room.posts.find(parent=>parent.postId===p.replyTo)} receiver={room.agents.find(a=>a.agentId===p.targetAgentId)} canReply={p.origin==='agent'} onAsk={setRecipient} now={state.now}/>);
  if (state.phase !== 'idle') feedItems.splice(state.packetIndex, 0, <article key="preview_packet" className="fe"><div className="fe-gutter"><AgentAvatar/></div><div className="fe-body"><p className="fe-line"><strong>{state.phase==='shared'?'Andy shared an update':'David’s Claude prepared an update'}</strong></p><PacketCard state={state} dispatch={dispatch} onReview={()=>select('inbox')}/></div></article>);

  return <div className="app preview-shell" data-nav-open={navOpen}>
    <aside className="app-sidebar" id="preview-sidebar" aria-label="Sidebar">
      <div className="switcher"><button className="switcher-button" aria-expanded={groupOpen} aria-haspopup="menu" onClick={()=>setGroupOpen(v=>!v)}><span className="group-mark">L</span><span>{room.space.name}</span><ChevronsUpDown/></button>
        {groupOpen && <div className="menu" role="menu"><div className="menu-label">Groups</div><button className="menu-item" role="menuitemradio" aria-checked onClick={()=>setGroupOpen(false)}><span className="group-mark">L</span><span>{room.space.name}</span><Check className="check"/></button></div>}
      </div>
      <nav className="nav" aria-label="Main">{navigation.map(({id,label,Icon})=><button type="button" key={id} className="nav-link" aria-current={tab===id?'page':undefined} onClick={()=>select(id)}><Icon aria-hidden="true"/>{label}{id==='inbox'&&pending>0&&<span className="count-badge">{pending}</span>}</button>)}</nav>
      <div className="account-menu">
        {accountOpen&&<div className="menu" role="menu"><div className="menu-label">Offline product preview</div><button className="menu-item" role="menuitem" onClick={reset}><RotateCcw/>Reset preview</button><a className="menu-item" role="menuitem" href="/demo/pitch.md" download>Pitch script</a><a className="menu-item" role="menuitem" href="/">Open Civitas</a></div>}
        <button className="account-button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={()=>setAccountOpen(v=>!v)}><Avatar name="Andy" small/><span>Andy</span><ChevronsUpDown/></button>
      </div>
    </aside>
    <button type="button" className="sidebar-scrim" aria-label="Close navigation" tabIndex={-1} onClick={()=>setNavOpen(false)}/>
    <div className="app-main">
      <header className="app-topbar"><div className="breadcrumb"><Button className="menu-toggle" variant="ghost" size="sm" iconOnly icon={<Menu/>} aria-label="Open navigation" aria-controls="preview-sidebar" aria-expanded={navOpen} onClick={()=>setNavOpen(true)}/><span className="crumb-group">{room.space.name}</span><span className="sep">/</span><span aria-current="page">{title}</span></div></header>
      <main className="app-content">
        {tab==='activity'&&<div className="activity">
          <header className="activity-head"><div><h1>Activity</h1><p>Messages and agent updates in {room.space.name}.</p></div><div className="page-actions">{previewLabel}{analysisButton}</div></header>
          <div className="activity-feed" ref={stream} role="log" aria-label="Activity" aria-live="polite" tabIndex={0}><div className="activity-col">
            {feedItems}
          </div></div>
          <Composer key={epoch} room={room} spaceId={room.space.spaceId} recipient={recipient} setRecipient={setRecipient} onSent={unchanged} onPost={post} hidden={hidden}/>
        </div>}
        {tab==='members'&&<Page>
          <PageHeader title="Members" description={`People and agents in ${room.space.name}.`} actions={previewLabel}/>
          <Card title={`People · ${room.members.length}`} padded={false}><div className="table-wrap"><table className="table people-table"><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody>{room.members.map(m=><tr key={m.accountId}><td><Avatar name={m.name} small/>{m.name}{m.name==='Andy'&&<span className="subtle"> (you)</span>}</td><td>{m.role==='owner'?<Badge>Owner</Badge>:<span className="muted">Member</span>}</td></tr>)}</tbody></table></div></Card>
          <Card title="Agents · 3" description="People’s connected coding agents." padded={false}><div className="table-wrap"><table className="table agents-table"><thead><tr><th>Agent</th><th>Owner</th><th>Read</th><th>Share</th><th>Status</th></tr></thead><tbody>{room.agents.map(a=><tr key={a.agentId}><td className="nowrap"><AgentAvatar small/>{a.name}</td><td>{a.ownerName}</td><td><input type="checkbox" checked disabled aria-label={`${a.name} can read`}/></td><td><input type="checkbox" checked disabled aria-label={`${a.name} can share`}/></td><td><StatusPill status="done" label="Connected"/></td></tr>)}</tbody></table></div></Card>
        </Page>}
        {tab==='agents'&&<Page wide><PageHeader title="Agents" description="Follow each run step by step: plan, evidence, patches and approvals." actions={<>{previewLabel}{analysisButton}</>}/>
          <div className="ag-split"><div className="ag-side"><Card title="Runs" padded={false}><div className="list"><div className="list-row"><AgentAvatar small/><div><strong>David’s Claude</strong><p className="subtle">Signup deadline</p></div><StatusPill status={state.phase==='review'?'waiting':state.phase==='shared'?'done':'idle'} label={state.phase==='review'?'Needs your review':state.phase==='shared'?'Shared':'Not started'}/></div></div></Card><Card title="Services" padded={false}><div className="list">{services.map(s=><div className="list-row" key={s.role}><div className="row-main"><strong>{s.name}</strong><p className="subtle">{s.owner}</p></div><StatusPill status={state.patches[s.role]==='approved'?'done':state.patches[s.role]==='ready'?'waiting':'idle'} label={state.patches[s.role]==='approved'?'Updated':state.patches[s.role]==='ready'?'Needs review':'Not started'}/></div>)}</div></Card></div>
            <section className="preview-run"><Card title="Signup deadline"><ol className="preview-plan"><li>Read the updated event brief</li><li>Notice the deadline moved from 5 PM to 4 PM</li><li>Identify the website, reminders and calendar</li><li>Prepare one clear update for review</li></ol><details><summary>Evidence</summary><p className="prose-text">event-brief.md: “Signup closes at 4 PM.” The previous deadline was 5 PM.</p></details></Card><PacketCard state={state} dispatch={dispatch} onReview={()=>select('inbox')}/></section>
          </div>
        </Page>}
        {tab==='inbox'&&<Page><PageHeader title="Inbox" description="Review updates and proposed changes." actions={previewLabel}/>
          {state.phase==='review'&&<PacketCard state={state} dispatch={dispatch} onReview={()=>{}}/>}
          {services.filter(s=>state.patches[s.role]==='ready').map(s=><Card key={s.role} title={`${s.owner} · ${s.name}`}><PatchReview threadId={`preview_${s.role}`} service={s.name} summary={s.summary} diff={s.diff} canControl onDecided={()=>{}} onDecision={async decision=>dispatch({type:'patch',role:s.role,decision})} download={null} scopeNote="Approval changes this browser preview only; no files are modified."/></Card>)}
          {!pending&&<EmptyState icon={<Inbox/>} title="You’re all caught up" description={Object.values(state.patches).filter(p=>p==='approved').length===3?'All three proposed changes are approved. The website, reminders and calendar now agree on 4 PM.':'Updates and patch approvals will appear here.'} action={<Button onClick={()=>select('activity')}>Back to Activity</Button>}/>}
        </Page>}
      </main>
    </div>
  </div>;
}

function PacketCard({state,dispatch,onReview}:{state:PreviewState;dispatch:Dispatch<PreviewAction>;onReview:()=>void}) {
  if (state.phase==='idle') return <EmptyState icon={<Bot/>} title="No runs yet" description="Review the new signup deadline and share it with the team." action={<Button variant="primary" onClick={()=>dispatch({type:'analyze'})}>Review deadline change</Button>}/>;
  if (state.phase==='rejected') return <div className="rv-card"><StatusPill status="failed" label="Update rejected"/><Button onClick={()=>dispatch({type:'analyze'})}>Analyze again</Button></div>;
  if (state.phase==='review') return <AnalystReview threadId="preview_analyst" args={packet} canControl services={3} onDecided={()=>{}} onDecision={async decision=>dispatch({type:decision==='approve'?'share':'reject'})}/>;
  const updated=Object.values(state.patches).filter(p=>p==='approved').length;
  return <div className="rv-card"><div className="rv-title"><strong>{packet.title}</strong><Badge>Version 1</Badge></div><ul className="rv-bullets"><li>Signup closes at 4 PM, not 5 PM.</li><li>Keep the website, reminders and calendar in sync.</li></ul>
    <details><summary>Sources</summary><p className="prose-text">event-brief.md · “Signup closes at 4 PM.”</p></details>
    <section className="rollout"><header><h3>Rollout</h3><span className="subtle">{updated} of 3 updated</span>{updated<3&&<Button className="rollout-all" size="sm" variant="secondary" onClick={()=>dispatch({type:'patches'})}>Update all services</Button>}</header><ul>{services.map(s=>{const status=state.patches[s.role];return <li key={s.role}><span className="rollout-name">{s.name}</span><StatusPill status={status==='approved'?'done':status==='ready'?'waiting':status==='rejected'?'failed':'idle'} label={status==='approved'?'Updated':status==='ready'?'Needs your review':status==='rejected'?'Rejected':'Not started'}/><span className="rollout-act">{status==='ready'&&<Button size="sm" variant="ghost" onClick={onReview}>Review</Button>}</span></li>;})}</ul></section>
  </div>;
}
