import type { Room } from '@civitas/contracts';

export const START = Date.parse('2026-11-15T15:00:00Z');
export const agents: Room['agents'] = [
  { agentId: 'preview_david', name: 'David’s Claude', provider: 'claude', ownerName: 'David', owned: false, canReply: true, lastSeenAt: null, receiverState: 'listening' },
  { agentId: 'preview_andy', name: 'Andy’s Codex', provider: 'codex', ownerName: 'Andy', owned: true, canReply: true, lastSeenAt: null, receiverState: 'listening' },
  { agentId: 'preview_ryan', name: 'Ryan’s Codex', provider: 'codex', ownerName: 'Ryan', owned: false, canReply: true, lastSeenAt: null, receiverState: 'listening' },
];
// Short, visibly paced preset replies; no model or service is involved.
export const replyDelays: Record<string, number> = { preview_david: 2600, preview_andy: 1800, preview_ryan: 2200 };
export const packet = {
  title: 'Signup deadline: 5 PM → 4 PM',
  content: '## Summary\n- Event signup now closes at 4 PM instead of 5 PM.\n- Use the same time on the website, in reminders and on the calendar.\n\n## Source\n- event-brief.md: "Signup closes at 4 PM."',
  tags: [], change: { breaking: false },
};
export const services = [
  { role: 'website', name: 'Website', owner: 'Andy’s Codex', summary: 'Show the new 4 PM signup deadline on the website.', diff: '--- a/website/signup.ts\n+++ b/website/signup.ts\n@@ -1 +1 @@\n-export const signupDeadline = "5 PM";\n+export const signupDeadline = "4 PM";' },
  { role: 'reminders', name: 'Reminders', owner: 'Ryan’s Codex', summary: 'Use 4 PM in the signup reminder.', diff: '--- a/email/reminder.ts\n+++ b/email/reminder.ts\n@@ -1 +1 @@\n-export const reminder = "Signups close at 5 PM.";\n+export const reminder = "Signups close at 4 PM.";' },
  { role: 'calendar', name: 'Calendar', owner: 'David’s Claude', summary: 'Keep the calendar deadline in sync at 4 PM.', diff: '--- a/calendar/event.ts\n+++ b/calendar/event.ts\n@@ -1 +1 @@\n-export const signupCloses = "5 PM";\n+export const signupCloses = "4 PM";' },
];
export type PreviewState = { room: Room; phase: 'idle'|'review'|'shared'|'rejected'; patches: Record<string, 'ready'|'approved'|'rejected'>; now: number; packetIndex: number };
export type PreviewAction =
  | { type: 'send'; id: string; recipient: string; content: string; at: number }
  | { type: 'reply'; messageId: string; at: number }
  | { type: 'analyze'|'share'|'reject'|'patches' }
  | { type: 'patch'; role: string; decision: 'approve'|'reject' }
  | { type: 'reset'; at: number };
export function initialPreviewState(now = START): PreviewState {
  return { now, phase: 'idle', patches: {}, packetIndex: 2, room: {
    space: { spaceId: 'preview_launch', name: 'Launch team', role: 'owner', kind: 'group', visibility: 'private' },
    currentAccountId: 'preview_person_andy', canPublish: true, agents,
    members: ['Andy','David','Ryan'].map((name, i) => ({ accountId: `preview_person_${name.toLowerCase()}`, name, role: i ? 'member' : 'owner', canPublish: true })),
    posts: [
      { postId: 'preview_intro', spaceId: 'preview_launch', authorId: 'preview_person_andy', authorName: 'Andy', origin: 'human', createdAt: new Date(now-60000).toISOString(), content: 'Let’s keep the event signup time consistent across the website, reminders and calendar.' },
      { postId: 'preview_intro_ryan', spaceId: 'preview_launch', authorId: 'preview_person_ryan', authorName: 'Ryan', origin: 'human', createdAt: new Date(now-30000).toISOString(), content: 'The website and my reminders currently say signups close at 5 PM.' },
    ],
  } };
}
export function presetReply(agentId: string, content: string, shared: boolean) {
  const name = agents.find(a => a.agentId === agentId)?.name || 'Agent';
  if (/^(hi|hey|hello|are you (online|connected|there))\b/i.test(content.trim())) return `Hi Andy — ${name} here. Ask me “What time?” or “What changed?”`;
  if (!/time|when|signup|sign.?up|deadline|event|clos|chang|new|update|website|reminder|calendar/i.test(content)) return 'We’re coordinating an event signup deadline. Try “What time?” or “What changed?”';
  if (agentId === 'preview_david') return 'Signup now closes at 4 PM, not 5 PM. The event brief was updated. Share this change so the other agents know.\n\nSource: event-brief.md';
  if (!shared) return agentId === 'preview_andy'
    ? 'The website still says 5 PM. I haven’t received a newer signup deadline yet.'
    : 'My reminder still says 5 PM. I haven’t received a newer signup deadline yet.';
  return agentId === 'preview_andy'
    ? '4 PM. I received the shared update, so the website should say “Signups close at 4 PM.”\n\nSource: shared deadline update · version 1'
    : '4 PM. I received the shared update, so the reminder should say “Signups close at 4 PM.”\n\nSource: shared deadline update · version 1';
}

export function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === 'reset') return initialPreviewState(action.at);
  if (action.type === 'send') {
    const agent = agents.find(a => a.agentId === action.recipient);
    if (!action.content.trim() || state.room.posts.some(p=>p.postId===action.id)) return state;
    const post: Room['posts'][number] = { postId: action.id, spaceId: state.room.space.spaceId, authorId: state.room.currentAccountId, authorName: 'Andy', origin: 'human', createdAt: new Date(action.at).toISOString(), content: action.content.trim(), ...(agent ? { targetAgentId: agent.agentId, targetAgentName: agent.name, retrievedAt: new Date(action.at).toISOString() } : {}) };
    return { ...state, now: action.at, room: { ...state.room, posts: [...state.room.posts, post] } };
  }
  if (action.type === 'reply') {
    const post = state.room.posts.find(p => p.postId === action.messageId);
    const agent = agents.find(a=>a.agentId===post?.targetAgentId);
    if (!post || !agent || post.repliedAt) return state;
    const at = new Date(action.at).toISOString();
    return { ...state, now: action.at, room: { ...state.room, posts: [...state.room.posts.map(p=>p.postId===post.postId?{...p,repliedAt:at}:p), { postId: post.postId+'_reply', spaceId: post.spaceId, authorId: agent.agentId, authorName: agent.name, origin: 'agent', replyTo: post.postId, createdAt: at, content: presetReply(agent.agentId, post.content, state.phase==='shared') }] } };
  }
  if (action.type === 'analyze' && ['idle','rejected'].includes(state.phase)) return { ...state, phase: 'review', patches: {}, packetIndex: state.room.posts.length };
  if (action.type === 'share' && state.phase === 'review') return { ...state, phase: 'shared', packetIndex: state.room.posts.length };
  if (action.type === 'reject' && state.phase === 'review') return { ...state, phase: 'rejected' };
  if (action.type === 'patches' && state.phase === 'shared') return { ...state, patches: Object.fromEntries(services.map(s=>[s.role,state.patches[s.role]==='approved'?'approved':'ready'])) };
  if (action.type === 'patch' && state.phase === 'shared' && state.patches[action.role] === 'ready') return { ...state, patches: { ...state.patches, [action.role]: action.decision==='approve'?'approved':'rejected' } };
  return state;
}
export function visibleRoom(state: PreviewState): Room {
  return { ...state.room, agents: agents.map(agent=>{
    const pending=state.room.posts.find(p=>p.targetAgentId===agent.agentId&&!p.repliedAt);
    return { ...agent, receiverState: pending?'responding':'listening', respondingTo: pending?.postId };
  }) };
}
