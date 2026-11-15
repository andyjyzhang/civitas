import { json } from '../../../lib/relay';
import { agentFailure, agentServerUp, agentsConfig, brief, shortLabel, spaceAccess, spaceRuns, summarize, workspaceActivity, workspaceStatus, type Receiver, type RunSummary, type Stage } from '../../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/context?space=<spaceId> — any member: the group's published context with a propagation
// row per subscribed receiver. Read server-side with the workspace analyst credential (the token
// never reaches the browser), merged with adapter run status from the agent server.
export async function GET(request: Request) {
  try {
    const { space } = await spaceAccess(new URL(request.url).searchParams.get('space'), false);
    const snapshot = await workspaceActivity(space.spaceId);
    if (!snapshot) return json({ enabled: false, events: [] });
    const config = agentsConfig();
    const roles = await workspaceStatus(space.spaceId, false);
    const roleOf = new Map(roles.filter(r => r.agentId).map(r => [r.agentId!, r]));
    let runs: RunSummary[] = []; let runsAvailable = false;
    if (await agentServerUp()) {
      try { runs = (await spaceRuns(space.spaceId, 100)).map(t => brief(summarize(t))); runsAvailable = true; } catch { /* propagation without run state */ }
    }
    const analystRunFor = new Map(runs.filter(r => r.kind === 'analyst' && r.eventId).map(r => [r.eventId!, r.threadId]));
    const newestByTopic = new Map<string, string>();
    for (const e of snapshot.events) if (!newestByTopic.has(e.topic) || newestByTopic.get(e.topic)! < e.publishedAt) newestByTopic.set(e.topic, e.publishedAt);

    const events = snapshot.events.map(event => {
      const deliveries = snapshot.deliveries.filter(d => d.event.eventId === event.eventId);
      const subs = snapshot.subscriptions.filter(s => s.topic === event.topic && s.createdAt <= event.publishedAt);
      const receivers: Receiver[] = subs.map(s => {
        const role = roleOf.get(s.agentId)?.role;
        const label = role ? shortLabel(config.consumers.find(c => c.role === role)?.label || roleOf.get(s.agentId)!.name) : s.agentId;
        return { key: s.subscriptionId, label, role, agentId: s.agentId, stage: 'pending' };
      });
      const used = new Set<string>();
      // 1. Exact matches: an adapter run that retrieved/acted on this delivery.
      for (const r of receivers) {
        if (!r.role) continue;
        const roleRuns = runs.filter(run => run.kind === 'adapter' && run.role === r.role);
        const delivery = deliveries.find(d => !used.has(d.deliveryId) && roleRuns.some(run => run.deliveryIds?.includes(d.deliveryId)));
        const run = delivery ? roleRuns.find(x => x.deliveryIds?.includes(delivery.deliveryId))
          : newestByTopic.get(event.topic) === event.publishedAt ? roleRuns.find(x => !x.deliveryIds?.length && x.createdAt >= event.publishedAt) : undefined;
        if (delivery) { used.add(delivery.deliveryId); Object.assign(r, { deliveredAt: delivery.deliveredAt, retrievedAt: delivery.retrievedAt, acknowledgedAt: delivery.acknowledgedAt }); }
        if (run) r.run = { threadId: run.threadId, status: run.status, stopped: run.stopped };
        if (delivery) r.stage = stageOf(delivery.status, delivery.retrievedAt, run?.status);
        else if (run) r.stage = stageOf(undefined, null, run.status);
      }
      // 2. The snapshot does not say which agent a delivery belongs to. When the remaining
      //    deliveries and receivers pair up one-to-one and all share the same state, assign it.
      const rest = deliveries.filter(d => !used.has(d.deliveryId));
      const open = receivers.filter(r => !r.deliveredAt);
      if (rest.length && rest.length === open.length && rest.every(d => d.status === rest[0].status && !!d.retrievedAt === !!rest[0].retrievedAt)) {
        open.forEach((r, i) => Object.assign(r, { deliveredAt: rest[i].deliveredAt, retrievedAt: rest[i].retrievedAt, acknowledgedAt: rest[i].acknowledgedAt, inferred: true, stage: stageOf(rest[i].status, rest[i].retrievedAt, r.run?.status) }));
      }
      const publisher = roleOf.get(event.publisherAgentId);
      return {
        eventId: event.eventId, contextId: event.contextId, version: event.version, title: event.title, topic: event.topic,
        content: event.content.slice(0, 6000), tags: event.tags ?? [], breaking: event.change?.breaking ?? null,
        source: { uri: event.source.uri, revision: event.source.revision }, publishedAt: event.publishedAt,
        publisher: { agentId: event.publisherAgentId, label: publisher?.name ?? event.publisherAgentId, isAgent: true },
        analystThreadId: analystRunFor.get(event.eventId),
        receivers, deliveredCount: deliveries.length, retrievedCount: deliveries.filter(d => d.retrievedAt).length,
        acknowledgedCount: deliveries.filter(d => d.status === 'acknowledged').length,
      };
    });
    return json({ enabled: true, storage: snapshot.storage, runsAvailable, events });
  } catch (error) { return agentFailure(error); }
}

function stageOf(status: 'pending' | 'acknowledged' | 'dismissed' | undefined, retrievedAt: string | null | undefined, run?: RunSummary['status']): Stage {
  if (run === 'applied') return 'applied';
  if (status === 'acknowledged') return 'acknowledged';
  if (status === 'dismissed') return 'dismissed';
  if (run === 'waiting') return 'patch_ready';
  if (run === 'running') return 'adapting';
  if (run === 'rejected') return 'rejected';
  if (run === 'failed') return 'failed';
  if (retrievedAt) return 'retrieved';
  return status ? 'delivered' : 'pending';
}
