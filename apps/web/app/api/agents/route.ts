import { json, sameOrigin } from '../../../lib/relay';
import { SERVER_DOWN, agentFailure, agentServerUp, agentServerUrl, agentsConfig, brief, enableWorkspace, spaceAccess, spaceRuns, summarize, workspaceStatus } from '../../../lib/agents';

export const runtime = 'nodejs';

// GET /api/agents?space=<spaceId> — any member: config, workspace agent status, run history.
// (Chat reads `runs` for its activity strip: only add fields here.)
export async function GET(request: Request) {
  try {
    const spaceId = new URL(request.url).searchParams.get('space');
    const { space, overview } = await spaceAccess(spaceId, false);
    const config = agentsConfig();
    const [workspace, up] = await Promise.all([workspaceStatus(space.spaceId), agentServerUp()]);
    let runs: ReturnType<typeof brief>[] = []; let runsError = '';
    if (up) {
      try {
        runs = (await spaceRuns(space.spaceId)).map(t => brief(summarize(t)));
      } catch { runsError = 'Could not load run history from the agent server.'; }
    }
    return json({
      space, accountId: overview.account.accountId, sources: config.sources, consumers: config.consumers,
      workspace, agentServer: { url: agentServerUrl(), up, message: up ? '' : SERVER_DOWN }, runs, runsError,
    });
  } catch (error) { return agentFailure(error); }
}

// POST /api/agents { spaceId, mode: 'create' | 'reuse' | 'recreate' } — owner only: enable workspace agents.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'reuse' || body.mode === 'recreate' ? body.mode : 'create';
    const { space, token } = await spaceAccess(body.spaceId, true);
    if (space.kind !== 'group') return json({ error: 'Workspace agents run in project groups.' }, 400);
    const result = await enableWorkspace(space.spaceId, token, mode);
    return json({ ...result, workspace: await workspaceStatus(space.spaceId) });
  } catch (error) { return agentFailure(error); }
}
