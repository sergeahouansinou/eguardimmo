import type { AudienceOption, Campaign, CampaignMetrics } from '../model';

const NONE: CampaignMetrics = { queued: 0, sending: 0, sent: 0, unknown: 0, bounced: 0, failed: 0, suppressed: 0, skippedNoEmail: 0, read: 0, unsubscribed: 0 };

export const DEMO_TEST_ADDRESS = 'gestion@agence-demo.test';

export function demoAudiences(agency: boolean): AudienceOption[] {
  const tenants: AudienceOption = {
    audience: 'tenants',
    label: 'Tous les locataires',
    detail: 'Locataires des baux signés en cours, par immeuble au choix',
    count: 12,
    withoutEmail: 2,
    buildings: [
      { id: 'demo-building-palmiers', name: 'Résidence Les Palmiers', count: 7, withoutEmail: 1 },
      { id: 'demo-building-akpakpa', name: 'Immeuble Akpakpa', count: 6, withoutEmail: 1 },
    ],
  };
  const mandants: AudienceOption = { audience: 'mandants', label: 'Tous les mandants', detail: 'Mandants des mandats actifs', count: 5, withoutEmail: 0, buildings: [] };
  return agency ? [tenants, mandants] : [tenants];
}

export function demoCampaigns(now: Date): Campaign[] {
  const day = (offset: number, hour = 9) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + offset);
    date.setUTCHours(hour, 0, 0, 0);
    return date.toISOString().replace('.000Z', '+00:00');
  };
  const base = { buildingIds: [], copyToHistory: true, contentPurged: false, createdByUserId: 'demo-user', attachments: [], sendingStartedAt: null, cancelledAt: null };
  return [
    {
      ...base,
      id: 'demo-campaign-sent',
      subject: 'Assemblée des copropriétaires du 12 décembre',
      body: 'Bonjour {{ Prénom }}, l’assemblée se tiendra le 12 décembre à 18 h. Votre présence est vivement souhaitée.',
      audience: 'tenants',
      audienceLabel: 'Tous les locataires',
      status: 'sent',
      scheduledAt: null,
      sendingStartedAt: day(-3),
      sentAt: day(-3),
      recipientCount: 12,
      failedCount: 1,
      metrics: { ...NONE, sent: 9, bounced: 1, skippedNoEmail: 2, read: 6, unsubscribed: 0 },
      lockVersion: 2,
      createdAt: day(-4),
      updatedAt: day(-3),
    },
    {
      ...base,
      id: 'demo-campaign-scheduled',
      subject: 'Changement des coordonnées de paiement de l’agence',
      body: 'Bonjour {{ Prénom }}, à compter du mois prochain, les loyers se règlent sur le nouveau compte de l’agence.',
      audience: 'tenants',
      audienceLabel: 'Tous les locataires',
      status: 'scheduled',
      scheduledAt: day(2),
      sentAt: null,
      recipientCount: 0,
      failedCount: 0,
      metrics: NONE,
      lockVersion: 2,
      createdAt: day(-1),
      updatedAt: day(-1),
    },
    {
      ...base,
      id: 'demo-campaign-draft',
      subject: 'Rappel d’assurance habitation',
      body: 'Bonjour {{ Prénom }}, pensez à nous transmettre votre attestation d’assurance.',
      audience: 'tenants',
      audienceLabel: 'Tous les locataires',
      status: 'draft',
      scheduledAt: null,
      sentAt: null,
      recipientCount: 0,
      failedCount: 0,
      metrics: NONE,
      lockVersion: 1,
      createdAt: day(-1),
      updatedAt: day(-1),
    },
  ];
}
