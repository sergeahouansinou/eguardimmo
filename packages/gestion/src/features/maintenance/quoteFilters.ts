import { z } from 'zod';
import { QUOTE_STATUSES } from './model';
import type { QuoteQuery, QuoteStatus } from './model';

export const ALL = 'tous';

const uuid = z.guid();

export const isQuoteStatus = (value: string): value is QuoteStatus => QUOTE_STATUSES.some((status) => status === value);

export function interventionFilterFrom(search: URLSearchParams): string | undefined {
  const parsed = uuid.safeParse(search.get('intervention'));
  return parsed.success ? parsed.data : undefined;
}

export function buildQuoteQuery(filters: { status: string; supplier: string; interventionId: string | undefined }): Omit<QuoteQuery, 'cursor'> {
  return {
    ...(isQuoteStatus(filters.status) ? { statuses: [filters.status] } : {}),
    ...(filters.supplier === ALL ? {} : { supplierPartyId: filters.supplier }),
    ...(filters.interventionId === undefined ? {} : { interventionId: filters.interventionId }),
  };
}
