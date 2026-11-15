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
  title: 'Free trials: 30 days → 14 days for new customers',
  content: '## Summary\n- New customers get a 14-day free trial instead of 30 days.\n- Existing trials keep their original end dates. Do not shorten them.\n- Align signup, website copy and reminder emails with the same rule.\n\n## Source\n- trial-policy.md: "New accounts: 14 days. Existing trials retain their original end dates."',
  tags: [], change: { breaking: false },
};
export const services = [
  { role: 'signup', name: 'Signup flow', owner: 'Ryan’s Codex', summary: 'Create 14-day trials for new accounts while preserving any existing trial end date.', diff: '--- a/signup/trial.ts\n+++ b/signup/trial.ts\n@@ -1 +1 @@\n-const trialEndsAt = addDays(today, 30);\n+const trialEndsAt = existingTrial?.endsAt ?? addDays(today, 14);' },
  { role: 'website', name: 'Website', owner: 'Andy’s Codex', summary: 'Advertise a 14-day free trial to new customers.', diff: '--- a/website/signup.ts\n+++ b/website/signup.ts\n@@ -1 +1 @@\n-export const trialLabel = "Start your 30-day free trial";\n+export const trialLabel = "Start your 14-day free trial";' },
  { role: 'reminders', name: 'Trial reminders', owner: 'David’s Claude', summary: 'Use each customer’s saved trial end date, so existing trials are not shortened.', diff: '--- a/email/trial-reminder.ts\n+++ b/email/trial-reminder.ts\n@@ -1 +1 @@\n-const daysLeft = 30 - daysSinceSignup;\n+const daysLeft = daysUntil(trial.endsAt);' },
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
    space: { spaceId: 'preview_product', name: 'Product team', role: 'owner', kind: 'group', visibility: 'private' },
    currentAccountId: 'preview_person_andy', canPublish: true, agents,
    members: ['Andy','David','Ryan'].map((name, i) => ({ accountId: `preview_person_${name.toLowerCase()}`, name, role: i ? 'member' : 'owner', canPublish: true })),
    posts: [
      { postId: 'preview_intro', spaceId: 'preview_product', authorId: 'preview_person_andy', authorName: 'Andy', origin: 'human', createdAt: new Date(now-60000).toISOString(), content: 'We’re updating our free trial. Let’s keep signup, the website and reminder emails consistent.' },
      { postId: 'preview_intro_ryan', spaceId: 'preview_product', authorId: 'preview_person_ryan', authorName: 'Ryan', origin: 'human', createdAt: new Date(now-30000).toISOString(), content: 'Signup currently creates a 30-day trial. Let me know if the policy changes.' },
    ],
  } };
}
export function presetReply(agentId: string, content: string, shared: boolean) {
  const name = agents.find(a => a.agentId === agentId)?.name || 'Agent';
  if (/^(hi|hey|hello|are you (online|connected|there))\b/i.test(content.trim())) return `Hi Andy — ${name} here. I’m ready to discuss the free-trial change.`;
  if (!/trial|signup|sign.?up|test|policy|chang|new|update|website|reminder|customer/i.test(content)) return 'We’re coordinating a free-trial policy change. Ask “What changed about trials?”, “How should signup work?” or “What should we test?”';
  if (agentId === 'preview_david') return 'New customers now get a 14-day trial instead of 30 days. Existing trials keep their original end dates — don’t shorten them. Signup, website copy and reminders need the same rule.\n\nSource: trial-policy.md';
  if (!shared) return agentId === 'preview_andy'
    ? 'The website currently advertises a 30-day free trial. I haven’t received a newer policy yet.'
    : 'Signup currently creates a 30-day trial for new customers. I haven’t received a newer policy yet.';
  return agentId === 'preview_andy'
    ? 'Test two cases: a new customer gets 14 days, and an existing trial keeps its original end date. Also check that the website advertises 14 days and reminders use the saved end date.\n\nSource: shared trial policy · version 1'
    : 'New signups should get a 14-day trial. Keep existing customers’ saved trial end dates unchanged. The signup message should say “14-day free trial.”\n\nSource: shared trial policy · version 1';
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
