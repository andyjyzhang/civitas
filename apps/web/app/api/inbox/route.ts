import { accountClientFor, accountCookieName, json, session } from '../../../lib/relay';
import { agentFailure, agentServerUp, lg, summarize, type InboxItem } from '../../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


// GET /api/inbox[?count=1] — signed-in account: agent runs waiting for a decision in the groups the
// account OWNS (only owners can approve). Reads interrupted threads from the agent server filtered
// by metadata.spaceId; `count=1` returns only { count } for the sidebar badge.
export async function GET(request: Request) {
  const current = await session(accountCookieName);
  if (!current) return json({ error: 'Sign in to see your inbox.' }, 401);
  const countOnly = new URL(request.url).searchParams.get('count') === '1';
  try {
    const overview = await accountClientFor(current.token).overview();
    const owned = overview.spaces.filter(s => s.kind === 'group' && s.role === 'owner');
    if (!owned.length) return json(countOnly ? { count: 0 } : { items: [], agentServerDown: false });
    if (!(await agentServerUp())) return json(countOnly ? { count: 0 } : { items: [], agentServerDown: true });
    const client = lg();
    const lists = await Promise.all(owned.map(async space => {
      const threads = await client.threads.search({ metadata: { spaceId: space.spaceId }, status: 'interrupted', limit: 25, sortBy: 'updated_at', sortOrder: 'desc' });
      return threads.filter(t => t.metadata?.kind === 'analyst' || t.metadata?.kind === 'adapter').flatMap(thread => {
        const run = summarize(thread);
        if (run.status !== 'waiting' || !run.approval) return [];
        const item: InboxItem = { threadId: run.threadId, spaceId: space.spaceId, spaceName: space.name, kind: run.kind, role: run.role, title: run.title, ask: run.ask || 'Review the agent’s request', waitingSince: run.updatedAt, createdAt: run.createdAt };
        return [item];
      });
    }));
    const items = lists.flat().sort((a, b) => b.waitingSince.localeCompare(a.waitingSince));
    return json(countOnly ? { count: items.length } : { items, agentServerDown: false });
  } catch (error) { return agentFailure(error); }
}
