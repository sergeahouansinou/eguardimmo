import type { ApiClient } from '@eguardimmo/api';
import { createOrgTransport } from '../../orgapi/transport';
import type { AnalyticsSource } from '../source';
import { translateAnalyticsError } from './errors';
import { toAssumptions, toForecast, toOccupancy, toProfitability, toRevenueExpenses } from './mapping';
import { apiAssumptionsOne, apiForecast, apiOccupancy, apiProfitability, apiRevenueExpenses } from './schemas';

export interface ApiAnalyticsSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

const base = '/reporting';

export function createApiAnalyticsSource({ client, organizationId }: ApiAnalyticsSourceOptions, dependencies: { fetchImpl?: typeof fetch } = {}): AnalyticsSource {
  const transport = createOrgTransport(client, organizationId, translateAnalyticsError, dependencies.fetchImpl);
  return {
    revenueExpenses: async (period) => toRevenueExpenses((await transport.get(`${base}/finance/revenue-expenses`, apiRevenueExpenses, { from: period.from, to: period.to })).data),
    occupancy: async (period) => toOccupancy((await transport.get(`${base}/finance/occupancy`, apiOccupancy, { from: period.from, to: period.to })).data),
    profitability: async (year) => toProfitability((await transport.get(`${base}/finance/profitability`, apiProfitability, { year })).data),
    forecast: async () => toForecast((await transport.get(`${base}/finance/forecast`, apiForecast)).data),
    saveAssumptions: async (input) =>
      toAssumptions(
        (
          await transport.put(`${base}/finance/forecast/assumptions`, apiAssumptionsOne, {
            lock_version: input.lockVersion,
            indexation_rate: input.indexationRate,
            expense_growth_rate: input.expenseGrowthRate,
            vacancies: input.vacancies.map((vacancy) => ({ unit_id: vacancy.unitId, from: vacancy.from, to: vacancy.to })),
            one_off_expenses: input.oneOffExpenses,
          })
        ).data,
      ),
    exportCsv: (request) =>
      transport.blob(`${base}/exports/${request.type}`, ['text/csv'], request.type === 'prets-immobiliers' ? { from: request.from, to: request.to } : { year: request.year }),
  };
}
