import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { MaintenanceApiError, NO_ORGANIZATION_MESSAGE, translateApiError, unexpectedResponse } from './maintenanceErrors';

export interface MaintenanceTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, body?: Body, headers?: Record<string, string>) => Promise<z.infer<S>>;
  patch: <S extends z.ZodType>(path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  download: (path: string) => Promise<Blob>;
}

export function createMaintenanceTransport(client: ApiClient, organizationId: string | null, fetchImpl: typeof fetch = (...args) => fetch(...args)): MaintenanceTransport {
  const base = (path: string): string => {
    if (organizationId === null) throw new MaintenanceApiError('no_organization', NO_ORGANIZATION_MESSAGE);
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

  const download = async (path: string): Promise<Blob> => {
    const url = client.url(base(path));
    let response: Response;
    try {
      response = await fetchImpl(url, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw translateApiError(await toApiError(response));
    return response.blob();
  };

  return {
    get: (path, schema, query) => run(schema, () => client.get(base(path), query)),
    post: (path, schema, body, headers) => run(schema, () => client.post(base(path), body, headers ? { headers } : undefined)),
    patch: (path, schema, body) => run(schema, () => client.patch(base(path), body)),
    download,
  };
}
