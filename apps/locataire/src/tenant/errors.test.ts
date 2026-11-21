import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeFailure, shouldRetry } from './errors';

describe('messages d’erreur du locataire', () => {
  it.each([
    [new ApiError(401, 'http_401', 'x'), 'unauthenticated', 'Votre session a expiré'],
    [new ApiError(403, 'email_unverified', 'x'), 'unverified', 'Confirmez votre adresse e-mail'],
    [new ApiError(403, 'space_forbidden', 'x'), 'noAccess', 'pas ou plus d’accès'],
    [new ApiError(403, 'operator_token_forbidden', 'x'), 'forbidden', 'pas le droit'],
    [new ApiError(404, 'lease_not_found', 'x'), 'notFound', 'n’existe pas ou n’est plus accessible'],
    [new ApiError(409, 'rent_receipt_void', 'x'), 'receiptVoid', 'quittance a été annulée'],
    [new ApiError(409, 'autre_conflit', 'Conflit.'), 'other', 'Conflit.'],
    [new ApiError(429, 'http_429', 'x', {}, 12), 'rateLimited', 'Patientez 12 s'],
    [new ApiError(429, 'http_429', 'x'), 'rateLimited', 'Patientez un instant'],
    [new ApiError(500, 'server_error', 'Erreur interne.'), 'other', 'Erreur interne.'],
    [new ApiUnreachableError(), 'unreachable', 'injoignable'],
    [new UnexpectedResponseError(), 'unexpected', 'inattendu'],
    [new Error('boom'), 'other', 'Une erreur est survenue'],
  ] as const)('%#', (error, kind, message) => {
    const failure = describeFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toContain(message);
  });

  it('adapte le texte du 404 au contexte', () => {
    expect(describeFailure(new ApiError(404, 'tenant_access_not_found', 'x'), { notFound: 'Déjà retiré.' }).message).toBe('Déjà retiré.');
  });

  it('ne relance pas une requête refusée, limitée ou mal formée', () => {
    for (const status of [401, 403, 404, 422, 429]) expect(shouldRetry(0, new ApiError(status, 'x', 'x'))).toBe(false);
    expect(shouldRetry(0, new UnexpectedResponseError())).toBe(false);
  });

  it('relance deux fois une panne serveur ou réseau', () => {
    expect(shouldRetry(0, new ApiError(503, 'x', 'x'))).toBe(true);
    expect(shouldRetry(1, new ApiUnreachableError())).toBe(true);
    expect(shouldRetry(2, new ApiUnreachableError())).toBe(false);
  });
});
