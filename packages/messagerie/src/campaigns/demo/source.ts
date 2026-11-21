import { ApiError } from '@eguardimmo/api';
import type { CampaignsSource } from '../source';
import { MAX_CAMPAIGN_ATTACHMENTS, MIN_SCHEDULE_MINUTES } from '../model';
import type { AudienceOption, Campaign, CampaignDraftInput, CampaignListQuery, CampaignPage, CampaignTab } from '../model';
import { attachmentIssue } from '../inputs';
import { DEMO_TEST_ADDRESS, demoAudiences, demoCampaigns } from './seed';

export interface DemoCampaignsOptions {
  agency?: boolean;
  now?: () => Date;
}

function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}

function run<T>(action: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(action());
  });
}

function periodStart(period: CampaignListQuery['period'], now: Date): Date | null {
  if (period === 'all') return null;
  const months = period === 'month' ? 0 : period === 'quarter' ? 2 : 11;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
}

export function createDemoCampaignsSource({ agency = true, now = () => new Date() }: DemoCampaignsOptions = {}): CampaignsSource {
  const audiences = demoAudiences(agency);
  const campaigns = demoCampaigns(now());
  let sequence = 0;

  const find = (id: string): Campaign => {
    const campaign = campaigns.find((item) => item.id === id);
    return campaign ?? fail(404, 'campaign_not_found', 'Diffusion introuvable');
  };
  const option = (kind: CampaignDraftInput['audience']): AudienceOption => {
    const chosen = audiences.find((item) => item.audience === kind);
    return chosen ?? fail(422, 'campaign_audience_unavailable', 'Destinataires indisponibles');
  };
  const editable = (campaign: Campaign) => {
    if (campaign.status !== 'draft') fail(409, 'campaign_not_editable', 'Diffusion non modifiable');
  };
  const apply = (campaign: Campaign, input: CampaignDraftInput) => {
    const chosen = option(input.audience);
    if (input.audience === 'mandants' && input.buildingIds.length > 0) fail(422, 'validation_failed', 'Invalide');
    if (input.buildingIds.some((id) => !chosen.buildings.some((building) => building.id === id))) fail(422, 'validation_failed', 'Invalide');
    Object.assign(campaign, { subject: input.subject, body: input.body, audience: input.audience, audienceLabel: chosen.label, buildingIds: input.buildingIds, copyToHistory: input.copyToHistory });
  };
  const reach = (campaign: Campaign): number => {
    const chosen = option(campaign.audience);
    if (campaign.buildingIds.length === 0) return chosen.count;
    return Math.min(chosen.count, chosen.buildings.filter((building) => campaign.buildingIds.includes(building.id)).reduce((sum, building) => sum + building.count, 0));
  };
  const touch = (campaign: Campaign) => {
    campaign.lockVersion += 1;
    campaign.updatedAt = now().toISOString();
    return structuredClone(campaign);
  };

  return {
    list: (query: CampaignListQuery) => run(() => {
      const since = periodStart(query.period, now());
      const needle = query.search.trim().toLowerCase();
      const scoped = campaigns.filter((item) => (query.building === 'all' || item.buildingIds.includes(query.building)) && (since === null || new Date(item.sentAt ?? item.scheduledAt ?? item.createdAt) >= since));
      const items = scoped
        .filter((item) => (query.tab === 'all' || item.status === query.tab) && item.subject.toLowerCase().includes(needle))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const count = (tab: CampaignTab) => campaigns.filter((item) => tab === 'all' || item.status === tab).length;
      const sent = campaigns.reduce((sum, item) => sum + item.metrics.sent, 0);
      const read = campaigns.reduce((sum, item) => sum + item.metrics.read, 0);
      const page: CampaignPage = {
        items: structuredClone(items),
        hasMore: false,
        nextCursor: null,
        counts: { all: count('all'), draft: count('draft'), scheduled: count('scheduled'), sending: count('sending'), sent: count('sent'), cancelled: count('cancelled') },
        stats: {
          thisMonth: campaigns.filter((item) => item.sendingStartedAt !== null && new Date(item.sendingStartedAt) >= (periodStart('month', now()) ?? 0)).length,
          scheduled: count('scheduled'),
          sentCount: sent,
          readCount: read,
          readRatePercent: sent === 0 ? null : Math.round((read * 100) / sent),
          failures: campaigns.reduce((sum, item) => sum + item.failedCount, 0),
        },
      };
      return page;
    }),
    audiences: () => run(() => structuredClone(audiences)),
    get: (id) => run(() => structuredClone(find(id))),
    create: (input) => run(() => {
      sequence += 1;
      const stamp = now().toISOString();
      const campaign: Campaign = {
        id: `demo-campaign-new-${String(sequence)}`,
        subject: '',
        body: '',
        audience: input.audience,
        audienceLabel: '',
        buildingIds: [],
        status: 'draft',
        copyToHistory: true,
        scheduledAt: null,
        sendingStartedAt: null,
        sentAt: null,
        cancelledAt: null,
        contentPurged: false,
        recipientCount: 0,
        failedCount: 0,
        metrics: { queued: 0, sending: 0, sent: 0, unknown: 0, bounced: 0, failed: 0, suppressed: 0, skippedNoEmail: 0, read: 0, unsubscribed: 0 },
        attachments: [],
        createdByUserId: 'demo-user',
        lockVersion: 1,
        createdAt: stamp,
        updatedAt: stamp,
      };
      apply(campaign, input);
      campaigns.push(campaign);
      return structuredClone(campaign);
    }),
    update: (id, input, lockVersion) => run(() => {
      const campaign = find(id);
      editable(campaign);
      if (campaign.lockVersion !== lockVersion) fail(409, 'campaign_version_conflict', 'Diffusion modifiée entre-temps');
      apply(campaign, input);
      return touch(campaign);
    }),
    send: (id) => run(() => {
      const campaign = find(id);
      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') fail(409, 'campaign_not_editable', 'Diffusion non modifiable');
      const total = reach(campaign);
      const skipped = Math.round(total / 6);
      Object.assign(campaign, {
        status: 'sent',
        sendingStartedAt: now().toISOString(),
        sentAt: now().toISOString(),
        recipientCount: total,
        metrics: { ...campaign.metrics, sent: total - skipped, skippedNoEmail: skipped },
      });
      return touch(campaign);
    }),
    schedule: (id, scheduledAt) => run(() => {
      const campaign = find(id);
      editable(campaign);
      if (new Date(scheduledAt).getTime() < now().getTime() + MIN_SCHEDULE_MINUTES * 60_000) fail(422, 'campaign_schedule_invalid', 'Date d’envoi invalide');
      Object.assign(campaign, { status: 'scheduled', scheduledAt });
      return touch(campaign);
    }),
    cancel: (id) => run(() => {
      const campaign = find(id);
      if (campaign.status !== 'scheduled') fail(409, 'campaign_not_editable', 'Diffusion non modifiable');
      Object.assign(campaign, { status: 'cancelled', cancelledAt: now().toISOString() });
      return touch(campaign);
    }),
    addAttachment: (id, file) => run(() => {
      const campaign = find(id);
      editable(campaign);
      if (campaign.attachments.length >= MAX_CAMPAIGN_ATTACHMENTS) fail(409, 'campaign_attachment_limit', 'Trop de pièces jointes');
      if (attachmentIssue(file, 0, MAX_CAMPAIGN_ATTACHMENTS) !== null) fail(422, 'validation_failed', 'Invalide');
      sequence += 1;
      const attachment = { id: `demo-attachment-${String(sequence)}`, name: file.name, sizeBytes: file.size };
      campaign.attachments.push(attachment);
      return attachment;
    }),
    removeAttachment: (id, attachmentId) => run(() => {
      const campaign = find(id);
      editable(campaign);
      campaign.attachments = campaign.attachments.filter((item) => item.id !== attachmentId);
    }),
    downloadAttachment: () => Promise.resolve(),
    sendTest: (input) => Promise.resolve({ sentTo: DEMO_TEST_ADDRESS, subject: input.subject, sentAt: now().toISOString() }),
  };
}
