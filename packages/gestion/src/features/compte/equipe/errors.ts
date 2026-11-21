import { ApiError } from '@eguardimmo/api';
import { planLimitMessage } from '../../orgapi/planLimit';

export const SCOPE_UNSUPPORTED_MESSAGE =
  "Le périmètre limité à certains biens n'est pas appliqué par le serveur : un membre y verrait tous les biens. Gardez « Tous les biens ».";

export function teamErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.code === 'member_scope_unsupported') return SCOPE_UNSUPPORTED_MESSAGE;
  if (error instanceof ApiError) return planLimitMessage(error) ?? error.message;
  return error instanceof Error ? error.message : fallback;
}
