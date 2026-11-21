import { ApiError, ApiUnreachableError } from '@eguardimmo/api';

export class UnexpectedResponseError extends Error {
  constructor() {
    super('Le serveur a répondu de façon inattendue. Réessayez dans un instant.');
    this.name = 'UnexpectedResponseError';
  }
}

export type FailureKind = 'unauthenticated' | 'unverified' | 'reauthenticationRequired' | 'noAccess' | 'forbidden' | 'notFound' | 'rateLimited' | 'receiptVoid' | 'unreachable' | 'unexpected' | 'other';

export interface Failure {
  kind: FailureKind;
  message: string;
}

export interface FailureWording {
  notFound?: string;
  codes?: Readonly<Record<string, string>>;
  unavailable?: string;
}

const DEFAULT_NOT_FOUND = 'Cet élément n’existe pas ou n’est plus accessible depuis votre espace.';

export function describeFailure(error: unknown, wording: FailureWording = {}): Failure {
  if (error instanceof ApiError) {
    const known = wording.codes?.[error.code];
    if (known !== undefined && error.status !== 401) return { kind: error.status === 404 ? 'notFound' : 'other', message: known };
    if (error.status === 401) return { kind: 'unauthenticated', message: 'Votre session a expiré. Reconnectez-vous pour continuer.' };
    if (error.status === 403 && error.code === 'email_unverified') {
      return { kind: 'unverified', message: 'Confirmez votre adresse e-mail pour accéder à votre espace locataire.' };
    }
    if (error.status === 403 && error.code === 'space_forbidden') {
      return { kind: 'noAccess', message: 'Votre compte n’a pas ou plus d’accès à l’espace locataire.' };
    }
    if (error.status === 403 && error.code === 'reauthentication_required') {
      return { kind: 'reauthenticationRequired', message: 'Pour votre sécurité, confirmez votre identité avec votre mot de passe. Vous reviendrez ensuite sur cette page : ressaisissez alors votre demande.' };
    }
    if (error.status === 403) return { kind: 'forbidden', message: 'Vous n’avez pas le droit d’effectuer cette action.' };
    if (error.status === 409 && error.code === 'rent_receipt_void') {
      return { kind: 'receiptVoid', message: 'Cette quittance a été annulée : son PDF n’est plus délivré.' };
    }
    if (error.status === 404) return { kind: 'notFound', message: wording.notFound ?? DEFAULT_NOT_FOUND };
    if (error.status === 429) {
      const wait = error.retryAfterSeconds === null ? 'un instant' : `${String(error.retryAfterSeconds)} s`;
      return { kind: 'rateLimited', message: `Trop de demandes en peu de temps. Patientez ${wait} avant de réessayer.` };
    }
    if (error.status === 503 && wording.unavailable !== undefined) return { kind: 'other', message: wording.unavailable };
    return { kind: 'other', message: error.message };
  }
  if (error instanceof ApiUnreachableError) return { kind: 'unreachable', message: error.message };
  if (error instanceof UnexpectedResponseError) return { kind: 'unexpected', message: error.message };
  return { kind: 'other', message: 'Une erreur est survenue. Réessayez dans un instant.' };
}

const FINAL_STATUSES: readonly number[] = [401, 403, 404, 422, 429];

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && FINAL_STATUSES.includes(error.status)) return false;
  if (error instanceof UnexpectedResponseError) return false;
  return failureCount < 2;
}
