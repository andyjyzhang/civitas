import { json, sameOrigin } from '../../../../lib/relay';
import { AgentHttpError, agentFailure, agentServerUp, SERVER_DOWN, spaceAccess, startAdapter, startAnalyst } from '../../../../lib/agents';

export const runtime = 'nodejs';

// POST /api/agents/runs — owner only. Starts an analyst run ({ kind: 'analyst', sourceId, goal })
// or an adapter run ({ kind: 'adapter', role }) on the local LangGraph agent server.
// Adapter runs are refused until the group has a published (approved) analyst run.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const { space, overview } = await spaceAccess(body.spaceId, true);
    if (!(await agentServerUp())) throw new AgentHttpError(503, SERVER_DOWN, { agentServerDown: true });
    const createdBy = overview.account.accountId;
    if (body.kind === 'analyst') return json(await startAnalyst(space.spaceId, createdBy, body.sourceId, body.goal));
    if (body.kind === 'adapter') return json(await startAdapter(space.spaceId, createdBy, body.role));
    throw new AgentHttpError(400, 'Unknown run kind.');
  } catch (error) { return agentFailure(error); }
}
