import { ApiUnreachableError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { OwnerFundsApiError } from '../api/ownerFundsErrors';
import { createApiOwnerFundsSource } from '../api/ownerFundsSource';
import { IDS } from '../api/responses.fixtures';
import { mockOwnerFundsApi, orgPath } from '../api/testing';
import type { MockRoute } from '../api/testing';
import { at } from '../../../../../test/lots';
import { SIM_IDS, mandatesEmpty, mandatesPage, problemAmountTooHigh, problemFeeBaseMissing, problemMandateNotFound, problemRateLimited, simulation, simulationEmpty, simulationWithoutCurrent } from './fixtures';
import type { FeeProposal } from './model';

const SIMULATE = orgPath(IDS.org, '/owner-funds/fees/simulations');
const MANDATES = orgPath(IDS.org, '/mandates');
const proposal: FeeProposal = { mandateId: SIM_IDS.mandateA, kind: 'percentage', basisPoints: 750, flatAmount: null, base: 'rent', minimumAmount: 5000, taxMode: 'excl_tax', months: 3 };

function build(routes: Record<string, MockRoute>) {
  const mock = mockOwnerFundsApi(routes);
  const source = createApiOwnerFundsSource({ client: mock.client, organizationId: IDS.org, role: 'manager', kind: 'agency' }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

const rejection = async (run: Promise<unknown>): Promise<OwnerFundsApiError> => {
  try {
    await run;
  } catch (error) {
    if (error instanceof OwnerFundsApiError) return error;
    throw error;
  }
  throw new Error('Une erreur était attendue.');
};

describe('simulation des honoraires', () => {
  it('poste la proposition sans clé d’idempotence et traduit la réponse du serveur', async () => {
    const { source, callsTo } = build({ [`POST ${SIMULATE}`]: { body: simulation } });
    const result = await source.simulateFees(proposal);
    const call = callsTo('POST', SIMULATE)[0];
    expect(call?.body).toEqual({ mandate_id: SIM_IDS.mandateA, fee_kind: 'percentage', fee_basis_points: 750, fee_base: 'rent', fee_minimum_amount: 5000, fee_tax_mode: 'excl_tax', months: 3 });
    expect(call?.headers.has('Idempotency-Key')).toBe(false);
    expect(result.currency).toBe('EUR');
    expect(result.monthsReturned).toBe(3);
    expect(result.months.map((line) => line.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result.months[0]).toMatchObject({ baseRent: { amount: 120000 }, current: { source: 'statement', feeTotal: { amount: 11520 } }, simulated: { feeTotal: { amount: 10800 } }, difference: { feeTotal: { amount: -720 } } });
    expect(result.months[2]?.simulated.minimumApplied).toBe(true);
    expect(result.totals).toMatchObject({ simulatedTotal: { amount: 27600 }, currentTotal: { amount: 26880 }, differenceTotal: { amount: 720 } });
  });

  it('garde les honoraires actuels et l’écart à null quand le barème en vigueur n’a pas de base', async () => {
    const { source } = build({ [`POST ${SIMULATE}`]: { body: simulationWithoutCurrent } });
    const result = await source.simulateFees(proposal);
    expect(result.months[0]).toMatchObject({ current: null, difference: null });
    expect(result.totals).toMatchObject({ currentNet: null, currentTotal: null, differenceNet: null, differenceTotal: null });
  });

  it('signale l’absence de mois clos', async () => {
    const { source } = build({ [`POST ${SIMULATE}`]: { body: simulationEmpty } });
    const result = await source.simulateFees(proposal);
    expect(result).toMatchObject({ months: [], noClosedPeriod: true, totals: null, monthsReturned: 0 });
  });

  it('refuse sans appel une proposition invalide', async () => {
    const { source, calls } = build({});
    await expect(source.simulateFees({ ...proposal, months: 13 })).rejects.toBeInstanceOf(OwnerFundsApiError);
    expect(calls).toHaveLength(0);
  });

  it('traduit un mandat introuvable (404)', async () => {
    const { source } = build({ [`POST ${SIMULATE}`]: { status: 404, body: problemMandateNotFound } });
    const error = await rejection(source.simulateFees(proposal));
    expect(error).toMatchObject({ kind: 'not_found', code: 'owner_funds_mandate_not_found', status: 404 });
    expect(error.message).toContain('Ce mandat n’existe pas');
  });

  it('traduit une base manquante (422 fee_base_missing)', async () => {
    const { source } = build({ [`POST ${SIMULATE}`]: { status: 422, body: problemFeeBaseMissing } });
    expect(await rejection(source.simulateFees(proposal))).toMatchObject({ kind: 'invalid', code: 'fee_base_missing', status: 422 });
  });

  it('conserve les erreurs par champ d’un 422 (plafond de montant)', async () => {
    const { source } = build({ [`POST ${SIMULATE}`]: { status: 422, body: problemAmountTooHigh } });
    const error = await rejection(source.simulateFees({ ...proposal, kind: 'flat', basisPoints: null, flatAmount: 90_000_000_000 }));
    expect(error.kind).toBe('invalid');
    expect(Object.keys(error.fieldErrors)).toEqual(['fee_flat_amount']);
  });

  it('traduit la limite de débit (429) avec le délai', async () => {
    const { source } = build({ [`POST ${SIMULATE}`]: { status: 429, body: problemRateLimited, headers: { 'Retry-After': '30' } } });
    const error = await rejection(source.simulateFees(proposal));
    expect(error.kind).toBe('rate_limited');
    expect(error.message).toContain('dans 30 secondes');
  });

  it('laisse passer une panne réseau', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: () => Promise.reject(new TypeError('offline')), readCookie: () => 'xsrf' });
    const source = createApiOwnerFundsSource({ client, organizationId: IDS.org, role: 'owner', kind: 'agency' });
    await expect(source.simulateFees(proposal)).rejects.toBeInstanceOf(ApiUnreachableError);
  });

  it.each([
    ['des mois sans motif ni totaux', { ...simulation, meta: { ...simulation.meta, totals: null } }],
    ['un motif « aucun mois clos » avec des lignes', { ...simulation, meta: { ...simulation.meta, reason: 'no_closed_period' } }],
    ['un décompte de mois faux', { ...simulation, meta: { ...simulation.meta, months_returned: 2 } }],
    ['une devise inconnue', { ...simulation, meta: { ...simulation.meta, currency: 'USD' } }],
    ['un montant décimal', { ...simulation, data: [{ ...at(simulation.data, 0), base_rent: { amount: 1200.5, currency: 'EUR' } }, ...simulation.data.slice(1)] }],
  ])('rejette une réponse incohérente : %s', async (_label, body) => {
    const { source } = build({ [`POST ${SIMULATE}`]: { body } });
    expect(await rejection(source.simulateFees(proposal))).toMatchObject({ kind: 'unexpected_response' });
  });
});

describe('mandats simulables', () => {
  it('liste les mandats actifs et traduit le barème en vigueur', async () => {
    const { source, callsTo } = build({ [`GET ${MANDATES}`]: { body: mandatesPage() } });
    const options = await source.feeMandates();
    expect(callsTo('GET', MANDATES)[0]?.search.get('status')).toBe('active');
    expect(options.map((option) => option.reference)).toEqual(['M-2026-0001', 'M-2026-0002', 'M-2026-0003']);
    expect(options[0]).toMatchObject({ mandantName: 'Awa Diallo', currency: 'EUR', terms: { kind: 'percentage', basisPoints: 800, base: 'rent', minimumAmount: 0, taxMode: 'excl_tax' } });
    expect(options[1]).toMatchObject({ currency: 'XOF', terms: { kind: 'flat', flatAmount: 50000, minimumAmount: 25000, taxMode: 'incl_tax' } });
    expect(options[2]?.terms).toBeNull();
  });

  it('suit le curseur jusqu’à la dernière page', async () => {
    const { source, callsTo } = build({
      [`GET ${MANDATES}`]: (call) => ({ body: call.search.get('cursor') === 'page-2' ? mandatesEmpty : mandatesPage('page-2') }),
    });
    const options = await source.feeMandates();
    expect(options).toHaveLength(3);
    expect(callsTo('GET', MANDATES).map((call) => call.search.get('cursor'))).toEqual([null, 'page-2']);
  });

  it('masque le nom d’un mandant anonymisé', async () => {
    const page = mandatesPage(null, [{ ...at(mandatesPage().data, 0), mandant: { id: IDS.mandantA, display_name: 'Awa Diallo', kind: 'person', is_anonymized: true } }]);
    const { source } = build({ [`GET ${MANDATES}`]: { body: page } });
    expect((await source.feeMandates())[0]?.mandantName).toBe('Mandant anonymisé');
  });

  it('refuse une réponse dont le barème a une base inconnue', async () => {
    const first = mandatesPage().data[0] as { terms: Record<string, unknown> };
    const { source } = build({ [`GET ${MANDATES}`]: { body: mandatesPage(null, [{ ...first, terms: { ...first.terms, fee_base: 'encaisses' } }]) } });
    expect(await rejection(source.feeMandates())).toMatchObject({ kind: 'unexpected_response' });
  });
});
