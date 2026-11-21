import type { z } from 'zod';
import type { AudienceOption, Campaign, CampaignAttachment, CampaignPage, CampaignTestResult } from '../model';
import type { AttachmentPayload, CampaignPayload, audiencesPayload, campaignListPayload, testPayload } from './payloads';

export function toAttachment(payload: AttachmentPayload): CampaignAttachment {
  return { id: payload.id, name: payload.name, sizeBytes: payload.size_bytes };
}

export function toCampaign(payload: CampaignPayload): Campaign {
  const { metrics } = payload;
  return {
    id: payload.id,
    subject: payload.subject,
    body: payload.body,
    audience: payload.audience,
    audienceLabel: payload.audience_label,
    buildingIds: payload.building_ids,
    status: payload.status,
    copyToHistory: payload.copy_to_history,
    scheduledAt: payload.scheduled_at,
    sendingStartedAt: payload.sending_started_at,
    sentAt: payload.sent_at,
    cancelledAt: payload.cancelled_at,
    contentPurged: payload.content_purged,
    recipientCount: payload.recipient_count,
    failedCount: payload.failed_count,
    metrics: {
      queued: metrics.queued,
      sending: metrics.sending,
      sent: metrics.sent,
      unknown: metrics.unknown,
      bounced: metrics.bounced,
      failed: metrics.failed,
      suppressed: metrics.suppressed,
      skippedNoEmail: metrics.skipped_no_email,
      read: metrics.read,
      unsubscribed: metrics.unsubscribed,
    },
    attachments: payload.attachments.map(toAttachment),
    createdByUserId: payload.created_by_user_id,
    lockVersion: payload.lock_version,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export function toCampaignPage(payload: z.infer<typeof campaignListPayload>): CampaignPage {
  const { stats } = payload;
  return {
    items: payload.data.map(toCampaign),
    hasMore: payload.meta.next_cursor !== null,
    nextCursor: payload.meta.next_cursor,
    counts: payload.counts,
    stats: {
      thisMonth: stats.this_month,
      scheduled: stats.scheduled,
      sentCount: stats.sent_count,
      readCount: stats.read_count,
      readRatePercent: stats.read_rate_percent,
      failures: stats.failures,
    },
  };
}

export function toAudiences(payload: z.infer<typeof audiencesPayload>): AudienceOption[] {
  return payload.data.map((option) => ({
    audience: option.audience,
    label: option.label,
    detail: option.detail,
    count: option.count,
    withoutEmail: option.without_email,
    buildings: option.buildings.map((item) => ({ id: item.id, name: item.name, count: item.count, withoutEmail: item.without_email })),
  }));
}

export function toTestResult(payload: z.infer<typeof testPayload>): CampaignTestResult {
  return { sentTo: payload.data.sent_to, subject: payload.data.subject, sentAt: payload.data.sent_at };
}
