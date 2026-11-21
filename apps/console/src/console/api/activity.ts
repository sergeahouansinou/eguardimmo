import type { ApiClient, Query } from '@eguardimmo/api';
import { z } from 'zod';
import type { ActivityList, ActivityQuery } from '../schemas';
import type { ActivityApi } from '../source';
import { translated } from './problems';

const text = z.string().nullable();

const entrySchema = z.object({
  id: z.string().min(1),
  occurred_at: z.iso.datetime({ offset: true }),
  action: z.string().min(1),
  actor: z.object({ id: z.string().min(1), name: text, email: text }).nullable(),
  organization_id: text,
  subject: z.object({ type: z.string().min(1), id: text }).nullable(),
  changes: z.record(z.string(), z.object({ old: z.unknown(), new: z.unknown() })).nullable(),
  metadata: z.union([z.record(z.string(), z.unknown()), z.array(z.never())]).nullable(),
  request_id: text,
  route: text,
  ip: text,
  user_agent: text,
});
type ApiEntry = z.infer<typeof entrySchema>;

const listSchema = z.object({
  data: z.array(entrySchema),
  meta: z.object({ per_page: z.number().int().positive(), next_cursor: text, prev_cursor: text }),
});
const detailSchema = z.object({ data: entrySchema });

const UNEXPECTED = 'Réponse inattendue du serveur. Réessayez dans un instant.';
const DAY_MS = 86_400_000;

function show(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function isRedacted(entry: ApiEntry): boolean {
  return (
    entry.organization_id !== null &&
    entry.changes === null &&
    entry.metadata === null &&
    entry.ip === null &&
    entry.user_agent === null &&
    (entry.subject?.id ?? null) === null &&
    (entry.actor?.name ?? null) === null &&
    (entry.actor?.email ?? null) === null
  );
}

export function toActivityEntry(entry: ApiEntry) {
  return {
    id: entry.id,
    occurredAt: entry.occurred_at,
    action: entry.action,
    actor: entry.actor,
    organizationId: entry.organization_id,
    subject: entry.subject,
    changes: Object.entries(entry.changes ?? {}).map(([field, change]) => ({ field, before: show(change.old), after: show(change.new) })),
    metadata: Object.entries(entry.metadata === null || Array.isArray(entry.metadata) ? {} : entry.metadata).map(([key, value]) => ({ key, value: show(value) })),
    requestId: entry.request_id,
    route: entry.route,
    ip: entry.ip,
    userAgent: entry.user_agent,
    redacted: isRedacted(entry),
  };
}

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function activityParams(query: ActivityQuery): Query {
  const from = filled(query.from);
  const to = filled(query.to);
  return {
    actor: filled(query.actor),
    subject_type: filled(query.subjectType),
    subject_id: filled(query.subjectId),
    action: filled(query.action),
    organization: filled(query.organization),
    request_id: filled(query.requestId),
    from: from === undefined ? undefined : `${from}T00:00:00Z`,
    to: to === undefined ? undefined : `${nextDay(to)}T00:00:00Z`,
    per_page: query.perPage,
    cursor: filled(query.cursor),
  };
}

export function activityApi(client: ApiClient): ActivityApi {
  return {
    list: (query) =>
      translated(async (): Promise<ActivityList> => {
        const parsed = listSchema.safeParse(await client.get('/api/v1/console/activity', activityParams(query)));
        if (!parsed.success) throw new Error(UNEXPECTED);
        return {
          rows: parsed.data.data.map(toActivityEntry),
          perPage: parsed.data.meta.per_page,
          nextCursor: parsed.data.meta.next_cursor,
          prevCursor: parsed.data.meta.prev_cursor,
        };
      }),
    get: (id) =>
      translated(async () => {
        const parsed = detailSchema.safeParse(await client.get(`/api/v1/console/activity/${encodeURIComponent(id)}`));
        if (!parsed.success) throw new Error(UNEXPECTED);
        return toActivityEntry(parsed.data.data);
      }),
  };
}
