import { ApiUnreachableError, toApiError } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Query = Record<string, string | number | boolean | null | undefined>;
export type Body = Record<string, unknown> | FormData;
export interface RequestOptions {
  headers?: Readonly<Record<string, string>>;
}

export interface ApiClient {
  readonly baseUrl: string;
  get: (path: string, query?: Query) => Promise<unknown>;
  post: (path: string, body?: Body, options?: RequestOptions) => Promise<unknown>;
  put: (path: string, body?: Body) => Promise<unknown>;
  patch: (path: string, body?: Body) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
  url: (path: string, query?: Query) => string;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  readCookie?: (name: string) => string | null;
}

const XSRF_COOKIE = 'XSRF-TOKEN';

function documentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function createApiClient({ baseUrl, fetchImpl = (...args) => fetch(...args), readCookie = documentCookie }: ApiClientOptions): ApiClient {
  let csrfReady: Promise<void> | null = null;

  const ensureCsrf = async () => {
    if (readCookie(XSRF_COOKIE)) return;
    csrfReady ??= fetchImpl(buildUrl(baseUrl, '/sanctum/csrf-cookie'), { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(() => undefined)
      .finally(() => {
        csrfReady = null;
      });
    await csrfReady;
  };

  const request = async (method: Method, path: string, body?: Body, query?: Query, options?: RequestOptions): Promise<unknown> => {
    if (method !== 'GET') await ensureCsrf();
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    const token = readCookie(XSRF_COOKIE);
    if (token && method !== 'GET') headers['X-XSRF-TOKEN'] = token;
    Object.assign(headers, options?.headers);
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetchImpl(buildUrl(baseUrl, path, query), { method, headers, body: payload, credentials: 'include' });
    } catch {
      throw new ApiUnreachableError();
    }
    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return null;
    const text = await response.text();
    return text === '' ? null : (JSON.parse(text) as unknown);
  };

  return {
    baseUrl,
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body, options) => request('POST', path, body, undefined, options),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    url: (path, query) => buildUrl(baseUrl, path, query),
  };
}
