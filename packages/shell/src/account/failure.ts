import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { UnexpectedAccountResponseError } from './requests';

export type AccountFailureKind = 'unauthenticated' | 'forbidden' | 'notFound' | 'rateLimited' | 'unreachable' | 'unexpected' | 'other';

export interface AccountFailure {
  kind: AccountFailureKind;
  message: string;
}

function waitLabel(seconds: number | null): string {
  if (seconds === null) return 'un instant';
  if (seconds < 90) return `${String(seconds)} s`;
  return `${String(Math.ceil(seconds / 60))} min`;
}

export function describeAccountFailure(error: unknown): AccountFailure {
  if (error instanceof ApiError) {
    if (error.status === 401) return { kind: 'unauthenticated', message: 'Votre session a expiré. Reconnectez-vous pour continuer.' };
    if (error.status === 403 && error.code === 'email_unverified') {
      return { kind: 'forbidden', message: 'Confirmez votre adresse e-mail pour accéder à votre compte.' };
    }
    if (error.status === 403) return { kind: 'forbidden', message: 'Vous n’avez pas le droit d’effectuer cette action.' };
    if (error.status === 404) return { kind: 'notFound', message: 'Cet élément n’existe plus. La liste est mise à jour.' };
    if (error.status === 429) {
      return { kind: 'rateLimited', message: `Trop de demandes en peu de temps. Patientez ${waitLabel(error.retryAfterSeconds)} avant de réessayer.` };
    }
    return { kind: 'other', message: error.message };
  }
  if (error instanceof ApiUnreachableError) return { kind: 'unreachable', message: error.message };
  if (error instanceof UnexpectedAccountResponseError) return { kind: 'unexpected', message: error.message };
  return { kind: 'other', message: 'Une erreur est survenue. Réessayez dans un instant.' };
}
