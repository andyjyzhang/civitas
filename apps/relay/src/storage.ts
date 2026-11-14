import { randomUUID } from 'node:crypto';
import type { ContextEvent, Delivery, PublishContextInput, Subscription, GetUpdatesInput, UpdatesPage, AckRecord, AckUpdateInput } from '@civitas/contracts';

export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function makeEvent(spaceId: string, agentId: string, input: PublishContextInput, now: string): ContextEvent {
  const { idempotencyKey: _retry, contextId: _context, expectedVersion: _version, ...content } = input;
  return { ...content, schemaVersion: 1, eventId: `evt_${randomUUID()}`, contextId: input.contextId ?? `ctx_${randomUUID()}`,
    spaceId, version: input.expectedVersion ? input.expectedVersion + 1 : 1, previousVersion: input.expectedVersion ?? null, publisherAgentId: agentId, publishedAt: now };
}
export type Snapshot = {
  subscriptions: Subscription[];
  events: ContextEvent[];
  deliveries: (Delivery & { retrievedAt: string | null })[];
  agents: { agentId: string; lastActivityAt: string | null }[];
};
export interface RelayStorage {
  mode: 'memory' | 'postgres';
  analyticsEnabled: boolean;
  ready(): Promise<void>;
  close(): Promise<void>;
  touch(spaceId: string, agentId: string): Promise<void>;
  subscribe(spaceId: string, agentId: string, topic: string): Promise<Subscription>;
  publish(spaceId: string, agentId: string, input: PublishContextInput, allowedAgents: string[]): Promise<ContextEvent>;
  updates(spaceId: string, agentId: string, input?: GetUpdatesInput): Promise<UpdatesPage>;
  acknowledge(spaceId: string, agentId: string, deliveryId: string, status: AckUpdateInput["status"]): Promise<AckRecord>;
  snapshot(spaceId: string, allowedAgents: string[]): Promise<Snapshot>;
  analytics(spaceId: string, from: string, to: string): Promise<unknown>;
}

export class MemoryStorage implements RelayStorage {
  mode = 'memory' as const;
  analyticsEnabled = false;
  private subscriptions = new Map<string, Subscription>();
  private published = new Map<string, { body: string; event: ContextEvent }>();
  private inboxes = new Map<string, (Delivery & { agentId: string; retrievedAt: string | null })[]>();
  private seen = new Map<string, string>();
  async ready() {}
  async close() {}
  async touch(space: string, agent: string) { this.seen.set(JSON.stringify([space, agent]), new Date().toISOString()); }
  async subscribe(space: string, agent: string, topic: string) {
    const key = JSON.stringify([space, agent, topic]);
    let sub = this.subscriptions.get(key);
    if (!sub) {
      sub = { subscriptionId: `sub_${randomUUID()}`, spaceId: space, agentId: agent, topic, createdAt: new Date().toISOString() };
      this.subscriptions.set(key, sub);
    }
    return sub;
  }
  async publish(space: string, agent: string, input: PublishContextInput, allowed: string[]) {
    const key = JSON.stringify([space, agent, input.idempotencyKey]);
    const body = canonical(input);
    const existing = this.published.get(key);
    if (existing) {
      if (existing.body !== body) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Retry key already used for different content.');
      return existing.event;
    }
    validateAppend([...this.published.values()].map(value => value.event), space, agent, input);
    const event = makeEvent(space, agent, input, new Date().toISOString());
    this.published.set(key, { body, event });
    for (const sub of this.subscriptions.values()) {
      if (sub.spaceId !== space || sub.topic !== input.topic || !allowed.includes(sub.agentId)) continue;
      const inboxKey = JSON.stringify([space, sub.agentId]);
      const inbox = this.inboxes.get(inboxKey) || [];
      inbox.push({ deliveryId: `dlv_${randomUUID()}`, event, agentId: sub.agentId, deliveredAt: event.publishedAt, retrievedAt: null, acknowledgedAt: null, status: 'pending' });
      this.inboxes.set(inboxKey, inbox);
    }
    return event;
  }
  async updates(space: string, agent: string, input: GetUpdatesInput = {}) {
    const inbox = this.inboxes.get(JSON.stringify([space, agent])) || [];
    const page = paginate(inbox, space, agent, input);
    return { ...page, items: page.items.map(item => {
      item.retrievedAt ??= new Date().toISOString();
      const { agentId: _agent, retrievedAt: _retrieved, ...delivery } = item;
      return delivery;
    }) };
  }
  async acknowledge(space: string, agent: string, deliveryId: string, status: AckUpdateInput['status']): Promise<AckRecord> {
    const item = this.inboxes.get(JSON.stringify([space, agent]))?.find(item => item.deliveryId === deliveryId);
    if (!item) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found.');
    if (item.status !== 'pending' && item.status !== status) throw new HttpError(409, 'DISPOSITION_CONFLICT', 'Delivery already has another final disposition.');
    item.status = status;
    item.acknowledgedAt ??= new Date().toISOString();
    return { deliveryId, status, acknowledgedAt: item.acknowledgedAt };
  }
  async snapshot(space: string, allowed: string[]): Promise<Snapshot> {
    return {
      agents: allowed.map(agentId => ({ agentId, lastActivityAt: this.seen.get(JSON.stringify([space, agentId])) || null })),
      subscriptions: [...this.subscriptions.values()].filter(sub => sub.spaceId === space && allowed.includes(sub.agentId)),
      events: [...this.published.values()].map(value => value.event).filter(event => event.spaceId === space).reverse(),
      deliveries: [...this.inboxes.values()].flat().filter(item => item.event.spaceId === space && allowed.includes(item.agentId))
        .map(({ agentId: _agent, ...delivery }) => delivery),
    };
  }
  async analytics(): Promise<never> { throw new HttpError(503, 'ANALYTICS_DISABLED', 'Timescale analytics is not enabled.'); }
}

export function validateAppend(events: ContextEvent[], space: string, agent: string, input: PublishContextInput) {
  if (!input.contextId) return;
  const versions = events.filter(event => event.spaceId === space && event.contextId === input.contextId);
  const latest = versions.sort((a, b) => b.version - a.version)[0];
  if (!latest) throw new HttpError(404, 'NOT_FOUND', 'Context not found.');
  if (latest.publisherAgentId !== agent) throw new HttpError(403, 'FORBIDDEN', 'Only the original publisher can append this context.');
  if (latest.version !== input.expectedVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'Context changed; retrieve the latest version before appending.');
  if (latest.topic !== input.topic) throw new HttpError(409, 'TOPIC_CONFLICT', 'A context topic cannot change between versions.');
}

// Cursors scope an ordered, frozen delivery range to the authenticated inbox.
// They are data selectors, never credentials. Arbitrary/foreign boundaries fail closed.
export function paginate<T extends Delivery>(items: T[], space: string, agent: string, input: GetUpdatesInput): {items: T[]; nextCursor: string | null} {
  const ordered = [...items]; // Storage supplies append-only sequence order.
  let after = -1;
  let end = ordered.length - 1;
  if (input.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
      if (cursor.space !== space || cursor.agent !== agent || typeof cursor.after !== 'string' || typeof cursor.end !== 'string') throw new Error();
      after = ordered.findIndex(item => item.deliveryId === cursor.after);
      end = ordered.findIndex(item => item.deliveryId === cursor.end);
      if (after < 0 || end < after) throw new Error();
    } catch { throw new HttpError(400, 'INVALID_CURSOR', 'Cursor does not belong to this inbox or is invalid.'); }
  }
  const selected = ordered.slice(after + 1, Math.min(end + 1, after + 1 + (input.limit ?? 100)));
  const more = after + selected.length < end;
  const nextCursor = more && selected.length ? Buffer.from(JSON.stringify({space, agent, after: selected[selected.length-1].deliveryId, end: ordered[end].deliveryId})).toString('base64url') : null;
  return {items: selected, nextCursor};
}
