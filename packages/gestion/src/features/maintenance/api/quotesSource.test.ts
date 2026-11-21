import { describe, expect, it } from 'vitest';
import { createApiMaintenanceSource } from './maintenanceSource';
import * as quotes from './quotes.fixtures';
import * as api from './responses.fixtures';
import { mockMaintenanceApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const url = (path = '') => orgPath(api.IDS.org, path);
const list = url('/quotes');

function build(routes: Record<string, MockRoute>) {
  const mock = mockMaintenanceApi(routes);
  const source = createApiMaintenanceSource({ client: mock.client, organizationId: api.IDS.org, role: 'owner', kind: 'agency' }, { fetchImpl: mock.fetchImpl });
  return { ...mock, source };
}

describe('liste des devis', () => {
  it('lit la page sans filtre et convertit montants, intervention et accord', async () => {
    const { source, callsTo } = build({ [`GET ${list}`]: { body: quotes.quotesPage } });

    const page = await source.quotes({});

    expect(Object.fromEntries(callsTo('GET', list)[0]?.search ?? [])).toEqual({ per_page: '25' });
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual({
      id: quotes.quoteSubmitted.id,
      interventionId: api.IDS.intervention,
      supplierPartyId: api.IDS.supplierParty,
      reference: quotes.quoteSubmitted.reference,
      kind: 'initial',
      status: 'submitted',
      issuedOn: '2026-11-17',
      validUntil: '2026-12-31',
      proposedOn: null,
      message: null,
      totalNet: { amount: 60000, currency: 'EUR' },
      totalTax: { amount: 12000, currency: 'EUR' },
      totalGross: { amount: 72000, currency: 'EUR' },
      lockVersion: 2,
      intervention: { id: api.IDS.intervention, reference: 'INT-2026-0001', status: 'awaiting_approval', unitId: api.IDS.unit },
      approval: { status: 'pending', ceilingAmount: { amount: 50000, currency: 'EUR' }, decideBefore: '2026-11-20T11:01:00+00:00' },
    });
    expect(page.items[1]).toMatchObject({ status: 'received', kind: 'supplement', supplierPartyId: null, approval: null });
  });

  it('envoie les filtres, le curseur et la taille de page au format Laravel', async () => {
    const { source, callsTo } = build({ [`GET ${list}`]: { body: quotes.quotesFirstPage } });

    const page = await source.quotes({ statuses: ['submitted', 'received'], interventionId: api.IDS.intervention, supplierPartyId: api.IDS.supplierParty, cursor: 'abc', perPage: 10 });

    expect(Object.fromEntries(callsTo('GET', list)[0]?.search ?? [])).toEqual({
      per_page: '10',
      cursor: 'abc',
      'status[0]': 'submitted',
      'status[1]': 'received',
      intervention_id: api.IDS.intervention,
      supplier_party_id: api.IDS.supplierParty,
    });
    expect(page.nextCursor).toBe('curseur-2');
  });

  it('refuse un statut, un champ obligatoire manquant ou une devise hors contrat', async () => {
    const status = build({ [`GET ${list}`]: { body: { ...quotes.quotesPage, data: [{ ...quotes.quoteSubmitted, status: 'inconnu' }] } } });
    await expect(status.source.quotes({})).rejects.toMatchObject({ kind: 'unexpected_response' });

    const withoutIntervention = Object.fromEntries(Object.entries(quotes.quoteSubmitted).filter(([key]) => key !== 'intervention_id'));
    const missing = build({ [`GET ${list}`]: { body: { ...quotes.quotesPage, data: [withoutIntervention] } } });
    await expect(missing.source.quotes({})).rejects.toMatchObject({ kind: 'unexpected_response' });

    const dollars = build({ [`GET ${list}`]: { body: { ...quotes.quotesPage, data: [{ ...quotes.quoteSubmitted, total_gross: { amount: 1, currency: 'USD' } }] } } });
    await expect(dollars.source.quotes({})).rejects.toMatchObject({ code: 'unsupported_currency' });

    const ceiling = build({ [`GET ${list}`]: { body: { ...quotes.quotesPage, data: [{ ...quotes.quoteSubmitted, approval: { status: 'pending', ceiling_amount: null, decide_before: '2026-11-20T11:01:00+00:00' } }] } } });
    await expect(ceiling.source.quotes({})).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('traduit les erreurs du serveur et de la liaison', async () => {
    const forbidden = build({ [`GET ${list}`]: { status: 403, body: api.problemBody(403, 'forbidden', 'Interdit') } });
    await expect(forbidden.source.quotes({})).rejects.toMatchObject({ kind: 'forbidden', status: 403 });

    const filter = build({ [`GET ${list}`]: { status: 422, body: api.problemBody(422, 'validation_failed', 'Invalide', { intervention_id: ['The intervention id field must be a valid UUID.'] }) } });
    await expect(filter.source.quotes({ interventionId: 'x' })).rejects.toMatchObject({ kind: 'invalid', message: 'L’intervention demandée est invalide.' });

    const cursor = build({ [`GET ${list}`]: { status: 422, body: api.problemBody(422, 'validation_failed', 'Invalide', { cursor: ['Curseur invalide.'] }) } });
    await expect(cursor.source.quotes({ cursor: 'falsifie' })).rejects.toMatchObject({ kind: 'invalid', message: 'La page demandée n’existe plus : revenez à la première page.' });

    const limited = build({ [`GET ${list}`]: { status: 429, body: api.problemBody(429, 'too_many_requests', 'Trop'), headers: { 'Retry-After': '30' } } });
    await expect(limited.source.quotes({})).rejects.toMatchObject({ kind: 'rate_limited' });

    const offline = build({});
    offline.fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(offline.source.quotes({})).rejects.toMatchObject({ name: 'ApiUnreachableError' });
  });
});

describe('prestataires à choisir', () => {
  it('parcourt toutes les pages, dédoublonne par tiers et trie par nom', async () => {
    const [first] = api.suppliersPage.data;
    if (first === undefined) throw new Error('Relevé de prestataires vide.');
    const other = { ...first, id: '01a1ef81-501e-73e9-82a5-f2a1e6dddd49', party: { ...first.party, id: '01a1ef81-4fb6-73dc-ade1-26fdb67f4d35', name: 'Alpha Plomberie' } };
    const { source, callsTo } = build({
      [`GET ${url('/suppliers')}`]: (call) =>
        call.search.get('cursor') === 'p2'
          ? { body: { ...api.suppliersPage, data: [other, first] } }
          : { body: { ...api.suppliersPage, data: [first], meta: { ...api.suppliersPage.meta, next_cursor: 'p2' } } },
    });

    expect(await source.supplierChoices()).toEqual([
      { id: other.party.id, name: 'Alpha Plomberie' },
      { id: first.party.id, name: first.party.name },
    ]);
    expect(callsTo('GET', url('/suppliers'))).toHaveLength(2);
    expect(callsTo('GET', url('/suppliers'))[0]?.search.get('per_page')).toBe('100');
  });
});
