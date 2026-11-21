import type { OrganizationKind, StaffRole } from '../external/staff/model';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
export type CampaignAudienceKind = 'tenants' | 'mandants';
export type CampaignPeriod = 'all' | 'month' | 'quarter' | 'year';
export type CampaignTab = 'all' | CampaignStatus;

export const CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['draft', 'scheduled', 'sending', 'sent', 'cancelled'];
export const CAMPAIGN_TABS: readonly CampaignTab[] = ['all', ...CAMPAIGN_STATUSES];
export const CAMPAIGN_PERIODS: readonly CampaignPeriod[] = ['all', 'month', 'quarter', 'year'];

export const SUBJECT_MAX = 140;
export const BODY_MAX = 10_000;
export const MAX_CAMPAIGN_ATTACHMENTS = 3;
export const MAX_CAMPAIGN_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MIN_SCHEDULE_MINUTES = 15;
export const ALL_BUILDINGS = 'all';

export interface CampaignMetrics {
  queued: number;
  sending: number;
  sent: number;
  unknown: number;
  bounced: number;
  failed: number;
  suppressed: number;
  skippedNoEmail: number;
  read: number;
  unsubscribed: number;
}

export interface CampaignAttachment {
  id: string;
  name: string;
  sizeBytes: number;
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  audience: CampaignAudienceKind;
  audienceLabel: string;
  buildingIds: string[];
  status: CampaignStatus;
  copyToHistory: boolean;
  scheduledAt: string | null;
  sendingStartedAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  contentPurged: boolean;
  recipientCount: number;
  failedCount: number;
  metrics: CampaignMetrics;
  attachments: CampaignAttachment[];
  createdByUserId: string;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type CampaignCounts = Record<CampaignTab, number>;

export interface CampaignStats {
  thisMonth: number;
  scheduled: number;
  sentCount: number;
  readCount: number;
  readRatePercent: number | null;
  failures: number;
}

export interface CampaignPage {
  items: Campaign[];
  hasMore: boolean;
  nextCursor: string | null;
  counts: CampaignCounts;
  stats: CampaignStats;
}

export interface AudienceBuilding {
  id: string;
  name: string;
  count: number;
  withoutEmail: number;
}

export interface AudienceOption {
  audience: CampaignAudienceKind;
  label: string;
  detail: string;
  count: number;
  withoutEmail: number;
  buildings: AudienceBuilding[];
}

export interface CampaignListQuery {
  tab: CampaignTab;
  search: string;
  building: string;
  period: CampaignPeriod;
  perPage: number;
}

export interface CampaignDraftInput {
  subject: string;
  body: string;
  audience: CampaignAudienceKind;
  buildingIds: string[];
  copyToHistory: boolean;
}

export interface CampaignTestInput {
  subject: string;
  body: string;
  audience: CampaignAudienceKind;
}

export interface CampaignTestResult {
  sentTo: string;
  subject: string;
  sentAt: string;
}

export interface CampaignCapabilities {
  manage: boolean;
  audiences: readonly CampaignAudienceKind[];
}

export function campaignCapabilities(role: StaffRole, organizationKind: OrganizationKind): CampaignCapabilities {
  const manage = role === 'owner' || role === 'admin' || role === 'manager';
  if (!manage) return { manage, audiences: [] };
  return { manage, audiences: organizationKind === 'agency' ? ['tenants', 'mandants'] : ['tenants'] };
}

export function isEditable(campaign: Pick<Campaign, 'status'>): boolean {
  return campaign.status === 'draft';
}

export function isCancellable(campaign: Pick<Campaign, 'status'>): boolean {
  return campaign.status === 'scheduled';
}

export function pendingDeliveries(metrics: CampaignMetrics): number {
  return metrics.queued + metrics.sending;
}

export function failedDeliveries(metrics: CampaignMetrics): number {
  return metrics.unknown + metrics.bounced + metrics.failed;
}

export function readRate(metrics: CampaignMetrics): number | null {
  return metrics.sent === 0 ? null : Math.round((metrics.read * 100) / metrics.sent);
}
