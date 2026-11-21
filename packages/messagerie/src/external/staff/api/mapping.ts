import type { z } from 'zod';
import { DELETED_ACCOUNT_NAME } from '../../api/mapping';
import type {
  Assignee,
  StaffMessage,
  StaffMessagesPage,
  StaffThreadDetail,
  StaffThreadPage,
  StaffThreadSummary,
  StaffUnread,
} from '../model';
import type { StaffMessagePayload, StaffThreadPayload, assigneesPayload, staffDetailPayload, staffListPayload, staffMessagesPayload, staffUnreadPayload } from './payloads';

export function toStaffMessage(payload: StaffMessagePayload): StaffMessage {
  return {
    id: payload.id,
    clientId: payload.client_id,
    authorId: payload.author.id,
    authorName: payload.author.name.trim() === '' ? DELETED_ACCOUNT_NAME : payload.author.name,
    side: payload.author.side,
    mine: payload.mine,
    body: payload.body,
    sentAt: payload.sent_at,
    redacted: payload.redacted,
    redactionReason: payload.redaction_reason,
    attachments: payload.attachments.map((piece) => ({ id: piece.id, name: piece.name, mimeType: piece.mime_type, sizeBytes: piece.size_bytes })),
  };
}

export function toStaffSummary(payload: StaffThreadPayload): StaffThreadSummary {
  return {
    id: payload.id,
    kind: payload.kind,
    subject: payload.subject,
    status: payload.status,
    closedAt: payload.closed_at,
    party: payload.party,
    lease: payload.lease,
    mandate: payload.mandate,
    assignee: payload.assignee,
    preview: payload.preview,
    lastMessageAt: payload.last_message_at,
    lastAuthorSide: payload.last_author_side,
    lastAuthorName: payload.last_author_name,
    unread: payload.unread,
    archived: payload.archived,
    awaitingReply: payload.awaiting_reply,
    messageCount: payload.message_count,
    hasAttachments: payload.has_attachments,
    counterpartLastReadAt: payload.counterpart_last_read_at,
    mutedUntil: payload.muted_until,
    mutedReason: payload.muted_reason,
  };
}

export function toStaffDetail(payload: z.infer<typeof staffDetailPayload>['data']): StaffThreadDetail {
  return {
    ...toStaffSummary(payload),
    messages: payload.messages.map(toStaffMessage),
    hasEarlier: payload.messages_meta.has_more,
    earlierCursor: payload.messages_meta.next_cursor,
  };
}

export function toStaffThreadPage(payload: z.infer<typeof staffListPayload>): StaffThreadPage {
  return { items: payload.data.map(toStaffSummary), hasMore: payload.meta.has_more, nextCursor: payload.meta.next_cursor, counts: payload.meta.counts };
}

export function toStaffMessagesPage(payload: z.infer<typeof staffMessagesPayload>): StaffMessagesPage {
  return {
    items: payload.data.map(toStaffMessage),
    hasMore: payload.meta.has_more,
    nextCursor: payload.meta.next_cursor,
    status: payload.meta.status,
    counterpartLastReadAt: payload.meta.counterpart_last_read_at,
  };
}

export function toStaffUnread(payload: z.infer<typeof staffUnreadPayload>): StaffUnread {
  return payload.data;
}

export function toAssignees(payload: z.infer<typeof assigneesPayload>, self: { id: string; name: string } | null, selfRole: Assignee['role']): Assignee[] {
  const members = payload.data.filter((member) => member.role !== 'accountant');
  const everyone = self === null || members.some((member) => member.id === self.id) ? members : [...members, { ...self, role: selfRole }];
  return [...everyone].sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}

export function withStaffMessages(detail: StaffThreadDetail, incoming: readonly StaffMessage[]): StaffThreadDetail {
  const known = new Set(detail.messages.map((message) => message.id));
  const added = incoming.filter((message) => !known.has(message.id));
  if (added.length === 0) return detail;
  const last = added.at(-1);
  return {
    ...detail,
    messages: [...detail.messages, ...added],
    messageCount: detail.messageCount + added.length,
    unread: detail.unread || added.some((message) => !message.mine),
    ...(last ? { lastMessageAt: last.sentAt, lastAuthorSide: last.side, lastAuthorName: last.authorName, preview: last.body } : {}),
  };
}

export function withStaffEarlier(detail: StaffThreadDetail, page: StaffMessagesPage): StaffThreadDetail {
  const known = new Set(detail.messages.map((message) => message.id));
  return {
    ...detail,
    messages: [...page.items.filter((message) => !known.has(message.id)), ...detail.messages],
    hasEarlier: page.hasMore,
    earlierCursor: page.nextCursor,
  };
}

export function withStaffMeta(detail: StaffThreadDetail, page: StaffMessagesPage): StaffThreadDetail {
  return { ...detail, status: page.status, counterpartLastReadAt: page.counterpartLastReadAt };
}

export function replaceStaffMessage(detail: StaffThreadDetail, message: StaffMessage): StaffThreadDetail {
  return { ...detail, messages: detail.messages.map((existing) => (existing.id === message.id ? message : existing)) };
}

export function withoutMessages(detail: StaffThreadDetail, current: StaffThreadDetail): StaffThreadDetail {
  return { ...detail, messages: current.messages, hasEarlier: current.hasEarlier, earlierCursor: current.earlierCursor };
}
