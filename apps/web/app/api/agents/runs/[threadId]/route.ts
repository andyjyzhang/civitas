import { json, sameOrigin } from '../../../../../lib/relay';
import { AgentHttpError, STREAM_OPTIONS, agentFailure, lg, runTimings, subagentCache, summarize, threadAccess, workspaceActivity } from '../../../../../lib/agents';

export const runtime = 'nodejs';

// GET — any member of the run's space: current plan, files, timeline and pending approval, plus
// step timings (checkpoint history), subagent steps this web server saw live, and the approval's
// impact (subscribed receivers on the topic, read server-side with the workspace analyst credential).
export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { thread, space } = await threadAccess((await params).threadId, false);
    const run = summarize(thread);
    const timings = await runTimings(thread.thread_id).catch(() => ({}));
    let impact: { subscribers: number; topic: string } | null = null;
    const topic = run.approval?.civitas?.topic;
    if (run.kind === 'analyst' && topic) {
      const snapshot = await workspaceActivity(space.spaceId).catch(() => null);
      if (snapshot) impact = { topic, subscribers: new Set(snapshot.subscriptions.filter(s => s.topic === topic).map(s => s.agentId)).size };
    }
    return json({ run, canControl: space.role === 'owner', timings, subagents: subagentCache.get(thread.thread_id) ?? {}, impact });
  } catch (error) { return agentFailure(error); }
}

// POST { decision: 'approve' | 'reject', message? } — space owner only. Resumes the paused
// human-in-the-loop interrupt; the browser never resumes the agent server directly.
export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    if (body.decision !== 'approve' && body.decision !== 'reject') throw new AgentHttpError(400, 'Choose approve or reject.');
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    const { thread, overview } = await threadAccess((await params).threadId, true);
    const run = summarize(thread);
    if (thread.status !== 'interrupted' || !run.approval) throw new AgentHttpError(409, 'This run is not waiting for approval.');
    if (!run.approval.allowed.includes(body.decision)) throw new AgentHttpError(400, `This action does not allow ${body.decision}.`);
    if (body.decision === 'reject' && !message) throw new AgentHttpError(400, 'Give a reason for rejecting.');
    const decision = body.decision === 'approve' ? { type: 'approve' } : { type: 'reject', ...(message ? { message } : {}) };
    const value = run.approval.shape === 'batched' ? { decisions: run.approval.actions.map(() => decision) } : decision;
    const interrupts = Object.values(thread.interrupts || {}).flat();
    const resume = interrupts.length > 1 && run.approval.interruptId ? { [run.approval.interruptId]: value } : value;
    const meta = thread.metadata as Record<string, unknown>;
    const client = lg();
    const configurable = meta.kind === 'adapter' ? { spaceId: meta.spaceId, role: meta.role, runId: meta.runId } : { spaceId: meta.spaceId, sourceId: meta.sourceId, runId: meta.runId };
    await client.runs.create(thread.thread_id, String(meta.kind), { command: { resume }, config: { configurable }, multitaskStrategy: 'reject', ...STREAM_OPTIONS });
    // Record who decided (shown in history); spaceId/kind stay unchanged so access checks still hold.
    await client.threads.update(thread.thread_id, { metadata: { ...meta, decision: body.decision === 'approve' ? 'approved' : 'rejected', decidedBy: overview.account.accountId, decidedAt: new Date().toISOString() } });
    return json({ ok: true });
  } catch (error) { return agentFailure(error); }
}
