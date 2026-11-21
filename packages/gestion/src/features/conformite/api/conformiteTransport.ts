import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { ACCEPTED_MIME_TYPES } from '../files';
import type { DownloadedFile } from '../model';
import { ConformiteApiError, NO_ORGANIZATION_MESSAGE, translateApiError, unexpectedResponse } from './conformiteErrors';

export interface ConformiteTransport {
  get: <S extends z.ZodType>(scope: Scope, path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(scope: Scope, path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  file: (path: string) => Promise<DownloadedFile>;
}

export type Scope = 'documents' | 'catalog';

export function createConformiteTransport(client: ApiClient, organizationId: string | null, fetchImpl: typeof fetch = (...args) => fetch(...args)): ConformiteTransport {
  const base = (scope: Scope, path: string): string => {
    if (organizationId === null) throw new ConformiteApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}/${scope}${path}`;
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

  const file = async (path: string): Promise<DownloadedFile> => {
    const url = client.url(base('documents', path));
    let response: Response;
    try {
      response = await fetchImpl(url, { credentials: 'include', headers: { Accept: ACCEPTED_MIME_TYPES.join(', '), 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw translateApiError(await toApiError(response));
    const mimeType = (response.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!ACCEPTED_MIME_TYPES.includes(mimeType)) throw unexpectedResponse('Content-Type');
    return { blob: await response.blob(), mimeType };
  };

  return {
    get: (scope, path, schema, query) => run(schema, () => client.get(base(scope, path), query)),
    post: (scope, path, schema, body) => run(schema, () => client.post(base(scope, path), body)),
    file,
  };
}
