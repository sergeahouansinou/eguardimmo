export const CAMPAIGN_IDS = {
  campaign: '01934f6e-1111-7000-8000-000000000001',
  other: '01934f6e-1111-7000-8000-000000000002',
  image: '01934f6e-2222-7000-8000-000000000001',
};

export const imagePath = (campaign: string = CAMPAIGN_IDS.campaign, image: string = CAMPAIGN_IDS.image) =>
  `/api/v1/console/marketing/campaigns/${campaign}/images/${image}`;

export const marketingOptions = (overrides: Record<string, unknown> = {}) => ({
  channels: [
    { channel: 'email', enabled: true, reason: null },
    { channel: 'push', enabled: true, reason: null },
  ],
  categories: [
    { code: 'marketing', label: 'Actualités et offres', description: 'Réservée aux comptes qui ont accepté les actualités.' },
    { code: 'service', label: 'Information de service', description: 'Information sur le fonctionnement du service.' },
  ],
  audiences: [
    { code: 'all_accounts', label: 'Tous les comptes', description: 'Comptes vérifiés et actifs.', accepts_inactivity_days: false },
    { code: 'inactive_accounts', label: 'Comptes inactifs', description: 'Comptes sans activité récente.', accepts_inactivity_days: true },
    { code: 'selected', label: 'Personnes précises', description: 'Comptes désignés par leur adresse.', accepts_inactivity_days: false },
  ],
  limits: {
    subject: 140,
    push_title: 65,
    push_body: 240,
    html_bytes: 200000,
    images: 5,
    image_bytes: 2097152,
    total_image_bytes: 6291456,
    selected_recipients: 500,
  },
  ...overrides,
});

export const campaignSummary = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_IDS.campaign,
  channel: 'email',
  category: 'service',
  title: 'Maintenance de novembre',
  audience: 'all_accounts',
  audience_label: 'Tous les comptes',
  status: 'draft',
  recipient_count: 0,
  sent_count: 0,
  failed_count: 0,
  skipped_count: 0,
  created_at: '2026-11-24T09:00:00+00:00',
  sent_at: null,
  ...overrides,
});

export const campaignStats = (overrides: Record<string, unknown> = {}) => ({
  queued: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  bounced: 0,
  suppressed: 0,
  unknown: 0,
  skipped_no_device: 0,
  skipped_no_email: 0,
  unsubscribed: 0,
  ...overrides,
});

export const campaignDetail = (overrides: Record<string, unknown> = {}) => ({
  ...campaignSummary(),
  subject: 'Maintenance de novembre',
  html: '<p>Le service sera interrompu dimanche.</p>',
  push_title: null,
  push_body: null,
  link: null,
  inactivity_days: null,
  recipient_emails: [],
  images: [],
  lock_version: 3,
  stats: campaignStats(),
  ...overrides,
});

export const campaignImage = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_IDS.image,
  name: 'bandeau.png',
  mime: 'image/png',
  size: 4,
  url: imagePath(),
  inline: true,
  ...overrides,
});

export const campaignList = (rows: Record<string, unknown>[], meta: Record<string, unknown> = {}) => ({
  data: rows,
  meta: { has_more: false, next_cursor: null, ...meta },
});

export const savedCampaign = (overrides: Record<string, unknown> = {}, unknown: string[] = []) => ({
  data: campaignDetail(overrides),
  meta: { unknown_recipients: unknown },
});

export const campaignEstimate = (overrides: Record<string, unknown> = {}) => ({
  data: { total: 120, eligible: 100, excluded_no_consent: 15, excluded_unreachable: 5, ...overrides },
});
