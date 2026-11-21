export type SupportRequestSpace = 'tenant' | 'owner' | 'organization' | 'marketplace';
export type SupportTicketStatus = 'open' | 'waiting' | 'resolved';
export type SupportCategory = 'messaging' | 'billing' | 'account' | 'documents' | 'other';

export const SUPPORT_CATEGORIES: readonly SupportCategory[] = ['messaging', 'billing', 'account', 'documents', 'other'];
export const SUPPORT_REOPEN_DAYS = 14;
export const SUPPORT_SUBJECT_MAX = 140;

export interface SupportHoursWindow {
  days: number[];
  from: string;
  to: string;
}

export interface SupportAvailability {
  online: boolean;
  hoursLabel: string;
  responseLabel: string;
  timezone: string;
  hours: SupportHoursWindow[];
}

export interface SupportAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SupportMessage {
  id: string;
  authorName: string;
  fromSupport: boolean;
  mine: boolean;
  body: string;
  sentAt: string;
  attachments: SupportAttachment[];
}

export interface SupportTicketSummary {
  id: string;
  reference: string;
  subject: string;
  organizationName: string | null;
  space: SupportRequestSpace;
  status: SupportTicketStatus;
  category: SupportCategory;
  handled: boolean;
  createdAt: string;
  updatedAt: string;
  requesterLastReadAt: string | null;
  supportLastReadAt: string | null;
  messageCount: number;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  firstResponseAt: string | null;
  messages: SupportMessage[];
}

export interface SupportMessagesPage {
  items: SupportMessage[];
  hasMore: boolean;
  status: SupportTicketStatus;
  requesterLastReadAt: string | null;
  supportLastReadAt: string | null;
}

export interface SupportPostInput {
  body: string;
  files: File[];
  clientId: string;
}

export interface SupportOpenInput extends SupportPostInput {
  category: SupportCategory;
  subject: string;
}

export interface SupportRoutes {
  board: string;
  newRequest: string;
  ticket: (id: string) => string;
}
