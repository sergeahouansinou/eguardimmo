import { SUPPORT_LABEL } from '../copy';
import type {
  SupportAvailability,
  SupportMessage,
  SupportMessagesPage,
  SupportTicketDetail,
  SupportTicketSummary,
} from '../model';
import type { MessagePayload, TicketPayload, availabilityPayload, messagesPayload, ticketDetailPayload } from './payloads';
import type { z } from 'zod';

export function toMessage(payload: MessagePayload): SupportMessage {
  return {
    id: payload.id,
    authorName: payload.author.support || payload.author.name.trim() === '' ? SUPPORT_LABEL : payload.author.name,
    fromSupport: payload.author.support,
    mine: !payload.author.support,
    body: payload.body,
    sentAt: payload.sent_at,
    attachments: payload.attachments.map((piece) => ({ id: piece.id, name: piece.name, mimeType: piece.mime_type, sizeBytes: piece.size_bytes })),
  };
}

export function toSummary(payload: TicketPayload): SupportTicketSummary {
  return {
    id: payload.id,
    reference: payload.reference,
    subject: payload.subject,
    organizationName: payload.organization,
    space: payload.space,
    status: payload.status,
    category: payload.category,
    handled: payload.assignee !== null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    requesterLastReadAt: payload.requester_last_read_at,
    supportLastReadAt: payload.support_last_read_at,
    messageCount: payload.message_count,
  };
}

export function toDetail(payload: z.infer<typeof ticketDetailPayload>['data']): SupportTicketDetail {
  return { ...toSummary(payload), firstResponseAt: payload.first_response_at, messages: payload.messages.map(toMessage) };
}

export function toMessagesPage(payload: z.infer<typeof messagesPayload>): SupportMessagesPage {
  return {
    items: payload.data.map(toMessage),
    hasMore: payload.meta.has_more,
    status: payload.meta.status,
    requesterLastReadAt: payload.meta.requester_last_read_at,
    supportLastReadAt: payload.meta.support_last_read_at,
  };
}

export function toAvailability(payload: z.infer<typeof availabilityPayload>): SupportAvailability {
  const { data } = payload;
  return { online: data.online, hoursLabel: data.hours_label, responseLabel: data.response_label, timezone: data.timezone, hours: data.hours };
}

export function withMessages(detail: SupportTicketDetail, incoming: readonly SupportMessage[]): SupportTicketDetail {
  const known = new Set(detail.messages.map((message) => message.id));
  const added = incoming.filter((message) => !known.has(message.id));
  if (added.length === 0) return detail;
  return { ...detail, messages: [...detail.messages, ...added], messageCount: detail.messageCount + added.length, updatedAt: added.at(-1)?.sentAt ?? detail.updatedAt };
}

export function withMeta(detail: SupportTicketDetail, page: SupportMessagesPage): SupportTicketDetail {
  return { ...detail, status: page.status, requesterLastReadAt: page.requesterLastReadAt, supportLastReadAt: page.supportLastReadAt };
}
