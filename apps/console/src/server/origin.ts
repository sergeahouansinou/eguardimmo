import { problems } from './problem';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function consoleHost(request: Request): { host: string; protocol: string } {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const forwarded = request.headers.get('x-forwarded-proto');
  return { host, protocol: forwarded ? `${forwarded.split(',')[0]?.trim() ?? ''}:` : url.protocol };
}

function hasConsoleOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const expected = consoleHost(request);
  return parsed.host === expected.host && parsed.protocol === expected.protocol;
}

export function rejectForeignOrigin(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method)) return null;
  return hasConsoleOrigin(request) ? null : problems.forbiddenOrigin();
}
