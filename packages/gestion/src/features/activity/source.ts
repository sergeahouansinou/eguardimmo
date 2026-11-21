'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { ActivityDetail, ActivityFilters, ActivityPage, ActivityQuery } from './model';

export interface ActivitySource {
  list: (query: ActivityQuery) => Promise<ActivityPage>;
  detail: (id: string) => Promise<ActivityDetail>;
  exportCsv: (filters: ActivityFilters) => Promise<Blob>;
}

const context = createSourceContext<ActivitySource>('Journal d’activité', () => {
  throw new MissingSourceError('Journal d’activité');
});

export const ActivitySourceProvider = context.SourceProvider;
export const useActivitySource = context.useSource;
