import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { NO_ORGANIZATION_MESSAGE, TenantRequestsError, translateApiError, unexpectedResponse } from './errors';

export interface TenantRequestsTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  patch: <S extends z.ZodType>(path: string, schema: S, body: Body) => Promise<z.infer<S>>;
  blob: (path: string, accepted: readonly string[]) => Promise<Blob>;
}

export function createTransport(client: ApiClient, organizationId: string | null, fetchImpl: typeof fetch = (...args) => fetch(...args)): TenantRequestsTransport {
  const base = (path: string): string => {
    if (organizationId === null) throw new TenantRequestsError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}${path}`;
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
    get: (path, schema, query) => run(schema, () => client.get(base(path), query)),
    post: (path, schema, body = {}) => run(schema, () => client.post(base(path), body)),
    patch: (path, schema, body) => run(schema, () => client.patch(base(path), body)),
    blob,
  };
}
