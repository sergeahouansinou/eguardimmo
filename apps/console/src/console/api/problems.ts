import { ApiError } from '@eguardimmo/api';
import { ConsoleError } from '../schemas';

export async function translated<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) throw new ConsoleError('not_found', error.message, { cause: error });
      if (error.status === 403) throw new ConsoleError('forbidden', error.message, { cause: error });
      if (error.status === 409) throw new ConsoleError('conflict', error.message, { cause: error });
      if (error.status === 422) throw new ConsoleError('invalid', error.firstFieldError() ?? error.message, { cause: error });
    }
    throw error;
  }
}

function withFullStop(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

export function problemMessage(error: unknown): string {
  if (error instanceof ConsoleError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 429 && error.retryAfterSeconds !== null) return `${withFullStop(error.message)} Réessayez dans ${String(error.retryAfterSeconds)} s.`;
    return error.message;
  }
  if (error instanceof Error && error.name === 'ApiUnreachableError') return error.message;
  return 'La requête a échoué. Réessayez dans un instant.';
}
