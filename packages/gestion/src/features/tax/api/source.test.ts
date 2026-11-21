import { describe, expect, it } from 'vitest';
import { OrgApiError } from '../../orgapi/errors';
import { mockOrgApi, orgPath, problem } from '../../orgapi/testing';
import type { MockRoute } from '../../orgapi/testing';
import * as api from './fixtures';
import { createApiTaxSource } from './source';

const url = (path = '') => orgPath(api.IDS.org, `/tax${path}`);
const query = { incomeYear: null, mandantId: null, cursor: null };

function setup(routes: Record<string, MockRoute>) {
  const mock = mockOrgApi(routes);
  const source = createApiTaxSource({ client: mock.client, organizationId: api.IDS.org }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

async function failure(promise: Promise<unknown>): Promise<OrgApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OrgApiError) return error;
    throw error;
  }
  throw new Error('Une erreur était attendue.');
}

describe('source API de la fiscalité', () => {
  it('lit le calcul à la volée : montants en unités mineures, avertissement et mentions du serveur', async () => {
    const { source, calls } = setup({ [`GET ${url('/rental-income/2025')}`]: { body: { data: api.income } } });
    const income = await source.rentalIncome(2025, true);
    expect(income).toMatchObject({ incomeYear: 2025, formVersion: 'fr-2044-2025', provisional: false, householdComplete: false, warning: api.income.warning, mentions: api.income.mentions });
    expect(income.properties[0]?.lines[0]).toMatchObject({ code: '211', status: 'computed', rounded: { amount: 1_200_000, currency: 'EUR' }, exact: { amount: 1_200_037, currency: 'EUR' } });
    expect(income.properties[0]?.coOwners).toEqual([{ shareBp: 5000, nature: 'full' }, { shareBp: 5000, nature: 'full' }]);
    expect(income.micro.allowanceBp).toBe(3000);
    expect(income.deficit).toBeNull();
    expect(calls[0]?.search.get('household_complete')).toBe('1');
  });

  it('n’envoie pas household_complete quand le foyer n’est pas complet', async () => {
    const { source, calls } = setup({ [`GET ${url('/rental-income/2025')}`]: { body: { data: api.income } } });
    await source.rentalIncome(2025, false);
    expect(calls[0]?.search.has('household_complete')).toBe(false);
  });

  it('lit la simulation du déficit seulement quand le serveur la renvoie', async () => {
    const { source } = setup({ [`GET ${url('/rental-income/2025')}`]: { body: { data: api.incomeWithDeficit } } });
    const income = await source.rentalIncome(2025, true);
    expect(income.deficit?.imputableOnGlobalIncome.amount).toBe(-1_000_000);
  });

  it('lit les blocages du calcul', async () => {
    const { source } = setup({ [`GET ${url('/rental-income/2025')}`]: { body: { data: api.incomeWithBlocker } } });
    expect((await source.rentalIncome(2025, false)).blockers).toEqual([{ code: 'interest_source_conflict', propertyId: api.IDS.property }]);
  });

  it('liste les synthèses avec leurs totaux et le curseur suivant', async () => {
    const { source } = setup({ [`GET ${url('/summaries')}`]: { body: api.page([api.summaryListRow], 'suite') } });
    const page = await source.summaries(query);
    expect(page.nextCursor).toBe('suite');
    expect(page.items[0]).toMatchObject({ id: api.IDS.summary, status: 'final', hasPdf: true, lockVersion: 1, income: null });
    expect(page.items[0]?.totals).toEqual([{ code: '215', amount: { amount: 1_200_000, currency: 'EUR' } }, { code: '263', amount: { amount: 410_000, currency: 'EUR' } }]);
  });

  it('transmet année, mandant et curseur sans filtre vide', async () => {
    const { source, calls } = setup({ [`GET ${url('/mandant-statements')}`]: { body: api.page([api.statementListRow]) } });
    await source.statements({ incomeYear: 2025, mandantId: api.IDS.mandant, cursor: 'abc' });
    expect(Object.fromEntries(calls[0]?.search.entries() ?? [])).toEqual({ income_year: '2025', mandant: api.IDS.mandant, cursor: 'abc' });
    await source.statements(query);
    expect([...(calls[1]?.search.keys() ?? [])]).toEqual([]);
  });

  it('fige une synthèse avec une clé d’idempotence', async () => {
    const { source, callsTo } = setup({ [`POST ${url('/summaries')}`]: { status: 201, body: { data: api.summaryDetail } } });
    const created = await source.createSummary({ incomeYear: 2025, householdComplete: true }, 'ui-cle-1234');
    expect(created.income?.incomeYear).toBe(2025);
    const call = callsTo('POST', url('/summaries'))[0];
    expect(call?.body).toEqual({ income_year: 2025, household_complete: true });
    expect(call?.headers.get('Idempotency-Key')).toBe('ui-cle-1234');
  });

  it('rectifie avec motif, version lue et clé d’idempotence', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/summaries/${api.IDS.summary}/rectify`)}`]: { status: 201, body: { data: { ...api.summaryDetail, id: api.IDS.summaryTwo, rectification_reason: 'Facture ajoutée' } } } });
    const created = await source.rectifySummary(api.IDS.summary, { reason: 'Facture ajoutée', lockVersion: 1 }, 'ui-cle-5678');
    expect(created.rectificationReason).toBe('Facture ajoutée');
    const call = callsTo('POST', url(`/summaries/${api.IDS.summary}/rectify`))[0];
    expect(call?.body).toEqual({ reason: 'Facture ajoutée', lock_version: 1 });
    expect(call?.headers.get('Idempotency-Key')).toBe('ui-cle-5678');
  });

  it('télécharge le PDF et le CSV par le flux authentifié, avec contrôle du type', async () => {
    const { source } = setup({
      [`GET ${url(`/summaries/${api.IDS.summary}/pdf`)}`]: { file: { type: 'application/pdf', content: '%PDF' } },
      [`GET ${url(`/summaries/${api.IDS.summary}/lines.csv`)}`]: { csv: 'code;montant\n215;12000' },
      [`GET ${url(`/mandant-statements/${api.IDS.statement}/pdf`)}`]: { file: { type: 'text/html', content: '<html>' } },
    });
    expect((await source.summaryPdf(api.IDS.summary)).type).toBe('application/pdf');
    expect((await source.summaryCsv(api.IDS.summary)).type).toContain('text/csv');
    expect((await failure(source.statementPdf(api.IDS.statement))).kind).toBe('unexpected_response');
  });

  it('génère des relevés et expose le détail par mandant, échec compris', async () => {
    const { source, callsTo } = setup({ [`POST ${url('/mandant-statements')}`]: { status: 201, body: api.generation } });
    const results = await source.generateStatements({ incomeYear: 2025, mandantIds: [api.IDS.mandant, api.IDS.mandantTwo] }, 'ui-cle-9999');
    expect(results[0]).toMatchObject({ mandantId: api.IDS.mandant, outcome: 'created' });
    expect(results[0]?.statement?.scope).toBe('mandant');
    expect(results[1]).toMatchObject({ outcome: 'failed', error: { code: 'tax_period_not_closed', status: 409 } });
    expect(callsTo('POST', url('/mandant-statements'))[0]?.body).toEqual({ income_year: 2025, mandant_ids: [api.IDS.mandant, api.IDS.mandantTwo] });
  });

  it('lit le détail par mandant même quand tous les relevés échouent (statut HTTP d’erreur)', async () => {
    const allFailed = { data: [api.generation.data[1]] };
    const { source } = setup({ [`POST ${url('/mandant-statements')}`]: { status: 409, body: allFailed } });
    const results = await source.generateStatements({ incomeYear: 2025, mandantIds: [api.IDS.mandantTwo] }, 'ui-cle-9999');
    expect(results).toHaveLength(1);
    expect(results[0]?.error?.code).toBe('tax_period_not_closed');
  });

  it('publie avec la version lue', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/mandant-statements/${api.IDS.statement}/publish`)}`]: { body: { data: { ...api.statementDetail, status: 'published', published_at: '2026-03-12T10:00:00+00:00' } } } });
    const published = await source.publishStatement(api.IDS.statement, 1);
    expect(published.status).toBe('published');
    expect(callsTo('POST', url(`/mandant-statements/${api.IDS.statement}/publish`))[0]?.body).toEqual({ lock_version: 1 });
  });

  it('liste les mandants de l’agence', async () => {
    const { source } = setup({ [`GET ${orgPath(api.IDS.org, '/mandates/mandants')}`]: { body: api.mandants } });
    expect(await source.mandants()).toEqual([{ partyId: api.IDS.mandant, name: 'Entreprise Dubois' }, { partyId: api.IDS.mandantTwo, name: 'Famille Kouassi' }]);
  });

  it.each([
    [401, 'unauthenticated', 'unauthenticated'],
    [403, 'tax_landlord_only', 'forbidden'],
    [403, 'two_factor_required', 'two_factor_required'],
    [404, 'tax_summary_not_found', 'not_found'],
    [409, 'tax_summary_stale_version', 'stale'],
    [409, 'tax_summary_exists', 'conflict'],
    [409, 'tax_period_not_closed', 'conflict'],
    [409, 'tax_summary_not_rectifiable', 'conflict'],
    [422, 'tax_year_unsupported', 'invalid'],
    [422, 'tax_batch_too_large', 'invalid'],
    [503, 'tax_batch_time_exceeded', 'unavailable'],
    [429, 'too_many_requests', 'rate_limited'],
    [503, 'tax_pdf_unavailable', 'unavailable'],
  ])('traduit l’erreur %i %s en %s', async (status, code, kind) => {
    const { source } = setup({ [`GET ${url(`/summaries/${api.IDS.summary}`)}`]: problem(status, code, 'Message du serveur') });
    const error = await failure(source.summary(api.IDS.summary));
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
  });

  it('refuse un statut de ligne inconnu', async () => {
    const bad = { ...api.income, totals: [{ ...api.income.totals[0], status: 'invented' }] };
    const { source } = setup({ [`GET ${url('/rental-income/2025')}`]: { body: { data: bad } } });
    expect((await failure(source.rentalIncome(2025, false))).kind).toBe('unexpected_response');
  });
});
