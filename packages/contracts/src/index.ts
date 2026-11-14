import { z } from 'zod';

export const TopicSchema = z.string().min(1).max(128)
  .regex(/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/, 'Use slash-separated lowercase topic segments');
export const SourceSchema = z.object({
  uri: z.string().min(1).max(2048),
  revision: z.string().min(1).max(256),
  excerpt: z.string().max(8000).optional(),
}).strict();
export const ChangeSchema = z.object({
  kind: z.string().min(1).max(100),
  breaking: z.boolean(),
  previous: z.json().optional(),
  current: z.json().optional(),
}).strict();

const contentFields = {
  topic: TopicSchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(60000),
  source: SourceSchema,
  change: ChangeSchema.optional(),
  tags: z.array(z.string().min(1).max(100)).max(20).optional(),
};
const id = z.string().min(1).max(256);
const timestamp = z.iso.datetime();

export const PublishContextInputSchema = z.object({
  ...contentFields,
  idempotencyKey: z.string().min(1).max(256),
  contextId: id.optional(),
  expectedVersion: z.number().int().positive().optional(),
}).strict().refine(
  value => (value.contextId === undefined) === (value.expectedVersion === undefined),
  'contextId and expectedVersion must be supplied together',
);
export type PublishContextInput = z.infer<typeof PublishContextInputSchema>;

export const ContextEventSchema = z.object({
  ...contentFields,
  schemaVersion: z.literal(1),
  eventId: id,
  contextId: id,
  spaceId: id,
  version: z.number().int().positive(),
  previousVersion: z.number().int().positive().nullable(),
  publisherAgentId: id,
  publishedAt: timestamp,
}).strict();
export type ContextEvent = z.infer<typeof ContextEventSchema>;

// The first sprint supports exact topics only; wildcard subscriptions are deferred.
export const SubscribeInputSchema = z.object({ topic: TopicSchema }).strict();
export type SubscribeInput = z.infer<typeof SubscribeInputSchema>;
export const SubscriptionSchema = z.object({
  subscriptionId: id, spaceId: id, agentId: id, topic: TopicSchema, createdAt: timestamp,
}).strict();
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const GetUpdatesInputSchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();
export type GetUpdatesInput = z.infer<typeof GetUpdatesInputSchema>;
export const DeliverySchema = z.object({
  deliveryId: id,
  event: ContextEventSchema,
  deliveredAt: timestamp,
  acknowledgedAt: timestamp.nullable(),
  status: z.enum(['pending', 'acknowledged', 'dismissed']),
}).strict();
export type Delivery = z.infer<typeof DeliverySchema>;
export const UpdatesPageSchema = z.object({
  items: z.array(DeliverySchema), nextCursor: z.string().nullable(),
}).strict();
export type UpdatesPage = z.infer<typeof UpdatesPageSchema>;

// Shapes reserved for the follow-up slice; the sprint relay does not expose ack.
export const AckUpdateInputSchema = z.object({
  status: z.enum(['acknowledged', 'dismissed']),
}).strict();
export type AckUpdateInput = z.infer<typeof AckUpdateInputSchema>;
export const AckRecordSchema = AckUpdateInputSchema.extend({
  deliveryId: id, acknowledgedAt: timestamp,
});
export type AckRecord = z.infer<typeof AckRecordSchema>;
export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ActivitySnapshotSchema = z.object({
  space: z.object({ spaceId: id, name: z.string() }),
  currentAgentId: id,
  agents: z.array(z.object({ agentId: id, lastActivityAt: timestamp.nullable() })),
  subscriptions: z.array(SubscriptionSchema),
  events: z.array(ContextEventSchema),
  deliveries: z.array(DeliverySchema.extend({ retrievedAt: timestamp.nullable() })),
  storage: z.literal('memory'),
});
export type ActivitySnapshot = z.infer<typeof ActivitySnapshotSchema>;

export function topicMatches(pattern: string, topic: string): boolean {
  return pattern === topic;
}
