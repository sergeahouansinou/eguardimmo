import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { describeAccountFailure } from './failure';
import { UnexpectedAccountResponseError } from './requests';

describe('traduction des erreurs du compte', () => {
  it.each([
    [new ApiError(401, 'unauthenticated', 'x'), 'unauthenticated', 'Votre session a expiré. Reconnectez-vous pour continuer.'],
    [new ApiError(403, 'email_unverified', 'x'), 'forbidden', 'Confirmez votre adresse e-mail pour accéder à votre compte.'],
    [new ApiError(403, 'operator_token_forbidden', 'x'), 'forbidden', 'Vous n’avez pas le droit d’effectuer cette action.'],
    [new ApiError(404, 'not_found', 'x'), 'notFound', 'Cet élément n’existe plus. La liste est mise à jour.'],
    [new ApiError(429, 'too_many_requests', 'x', {}, 42), 'rateLimited', 'Trop de demandes en peu de temps. Patientez 42 s avant de réessayer.'],
    [new ApiError(429, 'too_many_requests', 'x', {}, 600), 'rateLimited', 'Trop de demandes en peu de temps. Patientez 10 min avant de réessayer.'],
    [new ApiError(429, 'too_many_requests', 'x'), 'rateLimited', 'Trop de demandes en peu de temps. Patientez un instant avant de réessayer.'],
    [new ApiError(500, 'server_error', 'Une erreur interne est survenue. Réessayez plus tard.'), 'other', 'Une erreur interne est survenue. Réessayez plus tard.'],
    [new ApiUnreachableError(), 'unreachable', 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.'],
    [new UnexpectedAccountResponseError(), 'unexpected', 'Le serveur a répondu de façon inattendue. Réessayez dans un instant.'],
    [new Error('boom'), 'other', 'Une erreur est survenue. Réessayez dans un instant.'],
  ])('%#', (error, kind, message) => {
    expect(describeAccountFailure(error)).toEqual({ kind, message });
  });
});
