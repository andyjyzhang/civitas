import { json, sameOrigin } from '../../../../lib/relay';
import { AgentHttpError, STREAM_OPTIONS, agentFailure, agentServerUp, agentsConfig, lg, newRunId, requireRoleEnabled, SERVER_DOWN, spaceAccess } from '../../../../lib/agents';

export const runtime = 'nodejs';

// POST /api/agents/runs — owner only. Starts an analyst run ({ kind: 'analyst', sourceId, goal })
// or an adapter run ({ kind: 'adapter', role }) on the local LangGraph agent server.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const { space, overview } = await spaceAccess(body.spaceId, true);
    const config = agentsConfig();
    if (!(await agentServerUp())) throw new AgentHttpError(503, SERVER_DOWN, { agentServerDown: true });
    const client = lg();
    const createdBy = overview.account.accountId;
    if (body.kind === 'analyst') {
      const source = config.sources.find(s => s.id === body.sourceId);
      if (!source) throw new AgentHttpError(400, 'Choose a connected source.');
      const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
      if (!goal || goal.length > 4000) throw new AgentHttpError(400, 'Describe the change to analyze (up to 4000 characters).');
      await requireRoleEnabled(space.spaceId, 'analyst');
      const runId = newRunId('an');
      const thread = await client.threads.create({ metadata: { spaceId: space.spaceId, kind: 'analyst', sourceId: source.id, runId, createdBy } });
      await client.runs.create(thread.thread_id, 'analyst', {
        input: { messages: [{ role: 'user', content: goal }] },
        config: { configurable: { spaceId: space.spaceId, sourceId: source.id, runId } }, ...STREAM_OPTIONS,
      });
      return json({ threadId: thread.thread_id, runId });
    }
    if (body.kind === 'adapter') {
      const consumer = config.consumers.find(c => c.role === body.role);
      if (!consumer) throw new AgentHttpError(400, 'Choose a connected consumer.');
      await requireRoleEnabled(space.spaceId, consumer.role);
      const runId = newRunId(`ad_${consumer.role}`);
      const thread = await client.threads.create({ metadata: { spaceId: space.spaceId, kind: 'adapter', role: consumer.role, runId, createdBy } });
      await client.runs.create(thread.thread_id, 'adapter', {
        input: { messages: [{ role: 'user', content: 'Adapt this consumer to the latest update on its topic.' }] },
        config: { configurable: { spaceId: space.spaceId, role: consumer.role, runId } }, ...STREAM_OPTIONS,
      });
      return json({ threadId: thread.thread_id, runId });
    }
    throw new AgentHttpError(400, 'Unknown run kind.');
  } catch (error) { return agentFailure(error); }
}
