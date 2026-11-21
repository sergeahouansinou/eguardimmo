import { ApiError } from '@eguardimmo/api';

export class UnexpectedResponseError extends Error {
  constructor() {
    super('Réponse inattendue du serveur. Réessayez dans un instant.');
    this.name = 'UnexpectedResponseError';
  }
}

export type ProblemKind = 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'rate_limited' | 'unreachable' | 'unexpected' | 'unauthenticated';

export interface Problem {
  kind: ProblemKind;
  message: string;
  code: string | null;
  retryAfterSeconds: number | null;
}

const GENERIC = 'La requête a échoué. Réessayez dans un instant.';

function withFullStop(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

export function describeProblem(error: unknown): Problem {
  if (error instanceof ApiError) {
    const base = { code: error.code, retryAfterSeconds: error.retryAfterSeconds };
    if (error.status === 401) return { ...base, kind: 'unauthenticated', message: error.message };
    if (error.status === 403) return { ...base, kind: 'forbidden', message: error.message };
    if (error.status === 404 || error.status === 410) return { ...base, kind: 'not_found', message: error.message };
    if (error.status === 409) return { ...base, kind: 'conflict', message: error.message };
    if (error.status === 422) return { ...base, kind: 'invalid', message: error.firstFieldError() ?? error.message };
    if (error.status === 429) {
      const wait = error.retryAfterSeconds === null ? '' : ` Réessayez dans ${String(error.retryAfterSeconds)} s.`;
      return { ...base, kind: 'rate_limited', message: `${withFullStop(error.message)}${wait}` };
    }
    return { ...base, kind: 'unexpected', message: error.message };
  }
  if (error instanceof Error && error.name === 'ApiUnreachableError') {
    return { kind: 'unreachable', message: error.message, code: null, retryAfterSeconds: null };
  }
  if (error instanceof UnexpectedResponseError) {
    return { kind: 'unexpected', message: error.message, code: null, retryAfterSeconds: null };
  }
  return { kind: 'unexpected', message: GENERIC, code: null, retryAfterSeconds: null };
}

export function problemText(error: unknown): string {
  return describeProblem(error).message;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  return !(error instanceof UnexpectedResponseError);
}
