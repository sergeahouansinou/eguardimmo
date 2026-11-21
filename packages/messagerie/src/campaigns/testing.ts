export const ORG_ID = '0193a5e1-0000-7000-8000-000000000001';
export const CAMPAIGN_ID = '0193a5e1-0000-7000-8000-0000000002a1';
export const SECOND_CAMPAIGN_ID = '0193a5e1-0000-7000-8000-0000000002a2';
export const USER_ID = '0193a5e1-0000-7000-8000-0000000002b1';
export const BUILDING_ID = '0193a5e1-0000-7000-8000-0000000002c1';
export const SECOND_BUILDING_ID = '0193a5e1-0000-7000-8000-0000000002c2';
export const ATTACHMENT_ID = '0193a5e1-0000-7000-8000-0000000002d1';

export interface MetricsFixture {
  queued: number;
  sending: number;
  sent: number;
  unknown: number;
  bounced: number;
  failed: number;
  suppressed: number;
  skipped_no_email: number;
  read: number;
  unsubscribed: number;
}

export interface CampaignFixture {
  id: string;
  subject: string;
  body: string;
  audience: 'tenants' | 'mandants';
  audience_label: string;
  building_ids: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  copy_to_history: boolean;
  scheduled_at: string | null;
  sending_started_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  content_purged: boolean;
  recipient_count: number;
  failed_count: number;
  metrics: MetricsFixture;
  attachments: { id: string; name: string; size_bytes: number }[];
  created_by_user_id: string;
  lock_version: number;
  created_at: string;
  updated_at: string;
}

export const EMPTY_METRICS: MetricsFixture = {
  queued: 0,
  sending: 0,
  sent: 0,
  unknown: 0,
  bounced: 0,
  failed: 0,
  suppressed: 0,
  skipped_no_email: 0,
  read: 0,
  unsubscribed: 0,
};

export function campaignFixture(overrides: Partial<CampaignFixture> = {}): CampaignFixture {
  return {
    id: CAMPAIGN_ID,
    subject: 'Coupure d’eau lundi',
    body: 'Bonjour {{ Prénom }}, une coupure d’eau est prévue lundi de 9 h à 12 h.',
    audience: 'tenants',
    audience_label: 'Tous les locataires',
    building_ids: [],
    status: 'draft',
    copy_to_history: true,
    scheduled_at: null,
    sending_started_at: null,
    sent_at: null,
    cancelled_at: null,
    content_purged: false,
    recipient_count: 0,
    failed_count: 0,
    metrics: EMPTY_METRICS,
    attachments: [],
    created_by_user_id: USER_ID,
    lock_version: 1,
    created_at: '2026-11-19T08:00:00+00:00',
    updated_at: '2026-11-19T08:00:00+00:00',
    ...overrides,
  };
}

export function sentCampaignFixture(overrides: Partial<CampaignFixture> = {}): CampaignFixture {
  return campaignFixture({
    status: 'sent',
    sending_started_at: '2026-11-19T09:00:00+00:00',
    sent_at: '2026-11-19T09:05:00+00:00',
    recipient_count: 10,
    failed_count: 1,
    lock_version: 2,
    metrics: { ...EMPTY_METRICS, sent: 8, bounced: 1, skipped_no_email: 1, read: 4, unsubscribed: 1 },
    ...overrides,
  });
}

export function sendingCampaignFixture(overrides: Partial<CampaignFixture> = {}): CampaignFixture {
  return campaignFixture({
    status: 'sending',
    sending_started_at: '2026-11-19T09:00:00+00:00',
    recipient_count: 10,
    lock_version: 2,
    metrics: { ...EMPTY_METRICS, queued: 6, sent: 4 },
    ...overrides,
  });
}

export const campaignResponse = (campaign: CampaignFixture) => ({ data: campaign });

export const COUNTS = { all: 0, draft: 0, scheduled: 0, sending: 0, sent: 0, cancelled: 0 };

export const STATS = { this_month: 0, scheduled: 0, sent_count: 0, read_count: 0, read_rate_percent: null as number | null, failures: 0 };

export function campaignListResponse(
  campaigns: CampaignFixture[],
  extra: { next_cursor?: string | null; counts?: Partial<typeof COUNTS>; stats?: Partial<typeof STATS> } = {},
) {
  return {
    data: campaigns,
    links: { first: null, last: null, prev: null, next: null },
    meta: { path: `https://api.test/api/v1/org/${ORG_ID}/campaigns`, per_page: 25, next_cursor: extra.next_cursor ?? null, prev_cursor: null },
    counts: { ...COUNTS, all: campaigns.length, ...extra.counts },
    stats: { ...STATS, ...extra.stats },
  };
}

export const audiencesResponse = (mandants = true) => ({
  data: [
    {
      audience: 'tenants' as const,
      label: 'Tous les locataires',
      detail: 'Locataires des baux signés en cours, par immeuble au choix',
      count: 12,
      without_email: 2,
      buildings: [
        { id: BUILDING_ID, name: 'Résidence Les Palmiers', count: 7, without_email: 1 },
        { id: SECOND_BUILDING_ID, name: 'Immeuble Akpakpa', count: 6, without_email: 1 },
      ],
    },
    ...(mandants
      ? [{ audience: 'mandants' as const, label: 'Tous les mandants', detail: 'Mandants des mandats actifs', buildings: [], count: 5, without_email: 0 }]
      : []),
  ],
});

export const testResponse = { data: { sent_to: 'jeanne@example.com', subject: 'Coupure d’eau lundi', sent_at: '2026-11-19T10:00:00+00:00' } };

export const attachmentResponse = { data: { id: ATTACHMENT_ID, name: 'avis-travaux.pdf', size_bytes: 2048 } };
