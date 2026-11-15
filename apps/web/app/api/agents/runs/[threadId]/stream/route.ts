import { agentFailure, lg, subagentCache, subagentOf, summarize, threadAccess, timelineOf, type SubagentTrace } from '../../../../../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — Server-Sent Events for one run, for any member of its space. The web server joins the
// active LangGraph run (values + subgraph updates) and forwards condensed, plain-data snapshots:
//   event: snapshot  -> RunDetail (plan, files, timeline, approval)
//   event: subagent  -> { ns, subagent?, timeline } activity inside a delegated subagent (streamSubgraphs);
//                       also kept in the web server's memory so a reload still shows it
//   event: end       -> the run finished or paused; the client reconnects after it acts
export async function GET(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  let access;
  try { access = await threadAccess((await params).threadId, false); }
  catch (error) { return agentFailure(error); }
  const { thread } = access;
  const client = lg();
  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort());
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => { if (open) try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { open = false; } };
      const heartbeat = setInterval(() => { if (open) try { controller.enqueue(encoder.encode(': keep-alive\n\n')); } catch { open = false; } }, 15_000);
      try {
        send('snapshot', summarize(thread));
        const runs = await client.runs.list(thread.thread_id, { limit: 10 });
        const active = runs.find(r => r.status === 'pending' || r.status === 'running');
        if (active) {
          const subagents = new Map<string, unknown[]>();
          for await (const part of client.runs.joinStream(thread.thread_id, active.run_id, { signal: abort.signal, lastEventId: '-1', streamMode: ['values', 'updates'] })) {
            const event = String(part.event);
            if (event === 'values' && part.data && typeof part.data === 'object' && Array.isArray((part.data as { messages?: unknown }).messages)) {
              send('snapshot', summarize(thread, part.data as Record<string, unknown>, true));
            } else if (event.startsWith('updates|')) {
              const ns = event.slice('updates|'.length).split('|')[0];
              const list = subagents.get(ns) || []; let changed = false;
              for (const update of Object.values((part.data || {}) as Record<string, unknown>)) {
                const messages = update && typeof update === 'object' ? (update as { messages?: unknown }).messages : undefined;
                for (const m of Array.isArray(messages) ? messages : messages && typeof messages === 'object' ? [messages] : []) { list.push(m); changed = true; }
              }
              subagents.set(ns, list);
              if (changed) {
                const messages = list as Parameters<typeof timelineOf>[0];
                const trace: SubagentTrace = { subagent: subagentOf(messages), timeline: timelineOf(messages) };
                const cached = subagentCache.get(thread.thread_id) ?? {};
                cached[ns] = trace; subagentCache.set(thread.thread_id, cached);
                if (subagentCache.size > 200) subagentCache.delete(subagentCache.keys().next().value!);
                send('subagent', { ns, ...trace });
              }
            }
          }
        }
        send('snapshot', summarize(await client.threads.get(thread.thread_id)));
        send('end', {});
      } catch (error) {
        if (!abort.signal.aborted) send('failure', { error: error instanceof Error && /ECONNREFUSED|fetch failed/i.test(`${error.message} ${String(error.cause ?? '')}`) ? 'Agent server not running — start it with `npm run agents`.' : 'Lost the live stream from the agent server.' });
      } finally {
        clearInterval(heartbeat); open = false;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
