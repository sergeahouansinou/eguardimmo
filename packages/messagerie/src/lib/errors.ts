import { ApiError } from '@eguardimmo/api';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds !== null) {
    return `${/[.!?]$/.test(error.message) ? error.message : `${error.message}.`} Réessayez dans ${String(error.retryAfterSeconds)} s.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
