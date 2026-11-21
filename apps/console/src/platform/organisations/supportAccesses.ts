import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, cursorParams, listOf, nullableDateTime, parse, segment } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';

export const SUPPORT_ACCESS_STATUSES = ['requested', 'active', 'refused', 'revoked', 'expired'] as const;
export type SupportAccessStatus = (typeof SUPPORT_ACCESS_STATUSES)[number];

const accessSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['consent', 'emergency']),
  status: z.enum(SUPPORT_ACCESS_STATUSES),
  scopes: z.array(z.string()),
  reason: z.string().nullable(),
  duration_hours: z.number().int().nonnegative().nullable(),
  operator: z.object({ id: z.string().min(1), name: z.string().nullable() }),
  requested_at: nullableDateTime,
  granted_at: nullableDateTime,
  expires_at: nullableDateTime,
  revoked_at: nullableDateTime,
  reviewed: z.boolean(),
  read_count: z.number().int().nonnegative(),
});

const listSchema = listOf(accessSchema, {});

export interface SupportAccess {
  id: string;
  kind: 'consent' | 'emergency';
  status: SupportAccessStatus;
  scopes: string[];
  reason: string | null;
  durationHours: number | null;
  operator: { id: string; name: string | null };
  requestedAt: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  reviewed: boolean;
  readCount: number;
}

export interface SupportAccessQuery extends CursorQuery {
  status?: SupportAccessStatus;
}

export interface SupportAccessesApi {
  list: (organisationId: string, query?: SupportAccessQuery) => Promise<CursorPage<SupportAccess>>;
}

export function supportAccessesApi(client: ApiClient): SupportAccessesApi {
  return {
    list: async (organisationId, query = {}) => {
      const { data, meta } = parse(
        listSchema,
        await client.get(`${CONSOLE_ROOT}/organizations/${segment(organisationId)}/support-accesses`, { ...cursorParams(query), status: query.status }),
      );
      return {
        rows: data.map((raw) => ({
          id: raw.id,
          kind: raw.kind,
          status: raw.status,
          scopes: raw.scopes,
          reason: raw.reason,
          durationHours: raw.duration_hours,
          operator: raw.operator,
          requestedAt: raw.requested_at,
          grantedAt: raw.granted_at,
          expiresAt: raw.expires_at,
          revokedAt: raw.revoked_at,
          reviewed: raw.reviewed,
          readCount: raw.read_count,
        })),
        hasMore: meta.has_more,
        nextCursor: meta.next_cursor,
      };
    },
  };
}
