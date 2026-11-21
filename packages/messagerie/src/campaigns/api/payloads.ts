import { z } from 'zod';

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime({ offset: true });

const attachment = z.object({ id, name: z.string().min(1), size_bytes: count });

const metrics = z.object({
  queued: count,
  sending: count,
  sent: count,
  unknown: count,
  bounced: count,
  failed: count,
  suppressed: count,
  skipped_no_email: count,
  read: count,
  unsubscribed: count,
});

export const campaignStatus = z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled']);

const campaign = z.object({
  id,
  subject: z.string(),
  body: z.string(),
  audience: z.enum(['tenants', 'mandants']),
  audience_label: z.string(),
  building_ids: z.array(id),
  status: campaignStatus,
  copy_to_history: z.boolean(),
  scheduled_at: isoDateTime.nullable(),
  sending_started_at: isoDateTime.nullable(),
  sent_at: isoDateTime.nullable(),
  cancelled_at: isoDateTime.nullable(),
  content_purged: z.boolean(),
  recipient_count: count,
  failed_count: count,
  metrics,
  attachments: z.array(attachment),
  created_by_user_id: id,
  lock_version: z.number().int().positive(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type CampaignPayload = z.infer<typeof campaign>;
export type AttachmentPayload = z.infer<typeof attachment>;

export const campaignPayload = z.object({ data: campaign });
export const attachmentPayload = z.object({ data: attachment });

export const campaignListPayload = z.object({
  data: z.array(campaign),
  meta: z.object({ per_page: count, next_cursor: z.string().nullable() }),
  counts: z.object({ all: count, draft: count, scheduled: count, sending: count, sent: count, cancelled: count }),
  stats: z.object({
    this_month: count,
    scheduled: count,
    sent_count: count,
    read_count: count,
    read_rate_percent: z.number().int().min(0).max(100).nullable(),
    failures: count,
  }),
});

const building = z.object({ id, name: z.string(), count, without_email: count });

export const audiencesPayload = z.object({
  data: z.array(
    z.object({
      audience: z.enum(['tenants', 'mandants']),
      label: z.string().min(1),
      detail: z.string(),
      count,
      without_email: count,
      buildings: z.array(building),
    }),
  ),
});

export const testPayload = z.object({ data: z.object({ sent_to: z.string().min(1), subject: z.string(), sent_at: isoDateTime }) });
