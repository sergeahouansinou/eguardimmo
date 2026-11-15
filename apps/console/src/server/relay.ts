import { rejectForeignOrigin } from './origin';
import { noStoreHeaders, problems } from './problem';
import { readServerEnv } from './env';
import { clearedSessionCookie, currentSession, readSealedCookie } from './session';
import { callApi } from './upstream';

const PREFIX = '/api/v1/console/';
const SEGMENT = /^[A-Za-z0-9_~-]+(?:\.[A-Za-z0-9_~-]+)*$/;
const MAX_BODY_BYTES = 55 * 1024 * 1024;
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept-language', 'if-match', 'if-none-match'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'retry-after', 'etag'];
const ACTIVE_CONTENT = /html|xml|svg|javascript/i;
const BODYLESS_STATUSES = new Set([204, 205, 304]);

type Target = { path: string } | { response: Response };

function resolveTarget(request: Request): Target {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return { response: problems.invalidPath() };
  const segments = url.pathname.slice(PREFIX.length).split('/');
  if (!segments.every((segment) => SEGMENT.test(segment))) return { response: problems.invalidPath() };
  if (segments[0] === 'auth') return { response: problems.forbiddenPath() };
  return { path: `${PREFIX}${segments.join('/')}${url.search}` };
}

function forwardedHeaders(request: Request, token: string): Headers {
  const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

async function readBody(request: Request): Promise<ArrayBuffer | undefined | Response> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return problems.tooLarge();
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return problems.tooLarge();
  return body.byteLength === 0 ? undefined : body;
}

export async function handleRelay(request: Request): Promise<Response> {
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;
  const env = readServerEnv();
  if (!env) return problems.notConfigured();

  const session = currentSession(request, env.CONSOLE_SESSION_SECRET);
  if (!session) {
    return problems.unauthenticated(readSealedCookie(request) === null ? undefined : { 'Set-Cookie': clearedSessionCookie() });
  }
  const target = resolveTarget(request);
  if ('response' in target) return target.response;
  const body = await readBody(request);
  if (body instanceof Response) return body;

  const upstream = await callApi(env, target.path, { method: request.method, headers: forwardedHeaders(request, session.token), body });
  if (!upstream) return problems.unreachable();
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel();
    return problems.badGateway();
  }

  const headers = noStoreHeaders();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (ACTIVE_CONTENT.test(headers.get('content-type') ?? '')) {
    headers.set('content-type', 'application/octet-stream');
    headers.set('content-disposition', 'attachment');
  }
  if (upstream.status === 401) headers.append('Set-Cookie', clearedSessionCookie());
  return new Response(BODYLESS_STATUSES.has(upstream.status) ? null : upstream.body, { status: upstream.status, headers });
}
