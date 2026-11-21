import type { z } from 'zod';
import { SUPPORT_LABEL } from '../../copy';
import type { ConsoleGrant, ConsoleMessage, ConsoleMessagesPage, ConsoleStats, ConsoleTicketDetail, ConsoleTicketPage, ConsoleTicketSummary } from '../model';
import type { GrantPayload, MessagePayload, TicketPayload, messagesPayload, statsPayload, ticketDetailPayload, ticketListPayload } from './payloads';

export function toMessage(payload: MessagePayload): ConsoleMessage {
  return {
    id: payload.id,
    authorId: payload.author.id,
    authorName: payload.author.name.trim() === '' ? SUPPORT_LABEL : payload.author.name,
    fromSupport: payload.author.support,
    internal: payload.internal,
    body: payload.body,
    sentAt: payload.sent_at,
    attachments: payload.attachments.map((piece) => ({ id: piece.id, name: piece.name, mimeType: piece.mime_type, sizeBytes: piece.size_bytes })),
  };
}

export function toGrant(payload: GrantPayload): ConsoleGrant {
  return {
    id: payload.id,
    ticketId: payload.ticket_id,
    organizationId: payload.organization_id,
    kind: payload.kind,
    status: payload.status,
    scopes: payload.scopes,
    reason: payload.reason,
    emergencyBasis: payload.emergency_basis,
    durationHours: payload.duration_hours,
    operator: payload.operator,
    requestedAt: payload.requested_at,
    decidedAt: payload.decided_at,
    grantedAt: payload.granted_at,
    expiresAt: payload.expires_at,
    revokedAt: payload.revoked_at,
    reviewed: payload.reviewed,
    reviewedAt: payload.reviewed_at,
    readCount: payload.read_count,
  };
}

export function toSummary(payload: TicketPayload): ConsoleTicketSummary {
  return {
    id: payload.id,
    reference: payload.reference,
    subject: payload.subject,
    organizationId: payload.organization_id,
    organizationName: payload.organization,
    space: payload.space,
    requester: payload.requester,
    assignee: payload.assignee,
    priority: payload.priority,
    status: payload.status,
    category: payload.category,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    requesterLastReadAt: payload.requester_last_read_at,
    supportLastReadAt: payload.support_last_read_at,
    messageCount: payload.message_count,
    firstResponseOverdue: payload.first_response_overdue,
  };
}

export function toDetail(payload: z.infer<typeof ticketDetailPayload>['data']): ConsoleTicketDetail {
  return {
    ...toSummary(payload),
    firstResponseAt: payload.first_response_at,
    hasMore: payload.has_more,
    messages: payload.messages.map(toMessage),
    grants: payload.access_grants.map(toGrant),
  };
}

export function toTicketPage(payload: z.infer<typeof ticketListPayload>): ConsoleTicketPage {
  return {
    items: payload.data.map(toSummary),
    page: payload.meta.current_page,
    lastPage: payload.meta.last_page,
    perPage: payload.meta.per_page,
    total: payload.meta.total,
    counts: payload.counts,
  };
}

export function toMessagesPage(payload: z.infer<typeof messagesPayload>): ConsoleMessagesPage {
  return {
    items: payload.data.map(toMessage),
    hasMore: payload.meta.has_more,
    status: payload.meta.status,
    requesterLastReadAt: payload.meta.requester_last_read_at,
    supportLastReadAt: payload.meta.support_last_read_at,
  };
}

export function toStats(payload: z.infer<typeof statsPayload>): ConsoleStats {
  const { data } = payload;
  return {
    open: data.open,
    openHigh: data.open_high,
    waiting: data.waiting,
    resolved30d: data.resolved_30d,
    firstResponseMinutes: data.first_response_minutes,
    firstResponseOverdue: data.first_response_overdue,
  };
}

export function withMessages(detail: ConsoleTicketDetail, incoming: readonly ConsoleMessage[]): ConsoleTicketDetail {
  const known = new Set(detail.messages.map((message) => message.id));
  const added = incoming.filter((message) => !known.has(message.id));
  if (added.length === 0) return detail;
  return { ...detail, messages: [...detail.messages, ...added], messageCount: detail.messageCount + added.length };
}

export function withMeta(detail: ConsoleTicketDetail, page: ConsoleMessagesPage): ConsoleTicketDetail {
  return { ...detail, status: page.status, requesterLastReadAt: page.requesterLastReadAt, supportLastReadAt: page.supportLastReadAt };
}

export function withFresh(current: ConsoleTicketDetail | undefined, fresh: ConsoleTicketDetail): ConsoleTicketDetail {
  if (current === undefined) return fresh;
  const merged = withMessages({ ...fresh, messages: current.messages }, fresh.messages);
  return { ...merged, messageCount: Math.max(fresh.messageCount, merged.messages.length) };
}
