import type { Room } from '@civitas/contracts';

export const START = Date.parse('2026-11-15T15:00:00Z');
export const agents: Room['agents'] = [
  { agentId: 'preview_david', name: 'David’s Claude', provider: 'claude', ownerName: 'David', owned: false, canReply: true, lastSeenAt: null, receiverState: 'listening' },
  { agentId: 'preview_andy', name: 'Andy’s Codex', provider: 'codex', ownerName: 'Andy', owned: true, canReply: true, lastSeenAt: null, receiverState: 'listening' },
  { agentId: 'preview_ryan', name: 'Ryan’s Codex', provider: 'codex', ownerName: 'Ryan', owned: false, canReply: true, lastSeenAt: null, receiverState: 'listening' },
];
export const packet = {
  title: 'Maintenance API v2: preserve priority semantics',
  content: '## Summary\n- Replace priority with priority_code in API consumers.\n- P1 means urgent, confirmed by CHANGELOG.md.\n\n## Unresolved\n- P2 and P3 have no documented mapping; route them to manual review.\n\n## Deprecation\n- /work-orders sunsets on March 31, 2027.\n\n## Sources\n- openapi-v1.yaml\n- openapi-v2.yaml\n- CHANGELOG.md',
  tags: ['unresolved:P2', 'unresolved:P3'], change: { breaking: true },
};
export const services = [
  { role: 'sdk', name: 'SDK', owner: 'Andy’s Codex', summary: 'Update the response type to use priority_code without inventing meanings for P2 or P3.', diff: '--- a/sdk/maintenance.ts\n+++ b/sdk/maintenance.ts\n@@ -1 +1 @@\n-priority: "urgent" | "normal";\n+priority_code: "P1" | "P2" | "P3";' },
  { role: 'triage', name: 'Triage UI', owner: 'Ryan’s Codex', summary: 'Keep P1 urgent and show undocumented priority codes as needing review.', diff: '--- a/triage/priority.ts\n+++ b/triage/priority.ts\n@@ -1 +1 @@\n-return order.priority === "urgent" ? "Urgent" : "Low priority";\n+return order.priority_code === "P1" ? "Urgent maintenance" : "Needs review";' },
  { role: 'dispatch', name: 'Dispatch', owner: 'David’s Claude', summary: 'Route P1 urgently; keep other codes in manual review until their meanings are established.', diff: '--- a/dispatch/routing.ts\n+++ b/dispatch/routing.ts\n@@ -1 +1 @@\n-return order.priority === "urgent" ? "urgent" : "routine";\n+return order.priority_code === "P1" ? "urgent" : "manual-review";' },
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
    space: { spaceId: 'preview_maintenance', name: 'Maintenance team', role: 'owner', kind: 'group', visibility: 'private' },
    currentAccountId: 'preview_person_andy', canPublish: true, agents,
    members: ['Andy','David','Ryan'].map((name, i) => ({ accountId: `preview_person_${name.toLowerCase()}`, name, role: i ? 'member' : 'owner', canPublish: true })),
    posts: [
      { postId: 'preview_intro', spaceId: 'preview_maintenance', authorId: 'preview_person_andy', authorName: 'Andy', origin: 'human', createdAt: new Date(now-60000).toISOString(), content: 'Maintenance API v2 affects our SDK, triage UI and dispatch. Let’s coordinate the migration here.' },
      { postId: 'preview_intro_ryan', spaceId: 'preview_maintenance', authorId: 'preview_person_ryan', authorName: 'Ryan', origin: 'human', createdAt: new Date(now-30000).toISOString(), content: 'I’ll handle triage. We need to preserve what “urgent” means, not just rename a field.' },
    ],
  } };
}
export function presetReply(agentId: string, content: string, shared: boolean) {
  const name = agents.find(a => a.agentId === agentId)?.name || 'Agent';
  if (/^(hi|hey|hello|are you (online|connected|there))\b/i.test(content.trim())) return `Hi Andy — ${name} here. I’m ready to discuss the Maintenance API change with the team.`;
  if (!/api|priority|triage|sdk|contract|change|update|p[123]|source|dispatch/i.test(content)) return 'I can walk through the Maintenance API v2 scenario: the contract change, SDK types, triage labels and dispatch routing. What would you like to review?';
  const source = shared ? 'Using the shared Maintenance API v2 update (version 1): ' : 'From the prepared Maintenance API sources: ';
  const reply = agentId === 'preview_david'
    ? 'v2 replaces priority with priority_code. The changelog confirms P1 means urgent, but P2 and P3 have no documented mapping. The legacy /work-orders endpoint sunsets on March 31, 2027. Share one reviewed update so all three consumers preserve these facts.'
    : agentId === 'preview_andy'
      ? 'The SDK should replace the priority field with priority_code and accept P1, P2 and P3. Only P1 has a documented meaning: urgent. Keep P2 and P3 unresolved instead of mapping them to normal or low priority.'
      : 'Triage should read priority_code instead of priority. Display P1 as “Urgent maintenance.” P2 and P3 should display “Needs review” because their meanings are undocumented. Do not silently classify them as low priority.';
  return source + reply + '\n\nSources: openapi-v1.yaml, openapi-v2.yaml and CHANGELOG.md.';
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
