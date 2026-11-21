import type { ComposeOption, MessagesPage, ThreadDetail, ThreadMessage, ThreadPage, ThreadReference, ThreadSummary } from '../model';
import type { MessagePayload, ThreadPayload, ownerOptionsPayload, tenantOptionsPayload, threadDetailPayload, threadListPayload, messagesPayload } from './payloads';
import type { z } from 'zod';

export const DELETED_ACCOUNT_NAME = 'Compte supprimé';

export function toMessage(payload: MessagePayload): ThreadMessage {
  return {
    id: payload.id,
    clientId: payload.client_id,
    authorName: payload.author.name.trim() === '' ? DELETED_ACCOUNT_NAME : payload.author.name,
    side: payload.author.side,
    mine: payload.mine,
    body: payload.body,
    sentAt: payload.sent_at,
    redacted: payload.redacted,
    attachments: payload.attachments.map((piece) => ({ id: piece.id, name: piece.name, mimeType: piece.mime_type, sizeBytes: piece.size_bytes })),
  };
}

function referenceOf(payload: ThreadPayload): ThreadReference | null {
  if (payload.lease !== null) return { kind: 'lease', label: payload.lease.reference ?? 'Bail' };
  if (payload.mandate !== null) return { kind: 'mandate', label: payload.mandate.reference ?? 'Mandat' };
  return null;
}

export function toSummary(payload: ThreadPayload): ThreadSummary {
  return {
    id: payload.id,
    subject: payload.subject,
    status: payload.status,
    agencyId: payload.agency.id,
    agencyName: payload.agency.name,
    reference: referenceOf(payload),
    preview: payload.preview,
    lastMessageAt: payload.last_message_at,
    lastAuthor: payload.last_author,
    unread: payload.unread,
    archived: payload.archived,
    messageCount: payload.message_count,
    hasAttachments: payload.has_attachments,
    agencyLastReadAt: payload.agency_last_read_at,
    muted: payload.muted,
    canReply: payload.can_reply,
  };
}

export function toDetail(payload: z.infer<typeof threadDetailPayload>['data']): ThreadDetail {
  return {
    ...toSummary(payload),
    messages: payload.messages.map(toMessage),
    hasEarlier: payload.messages_meta.has_more,
    earlierCursor: payload.messages_meta.next_cursor,
  };
}

export function toThreadPage(payload: z.infer<typeof threadListPayload>): ThreadPage {
  return { items: payload.data.map(toSummary), hasMore: payload.meta.has_more, nextCursor: payload.meta.next_cursor };
}

export function toMessagesPage(payload: z.infer<typeof messagesPayload>): MessagesPage {
  return {
    items: payload.data.map(toMessage),
    hasMore: payload.meta.has_more,
    nextCursor: payload.meta.next_cursor,
    status: payload.meta.status,
    agencyLastReadAt: payload.meta.agency_last_read_at,
    canReply: payload.meta.can_reply,
  };
}

function optionLabel(agencyName: string | null, subject: string): string {
  return agencyName === null ? subject : `${agencyName} · ${subject}`;
}

export function toTenantOptions(payload: z.infer<typeof tenantOptionsPayload>): ComposeOption[] {
  return payload.data.map((entry) => ({
    id: entry.lease.id,
    agencyId: entry.agency.id,
    agencyName: entry.agency.name,
    label: optionLabel(entry.agency.name, entry.lease.reference === null ? 'Bail' : `Bail ${entry.lease.reference}`),
  }));
}

export function toOwnerOptions(payload: z.infer<typeof ownerOptionsPayload>): ComposeOption[] {
  return payload.data.map((entry) => ({
    id: entry.access_id,
    agencyId: entry.agency.id,
    agencyName: entry.agency.name,
    label: optionLabel(entry.agency.name, entry.mandant_name ?? 'Mandat'),
  }));
}

export function withMessages(detail: ThreadDetail, incoming: readonly ThreadMessage[]): ThreadDetail {
  const known = new Set(detail.messages.map((message) => message.id));
  const added = incoming.filter((message) => !known.has(message.id));
  if (added.length === 0) return detail;
  const last = added.at(-1);
  return {
    ...detail,
    messages: [...detail.messages, ...added],
    messageCount: detail.messageCount + added.length,
    unread: detail.unread || added.some((message) => !message.mine),
    ...(last ? { lastMessageAt: last.sentAt, lastAuthor: last.side, preview: last.body } : {}),
  };
}

export function withEarlier(detail: ThreadDetail, page: MessagesPage): ThreadDetail {
  const known = new Set(detail.messages.map((message) => message.id));
  return {
    ...detail,
    messages: [...page.items.filter((message) => !known.has(message.id)), ...detail.messages],
    hasEarlier: page.hasMore,
    earlierCursor: page.nextCursor,
  };
}

export function withMeta(detail: ThreadDetail, page: MessagesPage): ThreadDetail {
  return {
    ...detail,
    status: page.status ?? detail.status,
    agencyLastReadAt: page.agencyLastReadAt,
    canReply: page.canReply ?? detail.canReply,
  };
}

export function replaceMessage(detail: ThreadDetail, message: ThreadMessage): ThreadDetail {
  return { ...detail, messages: detail.messages.map((existing) => (existing.id === message.id ? message : existing)) };
}
