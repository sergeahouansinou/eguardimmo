import { describe, expect, it } from 'vitest';
import { OrgApiError } from '../../orgapi/errors';
import { mockOrgApi, orgPath, problem } from '../../orgapi/testing';
import type { MockRoute } from '../../orgapi/testing';
import * as api from './fixtures';
import { createApiAnalyticsSource } from './source';

const url = (path = '') => orgPath(api.IDS.org, `/reporting${path}`);
const period = { from: '2026-10-01', to: '2026-11-30' };
const input = { indexationRate: '2.000', expenseGrowthRate: '2.000', vacancies: [], oneOffExpenses: [{ month: '2027-03', label: 'Ravalement', amount: 300_000 }], lockVersion: 3 };

function setup(routes: Record<string, MockRoute>) {
  const mock = mockOrgApi(routes);
  const source = createApiAnalyticsSource({ client: mock.client, organizationId: api.IDS.org }, { fetchImpl: mock.fetchImpl });
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

describe('source API de l’analytique', () => {
  it('lit revenus et dépenses : période en Y-m-d, montants en unités mineures', async () => {
    const { source, calls } = setup({ [`GET ${url('/finance/revenue-expenses')}`]: { body: api.revenueExpenses } });
    const data = await source.revenueExpenses(period);
    expect(calls[0]?.search.get('from')).toBe('2026-10-01');
    expect(calls[0]?.search.get('to')).toBe('2026-11-30');
    expect(data.totals.netAfterFinancing).toEqual({ amount: 78_000, currency: 'EUR' });
    expect(data.months[0]).toMatchObject({ month: '2026-10', netAfterFinancing: { amount: 34_000 }, revenue: { rent: { amount: 80_000 } } });
    expect(data.units[1]).toMatchObject({ unitId: null, unitReference: null });
  });

  it('lit l’occupation et garde le taux null distinct de zéro', async () => {
    const { source } = setup({ [`GET ${url('/finance/occupancy')}`]: { body: api.occupancy } });
    const data = await source.occupancy(period);
    expect(data.units[0]?.months[1]).toEqual({ month: '2026-11', state: 'vacant', occupiedDays: 0, days: 30 });
    expect(data.summary[1]?.occupancyRateBp).toBe(0);
  });

  it('lit la rentabilité de l’année avec la raison de non-calcul', async () => {
    const { source, calls } = setup({ [`GET ${url('/finance/profitability')}`]: { body: api.profitability } });
    const data = await source.profitability(2026);
    expect(calls[0]?.search.get('year')).toBe('2026');
    expect(data.rows[0]).toMatchObject({ grossBp: 480, netBp: 420, netAfterFinancingBp: 264, reason: null });
    expect(data.rows[1]).toMatchObject({ cost: null, grossBp: null, reason: 'cost_missing' });
    expect(data.warnings[0]).toMatchObject({ code: 'unattributed_expenses', propertyId: null });
  });

  it('lit le prévisionnel et ses hypothèses', async () => {
    const { source } = setup({ [`GET ${url('/finance/forecast')}`]: { body: api.forecast } });
    const data = await source.forecast();
    expect(data.opening).toEqual({ asOf: '2026-11-21', amount: { amount: 1_000_000, currency: 'EUR' } });
    expect(data.months[1]?.outflows.oneOff).toEqual({ amount: 0, currency: 'EUR' });
    expect(data.assumptions).toMatchObject({ indexationRate: '1.500', lockVersion: 3 });
    expect(data.warnings).toEqual([{ code: 'foreign_currency_leases_ignored', count: 2 }]);
  });

  it('enregistre les hypothèses avec lock_version et montants en unités mineures', async () => {
    const { source, calls } = setup({ [`PUT ${url('/finance/forecast/assumptions')}`]: { body: api.assumptionsSaved } });
    const saved = await source.saveAssumptions(input);
    expect(calls[0]?.body).toEqual({
      lock_version: 3,
      indexation_rate: '2.000',
      expense_growth_rate: '2.000',
      vacancies: [],
      one_off_expenses: [{ month: '2027-03', label: 'Ravalement', amount: 300_000 }],
    });
    expect(saved.lockVersion).toBe(4);
  });

  it('exporte les prêts par période et la rentabilité par année, en CSV', async () => {
    const { source, calls } = setup({
      [`GET ${url('/exports/prets-immobiliers')}`]: { csv: 'a;b' },
      [`GET ${url('/exports/rentabilite-par-bien')}`]: { csv: 'c;d' },
    });
    const loans = await source.exportCsv({ type: 'prets-immobiliers', ...period });
    expect(await loans.text()).toBe('a;b');
    expect(calls[0]?.search.get('from')).toBe('2026-10-01');
    expect(calls[0]?.search.has('year')).toBe(false);
    await source.exportCsv({ type: 'rentabilite-par-bien', year: 2026 });
    expect(calls[1]?.search.get('year')).toBe('2026');
    expect(calls[1]?.search.has('from')).toBe(false);
  });

  it('refuse une réponse qui ne respecte pas le contrat', async () => {
    const { source } = setup({ [`GET ${url('/finance/occupancy')}`]: { body: { data: { ...api.occupancy.data, months: [202610] } } } });
    expect((await failure(source.occupancy(period))).kind).toBe('unexpected_response');
  });

  describe('erreurs du serveur', () => {
    const cases: [number, string, string][] = [
      [401, 'unauthenticated', 'unauthenticated'],
      [403, 'reporting_landlord_only', 'forbidden'],
      [404, 'not_found', 'not_found'],
      [422, 'finance_too_large', 'invalid'],
      [429, 'throttled', 'rate_limited'],
    ];
    it.each(cases)('lecture %i %s → %s', async (status, code, kind) => {
      const { source } = setup({ [`GET ${url('/finance/revenue-expenses')}`]: problem(status, code) });
      expect((await failure(source.revenueExpenses(period))).kind).toBe(kind);
    });

    it('traduit le code réservé aux bailleurs autonomes', async () => {
      const { source } = setup({ [`GET ${url('/finance/forecast')}`]: problem(403, 'reporting_landlord_only') });
      expect((await failure(source.forecast())).message).toContain('réservé aux bailleurs autonomes');
    });

    it('409 forecast_assumptions_stale → stale', async () => {
      const { source } = setup({ [`PUT ${url('/finance/forecast/assumptions')}`]: problem(409, 'forecast_assumptions_stale') });
      expect((await failure(source.saveAssumptions(input))).kind).toBe('stale');
    });

    it('422 validation sur les hypothèses → invalid', async () => {
      const { source } = setup({ [`PUT ${url('/finance/forecast/assumptions')}`]: problem(422, 'validation_failed', 'Le taux dépasse 10 %.') });
      const error = await failure(source.saveAssumptions(input));
      expect(error.kind).toBe('invalid');
      expect(error.message).toContain('10 %');
    });

    it('422 sur l’export au-delà de 36 mois → invalid', async () => {
      const { source } = setup({ [`GET ${url('/exports/prets-immobiliers')}`]: problem(422, 'validation_failed', 'La période dépasse 36 mois.') });
      expect((await failure(source.exportCsv({ type: 'prets-immobiliers', ...period }))).kind).toBe('invalid');
    });

    it('429 sur l’export → rate_limited', async () => {
      const { source } = setup({ [`GET ${url('/exports/rentabilite-par-bien')}`]: problem(429, 'throttled') });
      expect((await failure(source.exportCsv({ type: 'rentabilite-par-bien', year: 2026 }))).kind).toBe('rate_limited');
    });
  });
});
