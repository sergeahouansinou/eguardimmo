import type {
  Attachment,
  ConversationDetail,
  Message,
  Participant,
  ParticipantRole,
  TicketDetail,
} from '../schemas';

export function person(id: string, name: string, role: ParticipantRole, detail?: string): Participant {
  const initials = name
    .split(/[\s-]+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return { id, name, initials: initials || name.charAt(0).toUpperCase(), role, ...(detail ? { detail } : {}) };
}

export function file(id: string, name: string, sizeBytes: number, mimeType: string): Attachment {
  return { id, name, sizeBytes, mimeType };
}

export function msg(
  id: string,
  authorId: string,
  sentAt: string,
  body: string,
  options: { attachments?: Attachment[]; internal?: boolean } = {},
): Message {
  return { id, authorId, body, sentAt, attachments: options.attachments ?? [], internal: options.internal ?? false };
}

interface ConversationInput {
  id: string;
  subject: string;
  counterpart: Participant;
  me: Participant;
  messages: Message[];
  tag?: string;
  unread?: boolean;
  awaitingReply?: boolean;
  context?: ConversationDetail['context'];
  links?: ConversationDetail['links'];
}

export function conversation(input: ConversationInput): ConversationDetail {
  const last = input.messages.at(-1);
  if (!last) throw new Error(`Conversation ${input.id} sans message.`);
  return {
    id: input.id,
    subject: input.subject,
    counterpart: input.counterpart,
    ...(input.tag ? { tag: input.tag } : {}),
    preview: last.body,
    lastMessageAt: last.sentAt,
    lastAuthorId: last.authorId,
    unread: input.unread ?? false,
    archived: false,
    awaitingReply: input.awaitingReply ?? false,
    messageCount: input.messages.length,
    hasAttachments: input.messages.some((message) => message.attachments.length > 0),
    viewerId: input.me.id,
    participants: [input.me, input.counterpart],
    messages: input.messages,
    context: input.context ?? [],
    links: input.links ?? [],
  };
}

interface TicketInput {
  id: string;
  reference: string;
  subject: string;
  organization: string;
  requester: Participant;
  assignee?: { id: string; name: string };
  priority: TicketDetail['priority'];
  status: TicketDetail['status'];
  category: TicketDetail['category'];
  createdAt: string;
  participants: Participant[];
  messages: Message[];
  firstResponseLabel?: string;
  linked?: TicketDetail['linked'];
}

export function ticket(input: TicketInput, viewerId: string): TicketDetail {
  const last = input.messages.at(-1);
  if (!last) throw new Error(`Ticket ${input.id} sans message.`);
  return {
    id: input.id,
    reference: input.reference,
    subject: input.subject,
    organization: input.organization,
    requester: input.requester,
    assigneeId: input.assignee?.id ?? null,
    assigneeName: input.assignee?.name ?? null,
    priority: input.priority,
    status: input.status,
    category: input.category,
    createdAt: input.createdAt,
    updatedAt: last.sentAt,
    messageCount: input.messages.length,
    viewerId,
    participants: input.participants,
    messages: input.messages,
    firstResponseLabel: input.firstResponseLabel ?? null,
    linked: input.linked ?? [],
    access: null,
  };
}
