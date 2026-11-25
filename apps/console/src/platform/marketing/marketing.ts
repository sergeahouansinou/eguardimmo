import type { ApiClient, Body } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, count, cursorParams, dataOf, dateTime, listOf, nullableDateTime, parse, read, segment, uuid, write } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';
import { campaignBody } from './campaignBody';
import type { CampaignInput } from './campaignBody';

export const CAMPAIGN_CHANNELS = ['email', 'push'] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];
export const CAMPAIGN_CATEGORIES = ['marketing', 'service'] as const;
export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];
export const CAMPAIGN_STATUSES = ['draft', 'sending', 'sent'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_IMAGE_PATH = /^\/api\/v1\/console\/marketing\/campaigns\/[\w-]+\/images\/[\w-]+$/;

const optionsSchema = z.object({
  channels: z.array(z.object({ channel: z.enum(CAMPAIGN_CHANNELS), enabled: z.boolean(), reason: z.string().nullable() })),
  categories: z.array(z.object({ code: z.enum(CAMPAIGN_CATEGORIES), label: z.string(), description: z.string() })),
  audiences: z.array(z.object({ code: z.string().min(1), label: z.string(), description: z.string(), accepts_inactivity_days: z.boolean() })),
  limits: z.object({
    subject: count,
    push_title: count,
    push_body: count,
    html_bytes: count,
    images: count,
    image_bytes: count,
    total_image_bytes: count,
    selected_recipients: count,
  }),
});

const summaryShape = {
  id: uuid,
  channel: z.enum(CAMPAIGN_CHANNELS),
  category: z.enum(CAMPAIGN_CATEGORIES),
  title: z.string(),
  audience: z.string().min(1),
  audience_label: z.string(),
  status: z.enum(CAMPAIGN_STATUSES),
  recipient_count: count,
  sent_count: count,
  failed_count: count,
  skipped_count: count,
  created_at: dateTime,
  sent_at: nullableDateTime,
};

const summarySchema = z.object(summaryShape);

const imageSchema = z.object({
  id: uuid,
  name: z.string(),
  mime: z.string(),
  size: count,
  url: z.string().regex(CAMPAIGN_IMAGE_PATH),
  inline: z.boolean(),
});

const statsSchema = z.object({
  queued: count,
  sending: count,
  sent: count,
  failed: count,
  bounced: count,
  suppressed: count,
  unknown: count,
  skipped_no_device: count,
  skipped_no_email: count,
  unsubscribed: count,
});

const detailSchema = z.object({
  ...summaryShape,
  subject: z.string().nullable(),
  html: z.string().nullable(),
  push_title: z.string().nullable(),
  push_body: z.string().nullable(),
  link: z.string().nullable(),
  inactivity_days: z.number().int().nullable(),
  recipient_emails: z.array(z.string()),
  images: z.array(imageSchema),
  lock_version: count,
  stats: statsSchema,
});

const savedSchema = z.object({ data: detailSchema, meta: z.object({ unknown_recipients: z.array(z.string()) }) });
const estimateSchema = z.object({ total: count, eligible: count, excluded_no_consent: count, excluded_unreachable: count });
const testSchema = z.object({ sent_to: z.string() });

export type MarketingOptions = z.infer<typeof optionsSchema>;
export type CampaignLimits = MarketingOptions['limits'];
export type CampaignSummary = z.infer<typeof summarySchema>;
export type CampaignDetail = z.infer<typeof detailSchema>;
export type CampaignImage = z.infer<typeof imageSchema>;
export type CampaignStats = z.infer<typeof statsSchema>;
export type CampaignEstimate = z.infer<typeof estimateSchema>;

export interface SavedCampaign {
  campaign: CampaignDetail;
  unknownRecipients: string[];
}

export interface CampaignQuery extends CursorQuery {
  status?: CampaignStatus;
}

export interface MarketingApi {
  options: () => Promise<MarketingOptions>;
  list: (query?: CampaignQuery) => Promise<CursorPage<CampaignSummary>>;
  get: (id: string) => Promise<CampaignDetail>;
  create: (input: CampaignInput) => Promise<SavedCampaign>;
  update: (id: string, input: CampaignInput, lockVersion: number) => Promise<SavedCampaign>;
  estimate: (id: string) => Promise<CampaignEstimate>;
  test: (id: string) => Promise<{ sentTo: string }>;
  send: (id: string, lockVersion: number) => Promise<CampaignDetail>;
}

export function marketingApi(client: ApiClient): MarketingApi {
  const campaign = (id: string) => `/marketing/campaigns/${segment(id)}`;
  const save = async (path: string, body: Body): Promise<SavedCampaign> => {
    const saved = parse(savedSchema, await client.post(`${CONSOLE_ROOT}${path}`, body));
    return { campaign: saved.data, unknownRecipients: saved.meta.unknown_recipients };
  };
  return {
    options: async () => (await read(client, '/marketing/options', dataOf(optionsSchema))).data,
    list: async (query = {}) => {
      const page = await read(client, '/marketing/campaigns', listOf(summarySchema, {}), { status: query.status, ...cursorParams(query) });
      return { rows: page.data, hasMore: page.meta.has_more, nextCursor: page.meta.next_cursor };
    },
    get: async (id) => (await read(client, campaign(id), dataOf(detailSchema))).data,
    create: (input) => save('/marketing/campaigns', campaignBody(input)),
    update: (id, input, lockVersion) => save(campaign(id), campaignBody(input, lockVersion)),
    estimate: async (id) => (await read(client, `${campaign(id)}/estimate`, dataOf(estimateSchema))).data,
    test: async (id) => ({ sentTo: (await write(client, `${campaign(id)}/test`, dataOf(testSchema))).data.sent_to }),
    send: async (id, lockVersion) => (await write(client, `${campaign(id)}/send`, dataOf(detailSchema), { lock_version: lockVersion })).data,
  };
}
