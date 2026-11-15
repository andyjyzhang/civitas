import { json, sameOrigin } from '../../../../lib/relay';
import { AgentHttpError, DEFAULT_GOAL, SERVER_DOWN, agentFailure, agentServerUp, agentsConfig, enableWorkspace, spaceAccess, startAnalyst, workspaceStatus } from '../../../../lib/agents';

export const runtime = 'nodejs';

// POST /api/agents/sample { spaceId } — owner only. "Run sample analysis": enables workspace agents
// if any role is missing (reusing saved credentials), then starts the analyst on the first
// connected source with the default goal.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const { space, overview, token } = await spaceAccess(body.spaceId, true);
    if (space.kind !== 'group') throw new AgentHttpError(400, 'Workspace agents run in project groups.');
    if (!(await agentServerUp())) throw new AgentHttpError(503, SERVER_DOWN, { agentServerDown: true });
    const source = agentsConfig().sources[0];
    if (!source) throw new AgentHttpError(500, 'No connected source in agents.config.json.');
    const status = await workspaceStatus(space.spaceId);
    let enabled = false;
    if (status.some(r => !r.present || r.tokenValid === false || (r.role !== 'analyst' && r.subscribed === false))) {
      await enableWorkspace(space.spaceId, token, status.some(r => r.present) ? 'reuse' : 'create');
      enabled = true;
    }
    const run = await startAnalyst(space.spaceId, overview.account.accountId, source.id, DEFAULT_GOAL);
    return json({ ...run, enabled });
  } catch (error) { return agentFailure(error); }
}
