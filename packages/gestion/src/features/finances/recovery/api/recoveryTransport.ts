import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { NO_ORGANIZATION_MESSAGE, RecoveryApiError, translateApiError, unexpectedResponse } from './recoveryErrors';

export interface RecoveryTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  delete: <S extends z.ZodType>(path: string, schema: S) => Promise<z.infer<S>>;
  zip: (path: string) => Promise<Blob>;
}

export function createRecoveryTransport(client: ApiClient, organizationId: string | null, fetchImpl: typeof fetch = (...args) => fetch(...args)): RecoveryTransport {
  const base = (path: string): string => {
    if (organizationId === null) throw new RecoveryApiError('no_organization', NO_ORGANIZATION_MESSAGE);
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

  const zip = async (path: string): Promise<Blob> => {
    const url = client.url(base(path));
    let response: Response;
    try {
      response = await fetchImpl(url, { credentials: 'include', headers: { Accept: 'application/zip', 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw translateApiError(await toApiError(response));
    if (!(response.headers.get('Content-Type') ?? '').startsWith('application/zip')) throw unexpectedResponse('Content-Type');
    return response.blob();
  };

  return {
    get: (path, schema, query) => run(schema, () => client.get(base(path), query)),
    post: (path, schema, body) => run(schema, () => client.post(base(path), body)),
    delete: (path, schema) => run(schema, () => client.delete(base(path))),
    zip,
  };
}
