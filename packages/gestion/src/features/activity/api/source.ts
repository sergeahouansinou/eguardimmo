import type { ApiClient, Query } from '@eguardimmo/api';
import { rangeIssue, subjectIssue } from '../filters';
import { PAGE_SIZE } from '../model';
import type { ActivityFilters } from '../model';
import type { ActivitySource } from '../source';
import { ApiError } from '@eguardimmo/api';
import { OrgApiError, invalidInput, waitLabel } from '../../orgapi/errors';
import { createOrgTransport } from '../../orgapi/transport';
import { translateActivityError } from './errors';
import { toDetail, toEntry } from './mapping';
import { apiEntryDetail, apiEntryPage } from './schemas';

export interface ApiActivitySourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

const CSV_TYPES = ['text/csv'] as const;
const segment = (id: string): string => encodeURIComponent(id);

function filterQuery(filters: ActivityFilters): Query {
  const range = rangeIssue(filters.from, filters.to);
  if (range !== null) throw invalidInput(range);
  const subject = subjectIssue(filters.subjectType, filters.subjectId);
  if (subject !== null) throw invalidInput(subject);
  return { from: filters.from, to: filters.to, actor: filters.actorId, type: filters.type, subject_type: filters.subjectType, subject_id: filters.subjectId };
}

export function createApiActivitySource({ client, organizationId }: ApiActivitySourceOptions, dependencies: { fetchImpl?: typeof fetch } = {}): ActivitySource {
  const transport = createOrgTransport(client, organizationId, translateActivityError, dependencies.fetchImpl);

  return {
    list: async (query) => {
      const page = await transport.get('/activity', apiEntryPage, { ...filterQuery(query), cursor: query.cursor, per_page: PAGE_SIZE });
      return { items: page.data.map(toEntry), nextCursor: page.meta.has_more ? page.meta.next_cursor : null };
    },
    detail: async (id) => toDetail((await transport.get(`/activity/${segment(id)}`, apiEntryDetail)).data),
    exportCsv: async (filters) => {
      try {
        return await transport.blob('/activity/export', CSV_TYPES, filterQuery(filters));
      } catch (error) {
        if (error instanceof OrgApiError && error.kind === 'rate_limited') {
          const wait = error.cause instanceof ApiError ? error.cause.retryAfterSeconds : null;
          throw new OrgApiError('rate_limited', `Limite atteinte : 5 exports par heure au plus. Réessayez ${waitLabel(wait)}.`, { status: error.status ?? 429, code: error.code, cause: error.cause });
        }
        throw error;
      }
    },
  };
}
