import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, count, cursorParams, dataOf, dateTime, flag, listOf, nullableDateTime, parse, read, segment, write } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';

export const REQUEST_KINDS = ['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const REQUEST_CHANNELS = ['account', 'email', 'letter'] as const;
export type RequestChannel = (typeof REQUEST_CHANNELS)[number];
export const REQUEST_STATUSES = ['received', 'in_progress', 'completed', 'refused'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const EXTENSION_REASONS = ['complexity', 'volume'] as const;
export type ExtensionReason = (typeof EXTENSION_REASONS)[number];
export const REFUSAL_REASONS = ['manifestly_unfounded', 'excessive', 'identity_unverified', 'legal_obligation'] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];
export const RECORDABLE_CHANNELS = ['email', 'letter'] as const;
export type RecordableChannel = (typeof RECORDABLE_CHANNELS)[number];
export const IDENTITY_METHODS = ['known_channel', 'video_call', 'document_seen'] as const;
export type IdentityMethod = (typeof IDENTITY_METHODS)[number];

const requestSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(REQUEST_KINDS),
  channel: z.enum(REQUEST_CHANNELS),
  status: z.enum(REQUEST_STATUSES),
  received_at: dateTime,
  due_at: dateTime,
  extended_until: nullableDateTime,
  extension_reason: z.string().nullable(),
  deadline: dateTime,
  overdue: z.boolean(),
  identity_verified_by: z.string().nullable(),
  identity_verified_at: nullableDateTime,
  requester: z.object({ account_id: z.string().nullable(), name: z.string().nullable(), email: z.string().nullable() }),
  forwards: z.object({ total: count, handled: count }),
  refusal_reason: z.string().nullable(),
  completed_at: nullableDateTime,
  export: z.object({ generated: z.boolean(), expires_at: nullableDateTime, downloaded: z.boolean() }),
  events: z.array(z.object({ kind: z.string(), occurred_at: dateTime, actor_id: z.string().nullable() })).optional(),
});

const listSchema = listOf(requestSchema, { open_count: count, overdue_count: count });

export interface PrivacyRequest {
  id: string;
  kind: RequestKind;
  channel: RequestChannel;
  status: RequestStatus;
  receivedAt: string;
  dueAt: string;
  extendedUntil: string | null;
  extensionReason: string | null;
  deadline: string;
  overdue: boolean;
  identityVerifiedBy: string | null;
  identityVerifiedAt: string | null;
  requester: { accountId: string | null; name: string | null; email: string | null };
  forwards: { total: number; handled: number };
  refusalReason: string | null;
  completedAt: string | null;
  exportGenerated: boolean;
  exportExpiresAt: string | null;
  exportDownloaded: boolean;
  events: { kind: string; occurredAt: string; actorId: string | null }[] | null;
}

export interface PrivacyPage extends CursorPage<PrivacyRequest> {
  openCount: number;
  overdueCount: number;
}

export interface PrivacyQuery extends CursorQuery {
  status?: RequestStatus;
  kind?: RequestKind;
  overdue?: boolean;
}

export interface RecordRequestInput {
  kind: RequestKind;
  channel: RecordableChannel;
  requesterEmail: string;
  receivedOn?: string;
}

export function toPrivacyRequest(raw: z.infer<typeof requestSchema>): PrivacyRequest {
  return {
    id: raw.id,
    kind: raw.kind,
    channel: raw.channel,
    status: raw.status,
    receivedAt: raw.received_at,
    dueAt: raw.due_at,
    extendedUntil: raw.extended_until,
    extensionReason: raw.extension_reason,
    deadline: raw.deadline,
    overdue: raw.overdue,
    identityVerifiedBy: raw.identity_verified_by,
    identityVerifiedAt: raw.identity_verified_at,
    requester: { accountId: raw.requester.account_id, name: raw.requester.name, email: raw.requester.email },
    forwards: raw.forwards,
    refusalReason: raw.refusal_reason,
    completedAt: raw.completed_at,
    exportGenerated: raw.export.generated,
    exportExpiresAt: raw.export.expires_at,
    exportDownloaded: raw.export.downloaded,
    events: raw.events?.map((event) => ({ kind: event.kind, occurredAt: event.occurred_at, actorId: event.actor_id })) ?? null,
  };
}

export interface PrivacyApi {
  list: (query?: PrivacyQuery) => Promise<PrivacyPage>;
  get: (id: string) => Promise<PrivacyRequest>;
  record: (input: RecordRequestInput) => Promise<PrivacyRequest>;
  verify: (id: string, method: IdentityMethod) => Promise<PrivacyRequest>;
  extend: (id: string, reason: ExtensionReason) => Promise<PrivacyRequest>;
  forward: (id: string) => Promise<{ request: PrivacyRequest; forwarded: number }>;
  complete: (id: string) => Promise<PrivacyRequest>;
  refuse: (id: string, reason: RefusalReason) => Promise<PrivacyRequest>;
}

export function privacyApi(client: ApiClient): PrivacyApi {
  const single = dataOf(requestSchema);
  const act = async (id: string, verb: string, body?: Record<string, unknown>) => toPrivacyRequest((await write(client, `/privacy-requests/${segment(id)}/${verb}`, single, body)).data);
  return {
    list: async (query = {}) => {
      const { data, meta } = parse(
        listSchema,
        await client.get(`${CONSOLE_ROOT}/privacy-requests`, { ...cursorParams(query), status: query.status, kind: query.kind, overdue: flag(query.overdue) }),
      );
      return { rows: data.map(toPrivacyRequest), hasMore: meta.has_more, nextCursor: meta.next_cursor, openCount: meta.open_count, overdueCount: meta.overdue_count };
    },
    get: async (id) => toPrivacyRequest((await read(client, `/privacy-requests/${segment(id)}`, single)).data),
    record: async (input) =>
      toPrivacyRequest(
        (
          await write(client, '/privacy-requests', single, {
            kind: input.kind,
            channel: input.channel,
            requester_email: input.requesterEmail.trim(),
            ...(input.receivedOn === undefined || input.receivedOn === '' ? {} : { received_on: input.receivedOn }),
          })
        ).data,
      ),
    verify: (id, method) => act(id, 'verify', { verification_method: method }),
    extend: (id, reason) => act(id, 'extend', { reason }),
    forward: async (id) => {
      const { data, meta } = await write(client, `/privacy-requests/${segment(id)}/forward`, z.object({ data: requestSchema, meta: z.object({ forwarded: count }) }));
      return { request: toPrivacyRequest(data), forwarded: meta.forwarded };
    },
    complete: (id) => act(id, 'complete'),
    refuse: (id, reason) => act(id, 'refuse', { reason }),
  };
}
