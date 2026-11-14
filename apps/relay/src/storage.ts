import { randomUUID } from 'node:crypto';
import type { ContextEvent, Delivery, PublishContextInput, Subscription } from '@civitas/contracts';

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
  return { ...content, schemaVersion: 1, eventId: `evt_${randomUUID()}`, contextId: `ctx_${randomUUID()}`,
    spaceId, version: 1, previousVersion: null, publisherAgentId: agentId, publishedAt: now };
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
  updates(spaceId: string, agentId: string): Promise<Delivery[]>;
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
  async updates(space: string, agent: string) {
    return (this.inboxes.get(JSON.stringify([space, agent])) || []).map(item => {
      item.retrievedAt ??= new Date().toISOString();
      const { agentId: _agent, retrievedAt: _retrieved, ...delivery } = item;
      return delivery;
    });
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
