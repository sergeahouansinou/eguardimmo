import { isIP } from 'node:net';

export function clientIp(request: Request, trustedHops: number): string | null {
  const entries = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  const candidate = entries[entries.length - trustedHops];
  return candidate !== undefined && isIP(candidate) !== 0 ? candidate : null;
}
