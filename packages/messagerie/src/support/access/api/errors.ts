import { ApiError } from '@eguardimmo/api';
import { describeThreadFailure } from '../../../external/api/errors';
import type { ThreadFailure } from '../../../external/api/errors';

const NOT_FOUND = 'Cet accès n’existe pas ou ne concerne pas votre organisation. Rechargez la liste.';

const PROOF_CODES: readonly string[] = ['two_factor_required', 'reauthentication_required', 'email_unverified', 'space_forbidden'];

const FORBIDDEN_DEFAULT =
  'Seuls le propriétaire et les administrateurs de l’organisation décident des accès du support.';

export function describeAccessFailure(error: unknown): ThreadFailure {
  if (error instanceof ApiError) {
    if (error.status === 404 && error.code === 'support_access_not_found') return { kind: 'notFound', message: NOT_FOUND };
    if (error.status === 409 && error.code === 'support_access_not_pending') {
      return { kind: 'conflict', message: 'Cet accès a déjà été accepté, refusé, révoqué ou a expiré. La liste est mise à jour.' };
    }
    if (error.status === 422 && error.code === 'support_access_duration_invalid') {
      return { kind: 'invalid', message: 'La durée d’un accès va de 1 à 72 heures, et ne peut pas dépasser la durée demandée.' };
    }
    if (error.status === 422 && error.code === 'support_access_scope_invalid') {
      return { kind: 'invalid', message: 'Le périmètre accordé ne peut pas dépasser celui qui a été demandé.' };
    }
    if (error.status === 422) return { kind: 'invalid', message: 'La durée ou le périmètre choisi est invalide : vérifiez votre saisie.' };
    if (error.status === 403 && !PROOF_CODES.includes(error.code)) return { kind: 'forbidden', message: FORBIDDEN_DEFAULT };
  }
  return describeThreadFailure(error);
}

export function accessErrorMessage(error: unknown): string {
  return describeAccessFailure(error).message;
}

export function isStaleAccessFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'support_access_not_pending' || error.code === 'support_access_not_found');
}
