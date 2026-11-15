import { json, sameOrigin } from '../../../../../../lib/relay';
import { AgentHttpError, agentFailure, lg, threadAccess } from '../../../../../../lib/agents';

export const runtime = 'nodejs';

// POST — space owner only. Stops the run's active LangGraph run(s) (runs.cancel, action
// 'interrupt': keeps the checkpoint, nothing further is published or applied) and marks the
// thread as stopped in its metadata.
export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const { thread, overview } = await threadAccess((await params).threadId, true);
    const client = lg();
    const active = (await client.runs.list(thread.thread_id, { limit: 10 })).filter(r => r.status === 'pending' || r.status === 'running');
    if (!active.length) throw new AgentHttpError(409, 'This run is not running.');
    const meta = thread.metadata as Record<string, unknown>;
    await client.threads.update(thread.thread_id, { metadata: { ...meta, stopped: true, stoppedBy: overview.account.accountId, stoppedAt: new Date().toISOString() } });
    await Promise.all(active.map(r => client.runs.cancel(thread.thread_id, r.run_id, true, 'interrupt')));
    return json({ ok: true });
  } catch (error) { return agentFailure(error); }
}
