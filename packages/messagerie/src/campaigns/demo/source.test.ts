import { describe, expect, it } from 'vitest';
import type { CampaignDraftInput } from '../model';
import { createDemoCampaignsSource } from './source';

const NOW = new Date('2026-11-19T09:00:00+00:00');
const INPUT: CampaignDraftInput = { subject: 'Coupure', body: 'Bonjour {{ Prénom }}', audience: 'tenants', buildingIds: [], copyToHistory: true };
const query = { tab: 'all', search: '', building: 'all', period: 'all', perPage: 25 } as const;

function source(agency = true) {
  return createDemoCampaignsSource({ agency, now: () => NOW });
}

describe('source de démonstration des campagnes', () => {
  it('liste des campagnes d’exemple avec compteurs cohérents', async () => {
    const page = await source().list(query, null);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.counts.all).toBe(page.items.length);
    expect(page.counts.draft).toBe(page.items.filter((item) => item.status === 'draft').length);
  });

  it('crée un brouillon, le modifie avec la bonne version, l’envoie puis refuse de le modifier', async () => {
    const demo = source();
    const created = await demo.create(INPUT);
    expect(created.status).toBe('draft');
    const updated = await demo.update(created.id, { ...INPUT, subject: 'Autre' }, created.lockVersion);
    expect(updated.subject).toBe('Autre');
    await expect(demo.update(created.id, INPUT, created.lockVersion)).rejects.toMatchObject({ status: 409, code: 'campaign_version_conflict' });
    const sent = await demo.send(created.id);
    expect(['sending', 'sent']).toContain(sent.status);
    await expect(demo.update(created.id, INPUT, sent.lockVersion)).rejects.toMatchObject({ status: 409, code: 'campaign_not_editable' });
  });

  it('programme dans le futur seulement, puis annule', async () => {
    const demo = source();
    const created = await demo.create(INPUT);
    await expect(demo.schedule(created.id, '2026-11-19T09:05:00+00:00')).rejects.toMatchObject({ status: 422, code: 'campaign_schedule_invalid' });
    const scheduled = await demo.schedule(created.id, '2026-11-20T09:00:00+00:00');
    expect(scheduled.status).toBe('scheduled');
    expect((await demo.cancel(created.id)).status).toBe('cancelled');
    await expect(demo.cancel(created.id)).rejects.toMatchObject({ status: 409 });
  });

  it('ne propose pas les mandants à un bailleur individuel et refuse cette audience', async () => {
    const demo = source(false);
    expect((await demo.audiences()).map((option) => option.audience)).toEqual(['tenants']);
    await expect(demo.create({ ...INPUT, audience: 'mandants' })).rejects.toMatchObject({ status: 422 });
  });

  it('signale une campagne introuvable par un 404', async () => {
    await expect(source().get('inconnue')).rejects.toMatchObject({ status: 404, code: 'campaign_not_found' });
  });
});
