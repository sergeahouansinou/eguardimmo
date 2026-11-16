import { z } from 'zod';
import { rejectForeignOrigin } from './origin';
import { noStoreHeaders, problem, problems } from './problem';
import { callApi, upstreamHeaders } from './upstream';
import { readBoundedBody } from './body';
import { readServerEnv } from './env';
import type { ServerEnv } from './env';
import { clearedSessionCookie, currentSession, sealSession, sessionCookie } from './session';

const MAX_BODY_BYTES = 4096;
const FIELDS = ['email', 'password', 'code', 'recovery_code'] as const;
const DEFAULT_RETRY_SECONDS = 900;
const MAX_RETRY_SECONDS = 86_400;

const credentialsSchema = z
  .object({
    email: z.string().min(1).max(255),
    password: z.string().min(1).max(255),
    code: z.string().min(1).max(10).optional(),
    recovery_code: z.string().min(1).max(64).optional(),
  })
  .refine((value) => value.code !== undefined || value.recovery_code !== undefined, { path: ['code'], message: 'required' });

const tokenResponseSchema = z.object({ data: z.object({ token: z.string().min(1) }) });

const INVALID_MESSAGE = 'Identifiants ou code invalides.';

function invalidCredentials(fields: readonly string[] = ['email']): Response {
  const errors: Record<string, string[]> = {};
  for (const field of fields) errors[field] = [INVALID_MESSAGE];
  return problem({ status: 422, code: 'validation_failed', title: 'Données invalides', errors });
}

async function readCredentials(request: Request): Promise<z.infer<typeof credentialsSchema> | Response> {
  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (body === null) return problems.tooLarge();
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return problem({ status: 400, code: 'bad_request', title: 'Requête invalide' });
  }
  const parsed = credentialsSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'email')));
  return invalidCredentials(FIELDS.filter((field) => fields.has(field)));
}

function retryAfter(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), MAX_RETRY_SECONDS) : DEFAULT_RETRY_SECONDS;
}

function grant(env: ServerEnv, token: string): Response {
  const maxAge = env.CONSOLE_TOKEN_TTL_MINUTES * 60;
  const sealed = sealSession({ token, expiresAt: Date.now() + maxAge * 1000 }, env.CONSOLE_SESSION_SECRET);
  return new Response(null, { status: 204, headers: noStoreHeaders({ 'Set-Cookie': sessionCookie(sealed, maxAge) }) });
}

export async function handleLogin(request: Request): Promise<Response> {
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;
  const env = readServerEnv();
  if (!env) return problems.notConfigured();
  const credentials = await readCredentials(request);
  if (credentials instanceof Response) return credentials;

  const upstream = await callApi(env, '/api/v1/console/auth/token', {
    method: 'POST',
    headers: upstreamHeaders(env, request, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(credentials),
  });
  if (!upstream) return problems.unreachable();

  if (upstream.status === 201) {
    const payload = tokenResponseSchema.safeParse(await upstream.json().catch(() => null));
    return payload.success ? grant(env, payload.data.data.token) : problems.badGateway();
  }
  await upstream.body?.cancel();
  if (upstream.status === 422) return invalidCredentials();
  if (upstream.status === 429) {
    const seconds = retryAfter(upstream);
    return problem({ status: 429, code: 'too_many_requests', title: 'Trop de tentatives', retryAfterSeconds: seconds });
  }
  return problems.badGateway();
}

export async function handleLogout(request: Request): Promise<Response> {
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;
  const cleared = { 'Set-Cookie': clearedSessionCookie() };
  const env = readServerEnv();
  if (!env) return problem({ status: 503, code: 'service_unavailable', title: 'Service indisponible' }, cleared);
  const session = currentSession(request, env.CONSOLE_SESSION_SECRET);
  if (!session) return new Response(null, { status: 204, headers: noStoreHeaders(cleared) });

  const upstream = await callApi(env, '/api/v1/console/auth/token', {
    method: 'DELETE',
    headers: upstreamHeaders(env, request, { Authorization: `Bearer ${session.token}` }),
  });
  if (upstream) await upstream.body?.cancel();
  if (upstream && (upstream.ok || upstream.status === 401)) return new Response(null, { status: 204, headers: noStoreHeaders(cleared) });
  return problem({ status: 502, code: 'revocation_failed', title: 'La session n’a pas pu être révoquée côté serveur' }, cleared);
}
