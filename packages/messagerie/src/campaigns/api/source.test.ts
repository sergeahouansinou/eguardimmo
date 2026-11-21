import { ApiError, buildUrl } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError } from '../../external/api/errors';
import type { CampaignDraftInput } from '../model';
import {
  ATTACHMENT_ID,
  BUILDING_ID,
  CAMPAIGN_ID,
  ORG_ID,
  attachmentResponse,
  audiencesResponse,
  campaignFixture,
  campaignListResponse,
  campaignResponse,
  sentCampaignFixture,
  testResponse,
} from '../testing';
import { createCampaignsApiSource } from './source';

type Mock = ReturnType<typeof vi.fn>;

function fakeClient(reply: unknown = {}): ApiClient & Record<'get' | 'post' | 'patch' | 'delete', Mock> {
  const respond = vi.fn(() => Promise.resolve(reply));
  return {
    baseUrl: 'http://api.test',
    get: respond,
    post: respond,
    put: respond,
    patch: respond,
    delete: respond,
    url: (path, query) => buildUrl('http://api.test', path, query),
  };
}

const ROOT = `/api/v1/org/${ORG_ID}/campaigns`;
const QUERY = { tab: 'sent', search: ' eau ', building: BUILDING_ID, period: 'month', perPage: 25 } as const;
const INPUT: CampaignDraftInput = { subject: 'Coupure d’eau lundi', body: 'Bonjour {{ Prénom }}', audience: 'tenants', buildingIds: [BUILDING_ID], copyToHistory: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('source API des campagnes', () => {
  it('liste avec les filtres serveur, ignore les filtres « tous » et traduit compteurs et statistiques', async () => {
    const client = fakeClient(
      campaignListResponse([sentCampaignFixture()], { next_cursor: 'suite', counts: { sent: 1 }, stats: { sent_count: 8, read_count: 4, read_rate_percent: 50 } }),
    );
    const source = createCampaignsApiSource({ client, organizationId: ORG_ID });

    const page = await source.list(QUERY, 'curseur');
    await source.list({ ...QUERY, tab: 'all', building: 'all', period: 'all', search: '' }, null);

    expect(client.get).toHaveBeenNthCalledWith(1, ROOT, { per_page: 25, cursor: 'curseur', status: 'sent', search: 'eau', building: BUILDING_ID, period: 'month' });
    expect(client.get).toHaveBeenNthCalledWith(2, ROOT, { per_page: 25, cursor: null, status: undefined, search: '', building: undefined, period: undefined });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('suite');
    expect(page.counts.sent).toBe(1);
    expect(page.stats).toMatchObject({ sentCount: 8, readCount: 4, readRatePercent: 50 });
    expect(page.items[0]).toMatchObject({ status: 'sent', recipientCount: 10, failedCount: 1, metrics: { sent: 8, skippedNoEmail: 1, read: 4 } });
  });

  it('crée un brouillon sans lock_version, en snake_case', async () => {
    const client = fakeClient(campaignResponse(campaignFixture()));
    await createCampaignsApiSource({ client, organizationId: ORG_ID }).create(INPUT);

    expect(client.post).toHaveBeenCalledWith(ROOT, {
      subject: 'Coupure d’eau lundi',
      body: 'Bonjour {{ Prénom }}',
      audience: 'tenants',
      building_ids: [BUILDING_ID],
      copy_to_history: false,
    });
  });

  it('modifie un brouillon en renvoyant la version lue (verrou optimiste)', async () => {
    const client = fakeClient(campaignResponse(campaignFixture({ lock_version: 5 })));
    const campaign = await createCampaignsApiSource({ client, organizationId: ORG_ID }).update(CAMPAIGN_ID, INPUT, 4);

    expect(client.patch).toHaveBeenCalledWith(`${ROOT}/${CAMPAIGN_ID}`, expect.objectContaining({ lock_version: 4, building_ids: [BUILDING_ID] }));
    expect(campaign.lockVersion).toBe(5);
  });

  it('envoie, programme et annule par les bonnes routes', async () => {
    const client = fakeClient(campaignResponse(campaignFixture({ status: 'scheduled', scheduled_at: '2026-11-20T09:00:00+00:00' })));
    const source = createCampaignsApiSource({ client, organizationId: ORG_ID });

    await source.send(CAMPAIGN_ID);
    await source.schedule(CAMPAIGN_ID, '2026-11-20T09:00:00.000Z');
    await source.cancel(CAMPAIGN_ID);

    expect(client.post).toHaveBeenNthCalledWith(1, `${ROOT}/${CAMPAIGN_ID}/send`, {});
    expect(client.post).toHaveBeenNthCalledWith(2, `${ROOT}/${CAMPAIGN_ID}/schedule`, { scheduled_at: '2026-11-20T09:00:00.000Z' });
    expect(client.post).toHaveBeenNthCalledWith(3, `${ROOT}/${CAMPAIGN_ID}/cancel`, {});
  });

  it('lit les destinataires proposés avec leurs immeubles', async () => {
    const client = fakeClient(audiencesResponse());
    const audiences = await createCampaignsApiSource({ client, organizationId: ORG_ID }).audiences();

    expect(client.get).toHaveBeenCalledWith(`${ROOT}/audiences`);
    expect(audiences.map((option) => option.audience)).toEqual(['tenants', 'mandants']);
    expect(audiences[0]?.buildings[0]).toMatchObject({ id: BUILDING_ID, name: 'Résidence Les Palmiers', count: 7, withoutEmail: 1 });
  });

  it('envoie une pièce jointe en multipart sous la clé file, et la retire', async () => {
    const client = fakeClient(attachmentResponse);
    const source = createCampaignsApiSource({ client, organizationId: ORG_ID });

    const attachment = await source.addAttachment(CAMPAIGN_ID, new File(['%PDF'], 'avis-travaux.pdf', { type: 'application/pdf' }));
    await source.removeAttachment(CAMPAIGN_ID, ATTACHMENT_ID);

    const call = client.post.mock.calls[0] as [string, FormData];
    expect(call[0]).toBe(`${ROOT}/${CAMPAIGN_ID}/attachments`);
    expect(call[1]).toBeInstanceOf(FormData);
    expect((call[1].get('file') as File).name).toBe('avis-travaux.pdf');
    expect(attachment).toEqual({ id: ATTACHMENT_ID, name: 'avis-travaux.pdf', sizeBytes: 2048 });
    expect(client.delete).toHaveBeenCalledWith(`${ROOT}/${CAMPAIGN_ID}/attachments/${ATTACHMENT_ID}`);
  });

  it('envoie un test à l’auteur sans identifiant de campagne', async () => {
    const client = fakeClient(testResponse);
    const result = await createCampaignsApiSource({ client, organizationId: ORG_ID }).sendTest({ subject: 'Sujet', body: 'Corps', audience: 'mandants' });

    expect(client.post).toHaveBeenCalledWith(`${ROOT}/test`, { subject: 'Sujet', body: 'Corps', audience: 'mandants' });
    expect(result.sentTo).toBe('jeanne@example.com');
  });

  it('refuse une réponse hors contrat (statut inconnu, lock_version absent)', async () => {
    const source = (reply: unknown) => createCampaignsApiSource({ client: fakeClient(reply), organizationId: ORG_ID });
    await expect(source(campaignResponse({ ...campaignFixture(), status: 'archived' } as never)).get(CAMPAIGN_ID)).rejects.toBeInstanceOf(UnexpectedResponseError);
    const incomplete: Record<string, unknown> = { ...campaignFixture() };
    delete incomplete.lock_version;
    await expect(source({ data: incomplete }).get(CAMPAIGN_ID)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('laisse remonter l’erreur serveur sans la transformer en succès', async () => {
    const client = fakeClient();
    client.patch.mockRejectedValue(new ApiError(409, 'campaign_version_conflict', 'Version périmée'));
    await expect(createCampaignsApiSource({ client, organizationId: ORG_ID }).update(CAMPAIGN_ID, INPUT, 1)).rejects.toMatchObject({ status: 409 });
  });

  it('télécharge une pièce en PDF depuis la route de la campagne', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(new Blob(['%PDF']), { status: 200, headers: { 'Content-Type': 'application/pdf' } })));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await createCampaignsApiSource({ client: fakeClient(), organizationId: ORG_ID, fetchImpl }).downloadAttachment(CAMPAIGN_ID, { id: ATTACHMENT_ID, name: 'avis.pdf' });

    expect(fetchImpl).toHaveBeenCalledWith(`http://api.test${ROOT}/${CAMPAIGN_ID}/attachments/${ATTACHMENT_ID}`, expect.objectContaining({ credentials: 'include' }));
  });
});
