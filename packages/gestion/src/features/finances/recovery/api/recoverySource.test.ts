import { ApiUnreachableError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryApiError } from './recoveryErrors';
import { createApiRecoverySource } from './recoverySource';
import * as api from './responses.fixtures';
import { mockRecoveryApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const url = (path: string) => orgPath(api.IDS.org, `/recovery${path}`);
const plain = (path: string) => orgPath(api.IDS.org, path);
const NOW = new Date('2026-11-16T10:00:00Z');

function build(routes: Record<string, MockRoute>, role: 'manager' | 'accountant' | null = 'manager') {
  const mock = mockRecoveryApi(routes);
  const source = createApiRecoverySource({ client: mock.client, organizationId: api.IDS.org, role }, { now: () => NOW, fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

describe('droits', () => {
  it('autorise l’écriture au gestionnaire, pas au comptable ni sans rôle', () => {
    expect(build({}, 'manager').source.permissions.write).toBe(true);
    expect(build({}, 'accountant').source.permissions.write).toBe(false);
    expect(build({}, null).source.permissions.write).toBe(false);
  });
});

describe('impayés et dossiers', () => {
  it('charge les impayés avec le curseur after et renvoie le suivant', async () => {
    const { source, callsTo } = build({ [`GET ${url('/unpaid')}`]: { body: api.unpaidPage1 } });
    const page = await source.unpaid({ after: null });
    expect(page.nextAfter).toBe(api.IDS.installments[1]);
    expect(page.items[0]?.outstanding).toEqual({ amount: 45000, currency: 'EUR' });
    expect(callsTo('GET', url('/unpaid'))[0]?.search.get('per_page')).toBe('25');
    expect(callsTo('GET', url('/unpaid'))[0]?.search.has('after')).toBe(false);
    await source.unpaid({ after: api.IDS.installments[1] });
    expect(callsTo('GET', url('/unpaid'))[1]?.search.get('after')).toBe(api.IDS.installments[1]);
  });

  it('liste les dossiers avec le filtre de statut', async () => {
    const { source, callsTo } = build({ [`GET ${url('/cases')}`]: { body: api.caseList } });
    const page = await source.cases({ status: 'open' });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    expect(callsTo('GET', url('/cases'))[0]?.search.get('status')).toBe('open');
  });

  it('charge le détail d’un dossier', async () => {
    const { source } = build({ [`GET ${url(`/cases/${api.IDS.case}`)}`]: { body: api.caseDetail } });
    const detail = await source.caseDetail(api.IDS.case);
    expect(detail.items).toHaveLength(3);
    expect(detail.bundles).toHaveLength(1);
  });
});

describe('ouverture et créances', () => {
  it('ouvre un dossier avec exactement la sélection transmise, sans doublon', async () => {
    const { source, callsTo } = build({ [`POST ${url('/cases')}`]: { status: 201, body: api.openCase } });
    const ids = [api.IDS.installments[0] ?? '', api.IDS.installments[1] ?? '', api.IDS.installments[0] ?? ''];
    const opened = await source.openCase({ leaseId: api.IDS.lease, debtorPartyId: api.IDS.party, installmentIds: ids, invoiceIds: [] });
    expect(opened.outstanding).toEqual({ amount: 115000, currency: 'EUR' });
    expect(callsTo('POST', url('/cases'))[0]?.body).toEqual({
      lease_id: api.IDS.lease,
      debtor_party_id: api.IDS.party,
      installment_ids: [api.IDS.installments[0], api.IDS.installments[1]],
    });
  });

  it('ouvre un dossier mêlant échéance et facture, avec les deux listes', async () => {
    const { source, callsTo } = build({ [`POST ${url('/cases')}`]: { status: 201, body: api.openCaseWithInvoice } });
    const opened = await source.openCase({ leaseId: api.IDS.lease, debtorPartyId: api.IDS.party, installmentIds: [api.IDS.installments[0] ?? ''], invoiceIds: [api.IDS.invoice] });
    expect(callsTo('POST', url('/cases'))[0]?.body).toEqual({
      lease_id: api.IDS.lease,
      debtor_party_id: api.IDS.party,
      installment_ids: [api.IDS.installments[0]],
      invoice_ids: [api.IDS.invoice],
    });
    expect(opened.items.map((item) => [item.type, item.itemId, item.reference])).toEqual([['installment', api.IDS.installments[0], null], ['invoice', api.IDS.invoice, 'FA-2026-0001']]);
  });

  it('ouvre un dossier de factures seules sans envoyer de liste d’échéances', async () => {
    const { source, callsTo } = build({ [`POST ${url('/cases')}`]: { status: 201, body: api.openCaseWithInvoice } });
    await source.openCase({ leaseId: api.IDS.lease, debtorPartyId: api.IDS.party, installmentIds: [], invoiceIds: [api.IDS.invoice] });
    expect(callsTo('POST', url('/cases'))[0]?.body).toEqual({ lease_id: api.IDS.lease, debtor_party_id: api.IDS.party, invoice_ids: [api.IDS.invoice] });
  });

  it('traduit le 422 du serveur sur installment_ids quand aucune créance n’est transmise', async () => {
    const problem = { ...api.problemStatusInvalid, errors: { installment_ids: ['validation.required_without'] } };
    const { source } = build({ [`POST ${url('/cases')}`]: { status: 422, body: problem } });
    const error = await source.openCase({ leaseId: api.IDS.lease, debtorPartyId: api.IDS.party, installmentIds: [api.IDS.installments[0] ?? ''], invoiceIds: [] }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'invalid', status: 422 });
    expect((error as RecoveryApiError).message).toContain('au moins une créance');
  });

  it('n’envoie rien quand la sélection est vide', async () => {
    const { source, calls } = build({});
    await expect(source.openCase({ leaseId: api.IDS.lease, debtorPartyId: api.IDS.party, installmentIds: [], invoiceIds: [] })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('ajoute des créances puis en retire une', async () => {
    const { source, callsTo } = build({
      [`POST ${url(`/cases/${api.IDS.case}/items`)}`]: { status: 201, body: api.addItems },
      [`DELETE ${url(`/cases/${api.IDS.case}/items/${api.IDS.item}`)}`]: { body: api.removeItem },
    });
    expect((await source.addItems(api.IDS.case, { installmentIds: [api.IDS.installments[2] ?? ''], invoiceIds: [] })).itemsCount).toBe(3);
    expect(callsTo('POST', url(`/cases/${api.IDS.case}/items`))[0]?.body).toEqual({ installment_ids: [api.IDS.installments[2]] });
    expect((await source.removeItem(api.IDS.case, api.IDS.item)).itemsCount).toBe(2);
  });

  it('ajoute une facture à un dossier ouvert', async () => {
    const { source, callsTo } = build({ [`POST ${url(`/cases/${api.IDS.case}/items`)}`]: { status: 200, body: api.addItemsInvoice } });
    const updated = await source.addItems(api.IDS.case, { installmentIds: [], invoiceIds: [api.IDS.invoice] });
    expect(callsTo('POST', url(`/cases/${api.IDS.case}/items`))[0]?.body).toEqual({ invoice_ids: [api.IDS.invoice] });
    expect(updated.items.at(-1)).toMatchObject({ type: 'invoice', itemId: api.IDS.invoice, reference: 'FA-2026-0001', issuedOn: '2026-10-01', periodStart: null });
  });

  it('traduit un dossier déjà ouvert en conflit français', async () => {
    const { source } = build({ [`POST ${url('/cases')}`]: { status: 409, body: api.problemCaseExists } });
    const error = await source.openCase({ leaseId: api.IDS.lease, debtorPartyId: api.IDS.party, installmentIds: [api.IDS.installments[0] ?? ''], invoiceIds: [] }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RecoveryApiError);
    expect(error).toMatchObject({ kind: 'conflict', code: 'recovery_case_exists' });
    expect((error as RecoveryApiError).message).toContain('Un dossier est déjà ouvert');
  });
});

describe('statut, carnet et envois', () => {
  it('change le statut avec un motif nettoyé et sans motif vide', async () => {
    const { source, callsTo } = build({ [`POST ${url(`/cases/${api.IDS.case}/status`)}`]: { body: api.statusClosed } });
    expect((await source.changeStatus(api.IDS.case, 'closed', '  Réglé à l’amiable  ')).status).toBe('closed');
    await source.changeStatus(api.IDS.case, 'closed', '   ');
    const [first, second] = callsTo('POST', url(`/cases/${api.IDS.case}/status`));
    expect(first?.body).toEqual({ status: 'closed', reason: 'Réglé à l’amiable' });
    expect(second?.body).toEqual({ status: 'closed' });
  });

  it('lit le carnet par curseur', async () => {
    const { source, callsTo } = build({ [`GET ${url(`/cases/${api.IDS.case}/acts`)}`]: { body: api.actsPageNext } });
    const page = await source.acts(api.IDS.case, { cursor: null });
    expect(page.nextCursor).not.toBeNull();
    expect(page.items.map((act) => act.type)).toEqual(['revocation', 'transmission']);
    expect(callsTo('GET', url(`/cases/${api.IDS.case}/acts`))[0]?.search.get('per_page')).toBe('25');
  });

  it('ajoute un acte manuel avec la date saisie et refuse une date future', async () => {
    const { source, callsTo, calls } = build({ [`POST ${url(`/cases/${api.IDS.case}/acts`)}`]: { status: 201, body: api.actCall } });
    const act = await source.addAct(api.IDS.case, { type: 'call', performedOn: '2026-11-10', note: 'Le locataire promet un virement', reference: '' });
    expect(act.type).toBe('call');
    expect(callsTo('POST', url(`/cases/${api.IDS.case}/acts`))[0]?.body).toEqual({ type: 'call', performed_on: '2026-11-10', note: 'Le locataire promet un virement', reference: null });
    const before = calls.length;
    await expect(source.addAct(api.IDS.case, { type: 'call', performedOn: '2026-11-17', note: '', reference: '' })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(before);
  });

  it('génère un envoi puis le relit', async () => {
    const { source } = build({
      [`POST ${url(`/cases/${api.IDS.case}/bundles`)}`]: { status: 201, body: api.bundle },
      [`GET ${url(`/bundles/${api.IDS.bundle}`)}`]: { body: api.bundleShowAfter },
    });
    expect((await source.generateBundle(api.IDS.case)).totalDue).toEqual({ amount: 115000, currency: 'EUR' });
    expect((await source.bundle(api.IDS.bundle)).transmissions).toHaveLength(2);
  });

  it('indique le délai quand le service PDF est indisponible', async () => {
    const { source } = build({ [`POST ${url(`/cases/${api.IDS.case}/bundles`)}`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } });
    const error = await source.generateBundle(api.IDS.case).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'unavailable', code: 'recovery_pdf_unavailable' });
    expect((error as RecoveryApiError).message).toContain('30 secondes');
  });
});

describe('téléchargement du ZIP', () => {
  it('récupère le ZIP avec les cookies de session', async () => {
    const { source, fetchImpl } = build({ [`GET ${url(`/bundles/${api.IDS.bundle}/download`)}`]: { zip: api.ZIP_BYTES } });
    const blob = await source.downloadBundle(api.IDS.bundle);
    expect(await blob.text()).toBe(api.ZIP_BYTES);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('refuse une réponse qui n’est pas un ZIP', async () => {
    const { source } = build({ [`GET ${url(`/bundles/${api.IDS.bundle}/download`)}`]: { body: api.bundle } });
    await expect(source.downloadBundle(api.IDS.bundle)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('traduit un envoi introuvable', async () => {
    const { source } = build({ [`GET ${url(`/bundles/${api.IDS.bundle}/download`)}`]: { status: 404, body: { ...api.problemCaseNotFound, code: 'recovery_bundle_not_found' } } });
    await expect(source.downloadBundle(api.IDS.bundle)).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('signale un serveur injoignable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('network')));
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl, readCookie: () => 'xsrf' });
    const source = createApiRecoverySource({ client, organizationId: api.IDS.org, role: 'manager' }, { fetchImpl });
    await expect(source.downloadBundle(api.IDS.bundle)).rejects.toBeInstanceOf(ApiUnreachableError);
  });
});

describe('commissaires de justice', () => {
  const routes = (): Record<string, MockRoute> => ({
    [`GET ${plain('/catalog/vocabularies/contact_category/terms')}`]: { body: api.termsResponse },
    [`GET ${plain('/parties')}`]: { body: api.partiesBailiff },
  });

  it('cherche la catégorie par sa clé sémantique et liste ses parties', async () => {
    const { source, callsTo } = build(routes());
    const bailiffs = await source.bailiffs();
    expect(bailiffs).toEqual([
      { id: api.IDS.bailiff, name: 'Étude Martin', email: 'etude@martin-cj.fr' },
      { id: expect.any(String) as string, name: 'Étude sans e-mail', email: null },
    ]);
    expect(callsTo('GET', plain('/parties'))[0]?.search.get('category')).toBe(api.termsResponse.data[0]?.id);
  });

  it('écarte les parties archivées ou anonymisées', async () => {
    const [first, second] = api.partiesBailiff.data;
    const body = { ...api.partiesBailiff, data: [first, { ...second, archived_at: '2026-01-01T00:00:00+00:00' }, { ...first, id: '01a1e981-cce6-70df-a375-e09c210abf99', is_anonymized: true }] };
    const { source } = build({ ...routes(), [`GET ${plain('/parties')}`]: { body } });
    expect((await source.bailiffs()).map((bailiff) => bailiff.id)).toEqual([api.IDS.bailiff]);
  });
});

describe('transmissions', () => {
  it('transmet avec la durée choisie, 7 jours par défaut côté écran', async () => {
    const { source, callsTo } = build({ [`POST ${url(`/bundles/${api.IDS.bundle}/transmissions`)}`]: { status: 201, body: api.transmit } });
    const transmission = await source.transmit(api.IDS.bundle, { recipientPartyId: api.IDS.bailiff, validDays: 7 });
    expect(transmission).toMatchObject({ state: 'active', recipientEmail: 'etude@martin-cj.fr' });
    expect(callsTo('POST', url(`/bundles/${api.IDS.bundle}/transmissions`))[0]?.body).toEqual({ recipient_party_id: api.IDS.bailiff, valid_days: 7 });
  });

  it('refuse une validité hors 1 à 30 jours sans appeler le serveur', async () => {
    const { source, calls } = build({});
    await expect(source.transmit(api.IDS.bundle, { recipientPartyId: api.IDS.bailiff, validDays: 31 })).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.transmit(api.IDS.bundle, { recipientPartyId: api.IDS.bailiff, validDays: 0 })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('traduit un destinataire invalide', async () => {
    const { source } = build({ [`POST ${url(`/bundles/${api.IDS.bundle}/transmissions`)}`]: { status: 422, body: api.problemRecipientInvalid } });
    await expect(source.transmit(api.IDS.bundle, { recipientPartyId: api.IDS.bailiff, validDays: 7 })).rejects.toMatchObject({ kind: 'invalid', code: 'recovery_recipient_invalid' });
  });

  it('révoque avec un motif facultatif puis renvoie le lien', async () => {
    const { source, callsTo } = build({
      [`POST ${url(`/transmissions/${api.IDS.resend}/revoke`)}`]: { body: api.revoke },
      [`POST ${url(`/transmissions/${api.IDS.transmission}/resend`)}`]: { status: 201, body: api.resend },
    });
    expect((await source.revoke(api.IDS.resend, 'Envoyé à la mauvaise étude')).state).toBe('revoked');
    expect(callsTo('POST', url(`/transmissions/${api.IDS.resend}/revoke`))[0]?.body).toEqual({ reason: 'Envoyé à la mauvaise étude' });
    expect((await source.resend(api.IDS.transmission, 10)).replacesId).toBe(api.IDS.transmission);
    expect(callsTo('POST', url(`/transmissions/${api.IDS.transmission}/resend`))[0]?.body).toEqual({ valid_days: 10 });
  });

  it('traduit une révocation répétée', async () => {
    const { source } = build({ [`POST ${url(`/transmissions/${api.IDS.resend}/revoke`)}`]: { status: 409, body: api.problemRevokeAgain } });
    await expect(source.revoke(api.IDS.resend, '')).rejects.toMatchObject({ kind: 'conflict', code: 'recovery_transmission_not_active' });
  });
});

describe('garde-fous', () => {
  it('refuse d’appeler le serveur sans organisation', async () => {
    const mock = mockRecoveryApi({});
    const source = createApiRecoverySource({ client: mock.client, organizationId: null, role: 'manager' }, { fetchImpl: mock.fetchImpl });
    await expect(source.unpaid({})).rejects.toMatchObject({ kind: 'no_organization' });
    expect(mock.calls).toHaveLength(0);
  });

  it('liste échéances et factures ensemble, avec le type de chaque ligne', async () => {
    const { source } = build({ [`GET ${url('/unpaid')}`]: { body: api.unpaidWithInvoice } });
    const page = await source.unpaid({});
    expect(page.items.map((row) => row.type)).toEqual(['installment', 'installment', 'installment', 'invoice']);
    expect(page.items[3]).toMatchObject({ itemId: api.IDS.invoice, reference: 'FA-2026-0001', periodStart: null, issuedOn: '2026-10-01', status: null, outstanding: { amount: 10000, currency: 'EUR' } });
  });

  it('refuse une facture sans numéro et une échéance sans période', async () => {
    const invoice = api.unpaidInvoiceOnly.data[0];
    const installment = api.unpaidAll.data[0];
    const noNumber = build({ [`GET ${url('/unpaid')}`]: { body: { data: [{ ...invoice, reference: null }], meta: { next_after: null } } } });
    await expect(noNumber.source.unpaid({})).rejects.toMatchObject({ kind: 'unexpected_response' });
    const noPeriod = build({ [`GET ${url('/unpaid')}`]: { body: { data: [{ ...installment, period: null }], meta: { next_after: null } } } });
    await expect(noPeriod.source.unpaid({})).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('signale une réponse qui ne respecte pas le contrat', async () => {
    const { source } = build({ [`GET ${url('/unpaid')}`]: { body: { data: [{ installment_id: 'x' }], meta: { next_after: null } } } });
    await expect(source.unpaid({})).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('traduit un 403 serveur même si l’écran avait masqué le bouton', async () => {
    const { source } = build({ [`POST ${url(`/cases/${api.IDS.case}/status`)}`]: { status: 403, body: api.problemForbidden } }, 'accountant');
    await expect(source.changeStatus(api.IDS.case, 'closed', '')).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
  });
});
