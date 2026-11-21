import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { BankingApiError, NO_ORGANIZATION_MESSAGE, translateApiError, unexpectedResponse } from './bankingErrors';

export interface BankingTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query, scope?: 'banking' | 'organization') => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, options?: { body?: Body; key?: string }) => Promise<z.infer<S>>;
  patch: <S extends z.ZodType>(path: string, schema: S, body: Body) => Promise<z.infer<S>>;
  blob: (path: string, accepted: readonly string[]) => Promise<Blob>;
}

export function createBankingTransport(client: ApiClient, organizationId: string | null, fetchImpl: typeof fetch = (...args) => fetch(...args)): BankingTransport {
  const base = (path: string, scope: 'banking' | 'organization' = 'banking'): string => {
    if (organizationId === null) throw new BankingApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}${scope === 'banking' ? '/banking' : ''}${path}`;
  };

  const run = async <S extends z.ZodType>(schema: S, request: () => Promise<unknown>): Promise<z.infer<S>> => {
    let payload: unknown;
    try {
      payload = await request();
    } catch (error) {
      throw translateApiError(error);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw unexpectedResponse(parsed.error.issues[0]?.path.join('.'));
    return parsed.data;
  };

  const blob = async (path: string, accepted: readonly string[]): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetchImpl(client.url(base(path)), { credentials: 'include', headers: { Accept: accepted.join(', '), 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw translateApiError(await toApiError(response));
    const type = response.headers.get('Content-Type') ?? '';
    if (!accepted.some((candidate) => type.startsWith(candidate))) throw unexpectedResponse('Content-Type');
    return response.blob();
  };

  return {
    get: (path, schema, query, scope) => run(schema, () => client.get(base(path, scope), query)),
    post: (path, schema, options = {}) => run(schema, () => client.post(base(path), options.body ?? {}, options.key === undefined ? undefined : { headers: { 'Idempotency-Key': options.key } })),
    patch: (path, schema, body) => run(schema, () => client.patch(base(path), body)),
    blob,
  };
}
