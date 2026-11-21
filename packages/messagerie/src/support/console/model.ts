import type { AccessKind, AccessScope, AccessStatus, EmergencyBasis } from '../access/model';
import type { SupportAttachment, SupportCategory, SupportRequestSpace, SupportTicketStatus } from '../model';

export type ConsolePriority = 'high' | 'normal' | 'low';
export type ConsoleAssigneeFilter = 'all' | 'none' | 'me' | (string & {});

export const CONSOLE_PRIORITIES: readonly ConsolePriority[] = ['high', 'normal', 'low'];
export const CONSOLE_STATUSES: readonly SupportTicketStatus[] = ['open', 'waiting', 'resolved'];
export const CONSOLE_SPACES: readonly SupportRequestSpace[] = ['organization', 'owner', 'tenant', 'marketplace'];
export const REASON_MIN = 10;
export const REASON_MAX = 500;
export const BODY_MAX = 5000;
export const SEARCH_MAX = 100;
export const PAGE_SIZE = 20;

export interface ConsolePerson {
  id: string;
  name: string;
}

export interface ConsoleTicketSummary {
  id: string;
  reference: string;
  subject: string;
  organizationId: string | null;
  organizationName: string | null;
  space: SupportRequestSpace;
  requester: ConsolePerson;
  assignee: ConsolePerson | null;
  priority: ConsolePriority;
  status: SupportTicketStatus;
  category: SupportCategory;
  createdAt: string;
  updatedAt: string;
  requesterLastReadAt: string | null;
  supportLastReadAt: string | null;
  messageCount: number;
  firstResponseOverdue: boolean;
}

export interface ConsoleMessage {
  id: string;
  authorId: string | null;
  authorName: string;
  fromSupport: boolean;
  internal: boolean;
  body: string;
  sentAt: string;
  attachments: SupportAttachment[];
}

export interface ConsoleGrant {
  id: string;
  ticketId: string;
  organizationId: string | null;
  kind: AccessKind;
  status: AccessStatus;
  scopes: AccessScope[];
  reason: string;
  emergencyBasis: EmergencyBasis | null;
  durationHours: number | null;
  operator: ConsolePerson;
  requestedAt: string | null;
  decidedAt: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  reviewed: boolean;
  reviewedAt: string | null;
  readCount: number;
}

export interface ConsoleTicketDetail extends ConsoleTicketSummary {
  firstResponseAt: string | null;
  hasMore: boolean;
  messages: ConsoleMessage[];
  grants: ConsoleGrant[];
}

export interface ConsoleStatusCounts {
  open: number;
  waiting: number;
  resolved: number;
  all: number;
}

export interface ConsoleTicketPage {
  items: ConsoleTicketSummary[];
  page: number;
  lastPage: number;
  perPage: number;
  total: number;
  counts: ConsoleStatusCounts;
}

export interface ConsoleStats {
  open: number;
  openHigh: number;
  waiting: number;
  resolved30d: number;
  firstResponseMinutes: number | null;
  firstResponseOverdue: number;
}

export interface ConsoleMessagesPage {
  items: ConsoleMessage[];
  hasMore: boolean;
  status: SupportTicketStatus;
  requesterLastReadAt: string | null;
  supportLastReadAt: string | null;
}

export interface ConsoleTicketQuery {
  status: 'all' | SupportTicketStatus;
  priority: 'all' | ConsolePriority;
  assignee: ConsoleAssigneeFilter;
  space: 'all' | SupportRequestSpace;
  organization: string | null;
  search: string;
  page: number;
  perPage: number;
}

export interface ConsoleTicketPatch {
  status?: SupportTicketStatus;
  priority?: ConsolePriority;
  assigneeId?: string | null;
}

export interface ConsolePostInput {
  body: string;
  files: File[];
  clientId: string;
  internal: boolean;
}

export interface RequestAccessInput {
  reason: string;
  scopes: AccessScope[];
  durationHours: number;
}

export interface EmergencyAccessInput {
  reason: string;
  basis: EmergencyBasis;
}

export interface OrganizationMember {
  firstName: string;
  lastName: string;
  role: string;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  country: string;
  currency: string;
}

export interface ConsoleSupportRoutes {
  board: string;
  ticket: (id: string) => string;
}

export const EMPTY_QUERY: ConsoleTicketQuery = {
  status: 'all',
  priority: 'all',
  assignee: 'all',
  space: 'all',
  organization: null,
  search: '',
  page: 1,
  perPage: PAGE_SIZE,
};

export function isUnreadForSupport(ticket: Pick<ConsoleTicketSummary, 'status' | 'updatedAt' | 'supportLastReadAt'>): boolean {
  if (ticket.status === 'resolved') return false;
  if (ticket.supportLastReadAt === null) return true;
  return new Date(ticket.updatedAt).getTime() > new Date(ticket.supportLastReadAt).getTime();
}

export function isLiveGrant(grant: ConsoleGrant, now: number): boolean {
  if (grant.status !== 'active') return false;
  return grant.expiresAt === null || new Date(grant.expiresAt).getTime() > now;
}

export function liveGrantsOf(ticket: Pick<ConsoleTicketDetail, 'grants'>, operatorId: string | undefined, now: number): ConsoleGrant[] {
  if (operatorId === undefined) return [];
  return ticket.grants.filter((grant) => grant.operator.id === operatorId && isLiveGrant(grant, now));
}

export function openGrantOf(ticket: Pick<ConsoleTicketDetail, 'grants'>, now: number): ConsoleGrant | undefined {
  return ticket.grants.find((grant) => grant.status === 'requested' || isLiveGrant(grant, now));
}

export function needsReview(grant: ConsoleGrant): boolean {
  return grant.kind === 'emergency' && !grant.reviewed;
}

export function canReview(grant: ConsoleGrant, operatorId: string | undefined): boolean {
  return needsReview(grant) && operatorId !== undefined && grant.operator.id !== operatorId;
}

export function coversScope(grants: readonly ConsoleGrant[], scope: AccessScope): boolean {
  return grants.some((grant) => grant.scopes.includes(scope));
}

export function lastReadByRequesterId(ticket: Pick<ConsoleTicketDetail, 'messages' | 'requesterLastReadAt'>): string | null {
  if (ticket.requesterLastReadAt === null) return null;
  const readAt = new Date(ticket.requesterLastReadAt).getTime();
  const last = ticket.messages.filter((message) => message.fromSupport && !message.internal).at(-1);
  return last !== undefined && new Date(last.sentAt).getTime() <= readAt ? last.id : null;
}

export function hasUnreadRequesterMessage(ticket: Pick<ConsoleTicketDetail, 'messages' | 'supportLastReadAt'>): boolean {
  const last = ticket.messages.filter((message) => !message.fromSupport).at(-1);
  if (last === undefined) return false;
  return ticket.supportLastReadAt === null || new Date(last.sentAt).getTime() > new Date(ticket.supportLastReadAt).getTime();
}
