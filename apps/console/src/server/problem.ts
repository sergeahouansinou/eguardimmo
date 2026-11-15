const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

interface Problem {
  status: number;
  code: string;
  title: string;
  errors?: Record<string, string[]>;
  retryAfterSeconds?: number;
}

export function noStoreHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return headers;
}

export function problem({ status, code, title, errors, retryAfterSeconds }: Problem, headers: HeadersInit = {}): Response {
  const merged = noStoreHeaders(headers);
  merged.set('Content-Type', 'application/problem+json');
  if (retryAfterSeconds !== undefined) merged.set('Retry-After', String(retryAfterSeconds));
  const body = {
    type: `/problems/${code}`,
    title,
    status,
    code,
    ...(errors ? { errors } : {}),
    ...(retryAfterSeconds === undefined ? {} : { retry_after: retryAfterSeconds }),
  };
  return new Response(JSON.stringify(body), { status, headers: merged });
}

export const problems = {
  forbiddenOrigin: () => problem({ status: 403, code: 'forbidden_origin', title: 'Origine refusée' }),
  unauthenticated: (headers?: HeadersInit) => problem({ status: 401, code: 'unauthenticated', title: 'Non authentifié' }, headers),
  notConfigured: () => problem({ status: 503, code: 'service_unavailable', title: 'Service indisponible' }),
  unreachable: () => problem({ status: 503, code: 'service_unavailable', title: 'Service indisponible' }),
  badGateway: () => problem({ status: 502, code: 'bad_gateway', title: 'Réponse invalide du serveur' }),
  invalidPath: () => problem({ status: 400, code: 'invalid_path', title: 'Chemin invalide' }),
  forbiddenPath: () => problem({ status: 403, code: 'forbidden_path', title: 'Chemin non autorisé' }),
  tooLarge: () => problem({ status: 413, code: 'payload_too_large', title: 'Contenu trop volumineux' }),
};
