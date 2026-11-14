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

// Final inbox dispositions are explicit, scoped, and idempotent.
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
  storage: z.enum(['memory', 'postgres']),
});
export type ActivitySnapshot = z.infer<typeof ActivitySnapshotSchema>;

export function topicMatches(pattern: string, topic: string): boolean {
  return pattern === topic;
}

// Local password accounts: no email delivery or email verification is implied.
export const AccountSchema = z.object({ accountId: id, email: z.email(), name: z.string() }).strict();
export const AccountSessionSchema = z.object({ token: z.string(), account: AccountSchema }).strict();
export const SpaceSchema = z.object({ spaceId: id, name: z.string(), role: z.enum(['owner','member']), kind: z.enum(['group','server']).default('group'), visibility: z.enum(['private','public']).default('private') }).strict();
export const AgentSchema = z.object({ agentId: id, name: z.string() }).strict();
export const AgentCredentialSchema = AgentSchema.extend({ token: z.string() });
export const GrantSchema = z.object({ spaceId: id, agentId: id, read: z.boolean(), publish: z.boolean() }).strict();
export const InviteSchema = z.object({ inviteId: id, token: z.string(), email: z.email(), spaceId: id, expiresAt: timestamp }).strict();
export const AccountOverviewSchema = z.object({ account: AccountSchema, spaces: z.array(SpaceSchema), agents: z.array(AgentSchema), grants: z.array(GrantSchema) }).strict();
export type Account = z.infer<typeof AccountSchema>;
export type AccountSession = z.infer<typeof AccountSessionSchema>;
export type Space = z.infer<typeof SpaceSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type AgentCredential = z.infer<typeof AgentCredentialSchema>;
export type Grant = z.infer<typeof GrantSchema>;
export type Invite = z.infer<typeof InviteSchema>;
export type AccountOverview = z.infer<typeof AccountOverviewSchema>;
export const RegisterAccountInputSchema = z.object({email:z.email().max(254),password:z.string().min(12).max(256),name:z.string().min(1).max(100).optional()}).strict();
export const LoginAccountInputSchema = z.object({email:z.email().max(254),password:z.string().min(1).max(256)}).strict();
export const NameInputSchema = z.object({name:z.string().trim().min(1).max(100)}).strict();
export const InviteInputSchema = z.object({email:z.email().max(254)}).strict();
export const AcceptInviteInputSchema = z.object({token:z.string().min(24).max(256)}).strict();
export const GrantInputSchema = z.object({agentId:id,read:z.boolean(),publish:z.boolean()}).strict();
export const CreateSpaceInputSchema = NameInputSchema.extend({kind:z.enum(['group','server']).default('group'),visibility:z.enum(['private','public']).default('private')}).refine(v=>v.kind==='server'||v.visibility==='private','Groups are always private');
export const RoomPostInputSchema = z.object({content:z.string().trim().min(1).max(8000),title:z.string().trim().min(1).max(200).optional(),topic:TopicSchema.optional(),source:SourceSchema.optional(),targetAgentId:id.optional(),idempotencyKey:id.optional()}).strict();
export const RoomPostSchema = z.object({postId:id,spaceId:id,authorId:id,authorName:z.string(),content:z.string(),createdAt:timestamp,origin:z.enum(['human','agent']).default('human'),targetAgentId:id.optional(),targetAgentName:z.string().optional(),replyTo:id.optional(),retrievedAt:timestamp.optional(),repliedAt:timestamp.optional(),title:z.string().optional(),topic:TopicSchema.optional(),source:SourceSchema.optional()});
export const RoomAgentSchema = z.object({agentId:id,name:z.string(),provider:z.string(),ownerName:z.string(),lastSeenAt:timestamp.nullable(),canReply:z.boolean(),owned:z.boolean()});
export const GroupMessagesSchema = z.object({items:z.array(RoomPostSchema)});
export const RoomSchema = z.object({space:SpaceSchema,currentAccountId:id,canPublish:z.boolean(),members:z.array(z.object({accountId:id,name:z.string(),role:z.enum(['owner','member']),canPublish:z.boolean()})),posts:z.array(RoomPostSchema),agents:z.array(RoomAgentSchema).default([])});
export const ServerDirectorySchema = z.array(z.object({spaceId:id,name:z.string(),joined:z.boolean()}));
export type Room = z.infer<typeof RoomSchema>;

export const ConnectGroupAgentInputSchema = z.object({provider:z.enum(['claude','codex']),name:z.string().trim().min(1).max(100)}).strict();
export const GroupMessageReplyInputSchema = z.object({content:z.string().trim().min(1).max(8000)}).strict();
export const AgentLinkSchema = z.object({code:z.string(),expiresAt:timestamp});
export const RedeemAgentLinkInputSchema = z.object({code:z.string().regex(/^[A-Za-z0-9_-]{43}$/),provider:z.enum(['claude','codex'])}).strict();
export const LinkedAgentSchema = AgentCredentialSchema.extend({spaceId:id,provider:z.enum(['claude','codex'])});
