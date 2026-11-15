import { ARREARS, BUILDINGS, LEASE_ENDS, LOTS, OCCUPANCY } from './demoBase';
import { buildExpenses, buildRevenues } from './demoFinance';
import { FORECAST } from './demoForecast';
import type { AnalytiqueData } from './schemas';

export const DEMO_GENERATED_AT = '2026-11-13T14:05:00+01:00';

export function createDemoAnalytiqueData(): AnalytiqueData {
  return {
    generatedAt: DEMO_GENERATED_AT,
    buildings: BUILDINGS,
    lots: LOTS,
    revenues: buildRevenues(),
    expenses: buildExpenses(),
    occupancy: OCCUPANCY,
    arrears: ARREARS,
    leaseEnds: LEASE_ENDS,
    forecast: FORECAST,
  };
}
