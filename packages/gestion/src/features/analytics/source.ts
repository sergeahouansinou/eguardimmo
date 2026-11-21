'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { AssumptionsInput, ExportRequest, Forecast, ForecastAssumptions, Occupancy, Period, Profitability, RevenueExpenses } from './model';

export interface AnalyticsSource {
  revenueExpenses: (period: Period) => Promise<RevenueExpenses>;
  occupancy: (period: Period) => Promise<Occupancy>;
  profitability: (year: number) => Promise<Profitability>;
  forecast: () => Promise<Forecast>;
  saveAssumptions: (input: AssumptionsInput) => Promise<ForecastAssumptions>;
  exportCsv: (request: ExportRequest) => Promise<Blob>;
}

const context = createSourceContext<AnalyticsSource>('Analytique', () => {
  throw new MissingSourceError('Analytique');
});

export const AnalyticsSourceProvider = context.SourceProvider;
export const useAnalyticsSource = context.useSource;
