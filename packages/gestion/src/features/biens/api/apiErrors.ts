import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { BiensError, BiensStaleVersionError } from '../errors';
import { planLimitMessage } from '../../orgapi/planLimit';

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les biens ne peuvent pas être chargés.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

const VERSION_CONFLICT_CODES: readonly string[] = ['property_version_conflict', 'unit_version_conflict'];

export const unexpectedResponse = (detail?: string): BiensError =>
  new BiensError(detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { kind: 'unexpected_response' });

export const unsupported = (message: string): BiensError => new BiensError(message, { kind: 'unsupported' });

export const invalid = (message: string, code = 'invalid_input'): BiensError => new BiensError(message, { kind: 'invalid', status: 422, code });

export function translateApiError(error: unknown): unknown {
  if (error instanceof ApiUnreachableError) return new BiensError(error.message, { kind: 'unreachable', cause: error });
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const planLimit = planLimitMessage(error);
  if (error.status === 401) return new BiensError('Votre session a expiré. Reconnectez-vous.', { ...common, kind: 'unauthenticated' });
  if (error.status === 403) return new BiensError(planLimit ?? 'Vous n’avez pas le droit d’effectuer cette action sur les biens.', { ...common, kind: 'forbidden' });
  if (error.status === 404) return new BiensError(error.message, { ...common, kind: 'not_found' });
  if (error.status === 409) return VERSION_CONFLICT_CODES.includes(error.code) ? new BiensStaleVersionError(error) : new BiensError(planLimit ?? error.message, { ...common, kind: 'conflict' });
  if (error.status === 422) return new BiensError(error.firstFieldError() ?? error.message, { ...common, kind: 'invalid' });
  return error;
}
