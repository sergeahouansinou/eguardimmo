import { ApiUnreachableError, buildUrl, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body, Query } from '@eguardimmo/api';
import type { z } from 'zod';
import { NO_ORGANIZATION_MESSAGE, ReportingApiError, translateApiError, unexpectedResponse } from './reportingErrors';
import { assertKey } from './reportingPayloads';

export interface ReportingTransport {
  get: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  getOrg: <S extends z.ZodType>(path: string, schema: S, query?: Query) => Promise<z.infer<S>>;
  post: <S extends z.ZodType>(path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  patch: <S extends z.ZodType>(path: string, schema: S, body?: Body) => Promise<z.infer<S>>;
  remove: <S extends z.ZodType>(path: string, schema: S) => Promise<z.infer<S>>;
  postKeyed: <S extends z.ZodType>(path: string, schema: S, key: string, body: Body) => Promise<z.infer<S>>;
  file: (path: string, mime: 'application/pdf' | 'text/csv', query?: Query) => Promise<Blob>;
}

const XSRF_COOKIE = 'XSRF-TOKEN';

function documentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

export function createReportingTransport(
  client: ApiClient,
  organizationId: string | null,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  readCookie: (name: string) => string | null = documentCookie,
): ReportingTransport {
  const orgBase = (path: string): string => {
    if (organizationId === null) throw new ReportingApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}${path}`;
  };
  const base = (path: string): string => orgBase(`/reporting${path}`);

  const parse = <S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw unexpectedResponse(parsed.error.issues[0]?.path.join('.'));
    return parsed.data;
  };

  const run = async <S extends z.ZodType>(schema: S, request: () => Promise<unknown>): Promise<z.infer<S>> => {
    let payload: unknown;
    try {
      payload = await request();
    } catch (error) {
      throw translateApiError(error);
    }
    return parse(schema, payload);
  };

  const file = async (path: string, mime: 'application/pdf' | 'text/csv', query?: Query): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetchImpl(client.url(base(path), query), { credentials: 'include', headers: { Accept: mime, 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw translateApiError(await toApiError(response));
    if (!(response.headers.get('Content-Type') ?? '').startsWith(mime)) throw unexpectedResponse('Content-Type');
    return response.blob();
  };

  const ensureCsrf = async (): Promise<string | null> => {
    if (readCookie(XSRF_COOKIE) === null) await fetchImpl(buildUrl(client.baseUrl, '/sanctum/csrf-cookie'), { credentials: 'include', headers: { Accept: 'application/json' } }).catch(() => undefined);
    return readCookie(XSRF_COOKIE);
  };

  // Le serveur répond par mandant : sur un échec total, le statut est une erreur mais le corps liste le détail de chaque mandant.
  const postKeyed = async <S extends z.ZodType>(path: string, schema: S, key: string, body: Body): Promise<z.infer<S>> => {
    const token = await ensureCsrf();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Idempotency-Key': assertKey(key),
    };
    if (token !== null) headers['X-XSRF-TOKEN'] = token;
    let response: Response;
    try {
      response = await fetchImpl(client.url(base(path)), { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body) });
    } catch {
      throw new ApiUnreachableError();
    }
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text === '' ? null : (JSON.parse(text) as unknown);
    } catch {
      payload = null;
    }
    const parsed = schema.safeParse(payload);
    if (parsed.success) return parsed.data;
    if (!response.ok) throw translateApiError(await toApiError(new Response(text, { status: response.status, headers: response.headers })));
    throw unexpectedResponse(parsed.error.issues[0]?.path.join('.'));
  };

  return {
    get: (path, schema, query) => run(schema, () => client.get(base(path), query)),
    getOrg: (path, schema, query) => run(schema, () => client.get(orgBase(path), query)),
    post: (path, schema, body) => run(schema, () => client.post(base(path), body ?? {})),
    patch: (path, schema, body) => run(schema, () => client.patch(base(path), body ?? {})),
    remove: (path, schema) => run(schema, () => client.delete(base(path))),
    postKeyed,
    file,
  };
}
