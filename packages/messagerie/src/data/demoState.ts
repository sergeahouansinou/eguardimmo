import { MAX_ATTACHMENTS, validateAttachment } from './inputs';
import type { Attachment, ConversationDetail, ConversationSummary, Message, TicketDetail, TicketSummary } from './schemas';
import type { MessagerieSeed } from './seed';

export interface DemoContext {
  state: MessagerieSeed;
  now: () => Date;
  nextId: (prefix: string) => string;
}

export function createContext(seed: MessagerieSeed, now: () => Date): DemoContext {
  let counter = 0;
  return {
    state: structuredClone(seed),
    now,
    nextId: (prefix) => {
      counter += 1;
      return `${prefix}-${String(counter)}`;
    },
  };
}

export function run<T>(action: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(action());
  });
}

export const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function assertAttachments(files: File[]): void {
  if (files.length > MAX_ATTACHMENTS) throw new Error(`${String(MAX_ATTACHMENTS)} pièces jointes au maximum.`);
  for (const file of files) {
    const problem = validateAttachment(file);
    if (problem) throw new Error(problem);
  }
}

export function toAttachments(context: DemoContext, files: File[]): Attachment[] {
  return files.map((file) => ({
    id: context.nextId('att'),
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  }));
}

export function newMessage(
  context: DemoContext,
  authorId: string,
  body: string,
  files: File[],
  internal = false,
): Message {
  return {
    id: context.nextId('msg'),
    authorId,
    body: body.trim(),
    sentAt: context.now().toISOString(),
    attachments: toAttachments(context, files),
    internal,
  };
}

export function toSummary(detail: ConversationDetail): ConversationSummary {
  return {
    id: detail.id,
    subject: detail.subject,
    counterpart: detail.counterpart,
    ...(detail.tag ? { tag: detail.tag } : {}),
    preview: detail.preview,
    lastMessageAt: detail.lastMessageAt,
    lastAuthorId: detail.lastAuthorId,
    unread: detail.unread,
    archived: detail.archived,
    awaitingReply: detail.awaitingReply,
    messageCount: detail.messageCount,
    hasAttachments: detail.hasAttachments,
  };
}

export function toTicketSummary(detail: TicketDetail): TicketSummary {
  return {
    id: detail.id,
    reference: detail.reference,
    subject: detail.subject,
    organization: detail.organization,
    requester: detail.requester,
    assigneeId: detail.assigneeId,
    assigneeName: detail.assigneeName,
    priority: detail.priority,
    status: detail.status,
    category: detail.category,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    messageCount: detail.messageCount,
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(page, 1) - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
