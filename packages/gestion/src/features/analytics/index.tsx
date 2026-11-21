import { ForecastPage } from './ForecastPage';
import { LandlordOnly } from './LandlordOnly';
import { ProfitabilityPage } from './ProfitabilityPage';

export { AnalyticsHubPage } from './AnalyticsHubPage';
export { OccupancyPage } from './OccupancyPage';
export { RevenueExpensesPage } from './RevenueExpensesPage';
export { AnalyticsSourceProvider, useAnalyticsSource } from './source';
export type { AnalyticsSource } from './source';
export { createApiAnalyticsSource } from './api/source';
export { analyticsPaths } from './paths';

export const ProfitabilityScreen = () => (
  <LandlordOnly title="Rentabilité par bien">
    <ProfitabilityPage />
  </LandlordOnly>
);
export const ForecastScreen = () => (
  <LandlordOnly title="Prévisionnel de trésorerie">
    <ForecastPage />
  </LandlordOnly>
);
