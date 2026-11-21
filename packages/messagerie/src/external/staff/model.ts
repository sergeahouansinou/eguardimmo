import type { ThreadAttachment } from '../model';

export type StaffKind = 'tenant' | 'owner';
export type StaffSide = 'staff' | 'tenant' | 'owner';
export type StaffRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type StaffTab = 'all' | 'awaiting' | 'unread' | 'sent' | 'archived';
export type StaffThreadStatus = 'open' | 'closed';
export type OrganizationKind = 'agency' | 'individual';

export const STAFF_TABS: readonly StaffTab[] = ['all', 'awaiting', 'unread', 'sent', 'archived'];
export const MIN_REASON_LENGTH = 5;
export const MAX_MUTE_DAYS = 30;

export type StaffTabCounts = Record<StaffTab, number>;

export interface StaffPartyRef {
  id: string;
  name: string | null;
}

export interface StaffLink {
  id: string;
  reference: string | null;
}

export interface StaffThreadSummary {
  id: string;
  kind: StaffKind;
  subject: string;
  status: StaffThreadStatus;
  closedAt: string | null;
  party: StaffPartyRef;
  lease: StaffLink | null;
  mandate: StaffLink | null;
  assignee: StaffPartyRef | null;
  preview: string;
  lastMessageAt: string;
  lastAuthorSide: StaffSide;
  lastAuthorName: string | null;
  unread: boolean;
  archived: boolean;
  awaitingReply: boolean;
  messageCount: number;
  hasAttachments: boolean;
  counterpartLastReadAt: string | null;
  mutedUntil: string | null;
  mutedReason: string | null;
}

export interface StaffMessage {
  id: string;
  clientId: string | null;
  authorId: string;
  authorName: string;
  side: StaffSide;
  mine: boolean;
  body: string;
  sentAt: string;
  redacted: boolean;
  redactionReason: string | null;
  attachments: ThreadAttachment[];
}

export interface StaffThreadDetail extends StaffThreadSummary {
  messages: StaffMessage[];
  hasEarlier: boolean;
  earlierCursor: string | null;
}

export interface StaffThreadPage {
  items: StaffThreadSummary[];
  hasMore: boolean;
  nextCursor: string | null;
  counts: StaffTabCounts;
}

export interface StaffMessagesPage {
  items: StaffMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  status: StaffThreadStatus;
  counterpartLastReadAt: string | null;
}

export interface StaffUnread {
  internal: number;
  tenant: number;
  owner: number;
}

export interface Assignee {
  id: string;
  name: string;
  role: StaffRole;
}

export interface StaffListQuery {
  kind: StaffKind;
  tab: StaffTab;
  search: string;
  perPage: number;
}

export interface StaffPostInput {
  body: string;
  files: File[];
  clientId: string;
}

export interface StaffOpenInput extends StaffPostInput {
  kind: StaffKind;
  partyId: string;
  leaseId: string | null;
  mandateId: string | null;
  subject: string;
}

export interface StaffUpdateInput {
  status?: StaffThreadStatus;
  assigneeId?: string | null;
}

export interface StaffMarkInput {
  read?: boolean;
  archived?: boolean;
}

export interface RestrictInput {
  days: number;
  reason: string;
}

export interface StaffMessagesQuery {
  after?: string;
  cursor?: string;
}

export interface StaffCapabilities {
  readExternal: boolean;
  kinds: readonly StaffKind[];
  administer: boolean;
}

export function staffCapabilities(role: StaffRole, organizationKind: OrganizationKind): StaffCapabilities {
  const readExternal = role !== 'accountant';
  return {
    readExternal,
    kinds: !readExternal ? [] : organizationKind === 'agency' ? ['tenant', 'owner'] : ['tenant'],
    administer: role === 'owner' || role === 'admin',
  };
}
