import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { problem, proofRequired } from '../fixtures';
import { jsonResponse, setupApi } from '../testApi';
import type { CampaignInput } from './campaignBody';
import {
  CAMPAIGN_IDS,
  campaignDetail,
  campaignEstimate,
  campaignImage,
  campaignList,
  campaignSummary,
  marketingOptions,
  savedCampaign,
} from './fixtures';
import { marketingApi } from './marketing';

const ROOT = '/api/v1/console/marketing';
const ONE = `${ROOT}/campaigns/${CAMPAIGN_IDS.campaign}`;

const input = (overrides: Partial<CampaignInput> = {}): CampaignInput => ({
  channel: 'email',
  category: 'service',
  audience: 'all_accounts',
  inactivityDays: null,
  recipientEmails: [],
  subject: 'Maintenance',
  html: '<p>Dimanche.</p>',
  pushTitle: '',
  pushBody: '',
  link: '',
  images: [],
  removedImageIds: [],
  ...overrides,
});

const formOf = (value: BodyInit | null | undefined): FormData => {
  if (!(value instanceof FormData)) throw new Error('Corps multipart attendu.');
  return value;
};

describe('API des campagnes de la plateforme', () => {
  it('lit les réglages : canaux, catégories, groupes et limites', async () => {
    const { client, url } = setupApi(jsonResponse(200, { data: marketingOptions() }));
    const options = await marketingApi(client).options();

    expect(url().pathname).toBe(`${ROOT}/options`);
    expect(options.limits).toEqual({ subject: 140, push_title: 65, push_body: 240, html_bytes: 200000, images: 5, image_bytes: 2097152, total_image_bytes: 6291456, selected_recipients: 500 });
    expect(options.audiences.find((audience) => audience.code === 'inactive_accounts')?.accepts_inactivity_days).toBe(true);
  });

  it('liste avec le statut et le curseur', async () => {
    const { client, url } = setupApi(jsonResponse(200, campaignList([campaignSummary()], { has_more: true, next_cursor: 'suite' })));
    const page = await marketingApi(client).list({ status: 'sent', cursor: 'abc', perPage: 25 });

    expect(url().pathname).toBe(`${ROOT}/campaigns`);
    expect(Object.fromEntries(url().searchParams)).toEqual({ status: 'sent', cursor: 'abc', per_page: '25' });
    expect(page).toMatchObject({ hasMore: true, nextCursor: 'suite' });
    expect(page.rows[0]?.audience_label).toBe('Tous les comptes');
  });

  it('lit le détail avec ses images et refuse une adresse d’image hors de la console', async () => {
    const { client } = setupApi(
      jsonResponse(200, { data: campaignDetail({ images: [campaignImage()] }) }),
      jsonResponse(200, { data: campaignDetail({ images: [campaignImage({ url: 'https://pistage.example/pixel.gif' })] }) }),
    );
    const api = marketingApi(client);

    expect((await api.get(CAMPAIGN_IDS.campaign)).images[0]?.inline).toBe(true);
    await expect(api.get(CAMPAIGN_IDS.campaign)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('crée en JSON sans image, avec les seuls champs du canal', async () => {
    const { client, url, method, body } = setupApi(jsonResponse(201, savedCampaign({}, ['inconnu@exemple.fr'])));
    const saved = await marketingApi(client).create(input({ audience: 'selected', recipientEmails: ['a@exemple.fr', 'inconnu@exemple.fr'] }));

    expect([method(), url().pathname]).toEqual(['POST', `${ROOT}/campaigns`]);
    expect(body()).toEqual({
      channel: 'email',
      category: 'service',
      audience: 'selected',
      recipient_emails: ['a@exemple.fr', 'inconnu@exemple.fr'],
      subject: 'Maintenance',
      html: '<p>Dimanche.</p>',
    });
    expect(saved.unknownRecipients).toEqual(['inconnu@exemple.fr']);
    expect(saved.campaign.lock_version).toBe(3);
  });

  it('envoie les images en multipart sous « images[ref] », avec les retraits et la version', async () => {
    const { client, fetchImpl, url } = setupApi(jsonResponse(200, savedCampaign()));
    const file = new File(['png!'], 'bandeau.png', { type: 'image/png' });
    await marketingApi(client).update(
      CAMPAIGN_IDS.campaign,
      input({ audience: 'inactive_accounts', inactivityDays: 14, html: '<p><img src="cid:img-1"></p>', images: [{ ref: 'img-1', file }], removedImageIds: [CAMPAIGN_IDS.image] }),
      3,
    );
    const form = formOf(fetchImpl.mock.calls[0]?.[1]?.body);

    expect(url().pathname).toBe(ONE);
    expect(form.get('lock_version')).toBe('3');
    expect(form.get('inactivity_days')).toBe('14');
    expect(form.get('channel')).toBe('email');
    expect(form.getAll('removed_image_ids[]')).toEqual([CAMPAIGN_IDS.image]);
    const sent = form.get('images[img-1]');
    expect(sent instanceof File && sent.name).toBe('bandeau.png');
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).has('Content-Type')).toBe(false);
  });

  it('répète « recipient_emails[] » en multipart', async () => {
    const { client, fetchImpl } = setupApi(jsonResponse(201, savedCampaign()));
    const file = new File(['gif'], 'a.gif', { type: 'image/gif' });
    await marketingApi(client).create(input({ audience: 'selected', recipientEmails: ['a@exemple.fr', 'b@exemple.fr'], images: [{ ref: 'img-2', file }] }));

    expect(formOf(fetchImpl.mock.calls[0]?.[1]?.body).getAll('recipient_emails[]')).toEqual(['a@exemple.fr', 'b@exemple.fr']);
  });

  it('crée une notification push sans lien et l’efface à la mise à jour', async () => {
    const { client, body } = setupApi(jsonResponse(201, savedCampaign()), jsonResponse(200, savedCampaign()), jsonResponse(200, savedCampaign()));
    const push = input({ channel: 'push', pushTitle: 'Rappel', pushBody: 'Pensez-y.' });
    const api = marketingApi(client);
    await api.create(push);
    await api.update(CAMPAIGN_IDS.campaign, push, 4);
    await api.update(CAMPAIGN_IDS.campaign, { ...push, link: '/loyers' }, 5);

    expect(body(0)).toEqual({ channel: 'push', category: 'service', audience: 'all_accounts', push_title: 'Rappel', push_body: 'Pensez-y.' });
    expect(body(1)).toMatchObject({ link: null, lock_version: 4 });
    expect(body(2)).toMatchObject({ link: '/loyers', lock_version: 5 });
  });

  it('estime, teste et envoie', async () => {
    const { client, url, method, body } = setupApi(
      jsonResponse(200, campaignEstimate()),
      jsonResponse(200, { data: { sent_to: 'awa.diallo@eguardimmo.test' } }),
      jsonResponse(202, { data: campaignDetail({ status: 'sending' }) }),
    );
    const api = marketingApi(client);

    expect(await api.estimate(CAMPAIGN_IDS.campaign)).toEqual({ total: 120, eligible: 100, excluded_no_consent: 15, excluded_unreachable: 5 });
    expect(await api.test(CAMPAIGN_IDS.campaign)).toEqual({ sentTo: 'awa.diallo@eguardimmo.test' });
    expect((await api.send(CAMPAIGN_IDS.campaign, 3)).status).toBe('sending');
    expect([0, 1, 2].map((index) => `${method(index)} ${url(index).pathname}`)).toEqual([`GET ${ONE}/estimate`, `POST ${ONE}/test`, `POST ${ONE}/send`]);
    expect(body(2)).toEqual({ lock_version: 3 });
  });

  it.each([
    [404, 'platform_campaign_not_found'],
    [409, 'platform_campaign_not_editable'],
    [409, 'platform_campaign_stale'],
    [409, 'platform_campaign_no_recipient'],
    [409, 'platform_campaign_no_device'],
    [422, 'platform_campaign_too_large'],
    [503, 'campaign_sending_disabled'],
    [503, 'push_sending_disabled'],
  ])('remonte l’erreur %i %s avec son code', async (status, code) => {
    const { client } = setupApi(jsonResponse(status, problem(status, code, 'Refus du serveur.')));
    const failure = await marketingApi(client).send(CAMPAIGN_IDS.campaign, 1).catch((error: unknown) => error);

    expect(describeProblem(failure).code).toBe(code);
  });

  it('ne confond pas la demande de preuve avec une réponse', async () => {
    const { client } = setupApi(jsonResponse(422, proofRequired));

    await expect(marketingApi(client).send(CAMPAIGN_IDS.campaign, 1)).rejects.toMatchObject({ code: 'operator_proof_required' });
  });

  it('refuse une réponse hors contrat', async () => {
    const { client } = setupApi(jsonResponse(200, { data: campaignDetail({ status: 'archived' }) }), jsonResponse(201, { data: campaignDetail() }));
    const api = marketingApi(client);

    await expect(api.get(CAMPAIGN_IDS.campaign)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(api.create(input())).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});
