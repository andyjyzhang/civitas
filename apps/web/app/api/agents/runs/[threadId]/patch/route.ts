import { AgentHttpError, agentFailure, agentsConfig, threadAccess } from '../../../../../../lib/agents';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { thread } = await threadAccess((await params).threadId, false);
    const role = agentsConfig().consumers.find(c => c.role === thread.metadata?.role)?.role;
    if (thread.metadata?.kind !== 'adapter' || !role) throw new AgentHttpError(404, 'This run has no consumer patch.');
    // Read the exact virtual artifact, not a caller-supplied path or the truncated
    // display summary. Downloading never executes or applies model output.
    const values = thread.values as { files?: Record<string, { content?: unknown }> } | undefined;
    const raw = values?.files?.[`/patches/${role}.diff`]?.content;
    const diff = typeof raw === 'string' ? raw : Array.isArray(raw) && raw.every(line => typeof line === 'string') ? raw.join('\n') : '';
    if (!diff.trim()) throw new AgentHttpError(404, 'No patch is available yet.');
    if (Buffer.byteLength(diff, 'utf8') > 1024 * 1024) throw new AgentHttpError(413, 'This patch is too large to download.');
    return new Response(diff, { headers: {
      'Content-Type': 'text/x-diff; charset=utf-8',
      'Content-Disposition': `attachment; filename="civitas-${role}-${thread.thread_id}.patch"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return agentFailure(error); }
}
