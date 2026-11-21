import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { NO_ORGANIZATION_MESSAGE, OrgApiError, unexpectedResponse } from './errors';

export interface OrgTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, options?: { body?: Body; key?: string }) => Promise<z.infer<S>>;
  patch: <S extends z.ZodType>(path: string, schema: S, body: Body) => Promise<z.infer<S>>;
  put: <S extends z.ZodType>(path: string, schema: S, body: Body) => Promise<z.infer<S>>;
  remove: (path: string) => Promise<void>;
  blob: (path: string, accepted: readonly string[], query?: Query) => Promise<Blob>;
}

export function createOrgTransport(client: ApiClient, organizationId: string | null, translate: (error: unknown) => unknown, fetchImpl: typeof fetch = (...args) => fetch(...args)): OrgTransport {
  const base = (path: string): string => {
    if (organizationId === null) throw new OrgApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}${path}`;
  };

  const attempt = async <T>(request: () => Promise<T>): Promise<T> => {
    try {
      return await request();
    } catch (error) {
      throw translate(error);
    }
  };

  const run = async <S extends z.ZodType>(schema: S, request: () => Promise<unknown>): Promise<z.infer<S>> => {
    const payload = await attempt(request);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw unexpectedResponse(parsed.error.issues[0]?.path.join('.'));
    return parsed.data;
  };

  const blob = async (path: string, accepted: readonly string[], query?: Query): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetchImpl(client.url(base(path), query), { credentials: 'include', headers: { Accept: accepted.join(', '), 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw translate(await toApiError(response));
    const type = response.headers.get('Content-Type') ?? '';
    if (!accepted.some((candidate) => type.startsWith(candidate))) throw unexpectedResponse('Content-Type');
    return response.blob();
  };

  return {
    get: (path, schema, query) => run(schema, () => client.get(base(path), query)),
    post: (path, schema, options = {}) => run(schema, () => client.post(base(path), options.body ?? {}, options.key === undefined ? undefined : { headers: { 'Idempotency-Key': options.key } })),
    patch: (path, schema, body) => run(schema, () => client.patch(base(path), body)),
    put: (path, schema, body) => run(schema, () => client.put(base(path), body)),
    remove: async (path) => {
      await attempt(() => client.delete(base(path)));
    },
    blob,
  };
}
