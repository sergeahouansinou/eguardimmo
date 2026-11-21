import type { z } from 'zod';
import type { AccessGrant, AccessPage } from '../model';
import type { GrantPayload, grantListPayload } from './payloads';

export function toGrant(payload: GrantPayload): AccessGrant {
  return {
    id: payload.id,
    kind: payload.kind,
    status: payload.status,
    scopes: payload.scopes,
    reason: payload.reason,
    emergencyBasis: payload.emergency_basis,
    ticketReference: payload.ticket_reference,
    operator: payload.operator,
    durationHours: payload.duration_hours,
    requestedAt: payload.requested_at,
    decidedAt: payload.decided_at,
    grantedAt: payload.granted_at,
    expiresAt: payload.expires_at,
    revokedAt: payload.revoked_at,
    reviewed: payload.reviewed,
    readCount: payload.read_count,
  };
}

export function toGrantPage(payload: z.infer<typeof grantListPayload>): AccessPage {
  return { items: payload.data.map(toGrant), hasMore: payload.meta.has_more, nextCursor: payload.meta.next_cursor };
}
