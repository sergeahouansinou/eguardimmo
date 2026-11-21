import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { NO_ORGANIZATION_MESSAGE, TenantAccessApiError, translateApiError, unexpectedResponse } from './accessErrors';

export interface TenantAccessTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  delete: <S extends z.ZodType>(path: string, schema: S) => Promise<z.infer<S>>;
}

export function createTenantAccessTransport(client: ApiClient, organizationId: string | null): TenantAccessTransport {
  const base = (path: string): string => {
    if (organizationId === null) throw new TenantAccessApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}/parties${path}`;
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

  return {
    get: (path, schema, query) => run(schema, () => client.get(base(path), query)),
    post: (path, schema, body) => run(schema, () => client.post(base(path), body)),
    delete: (path, schema) => run(schema, () => client.delete(base(path))),
  };
}
