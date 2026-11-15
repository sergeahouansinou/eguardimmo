import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const SESSION_COOKIE = '__Host-console_session';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = 'aes-256-gcm';
const AAD = Buffer.from(SESSION_COOKIE);

const payloadSchema = z.object({ token: z.string().min(1), expiresAt: z.number().int().positive() });

export interface ConsoleSession {
  token: string;
  expiresAt: number;
}

export function sealSession(session: ConsoleSession, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function openSession(sealed: string, key: Buffer, now: number = Date.now()): ConsoleSession | null {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, IV_BYTES), { authTagLength: TAG_BYTES });
    decipher.setAAD(AAD);
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const clear = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
    const payload = payloadSchema.safeParse(JSON.parse(clear));
    return payload.success && payload.data.expiresAt > now ? payload.data : null;
  } catch {
    return null;
  }
}

export function readSealedCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === SESSION_COOKIE) return part.slice(separator + 1).trim();
  }
  return null;
}

export function currentSession(request: Request, key: Buffer, now: number = Date.now()): ConsoleSession | null {
  const sealed = readSealedCookie(request);
  return sealed === null ? null : openSession(sealed, key, now);
}

const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Strict';

export function sessionCookie(sealed: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${sealed}; Max-Age=${String(maxAgeSeconds)}; ${ATTRIBUTES}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${ATTRIBUTES}`;
}
