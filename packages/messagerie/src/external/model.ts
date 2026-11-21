export type ExternalSpace = 'tenant' | 'owner';
export type ThreadStatus = 'open' | 'closed';
export type MessageSide = 'agency' | 'me' | 'other';

export const REDACTION_WINDOW_MS = 15 * 60_000;

export interface ThreadAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ThreadMessage {
  id: string;
  clientId: string | null;
  authorName: string;
  side: MessageSide;
  mine: boolean;
  body: string;
  sentAt: string;
  redacted: boolean;
  attachments: ThreadAttachment[];
}

export interface ThreadReference {
  kind: 'lease' | 'mandate';
  label: string;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  status: ThreadStatus;
  agencyId: string;
  agencyName: string | null;
  reference: ThreadReference | null;
  preview: string;
  lastMessageAt: string;
  lastAuthor: MessageSide;
  unread: boolean;
  archived: boolean;
  messageCount: number;
  hasAttachments: boolean;
  agencyLastReadAt: string | null;
  muted: boolean;
  canReply: boolean;
}

export interface ThreadDetail extends ThreadSummary {
  messages: ThreadMessage[];
  hasEarlier: boolean;
  earlierCursor: string | null;
}

export interface ThreadPage {
  items: ThreadSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface MessagesPage {
  items: ThreadMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  status: ThreadStatus | null;
  agencyLastReadAt: string | null;
  canReply: boolean | null;
}

export interface ComposeOption {
  id: string;
  agencyId: string;
  agencyName: string | null;
  label: string;
}

export interface ThreadListQuery {
  search: string;
  archived: boolean;
  unread: boolean;
  scopeId: string | null;
  perPage: number;
}

export interface PostInput {
  body: string;
  files: File[];
  clientId: string;
}

export interface OpenInput extends PostInput {
  optionId: string;
  subject: string;
}

export interface MessagesQuery {
  after?: string;
  cursor?: string;
}

export interface MarkInput {
  read?: boolean;
  archived?: boolean;
}
