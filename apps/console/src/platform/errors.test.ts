import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem, isRetryable, problemText } from './errors';

describe('lecture des problèmes serveur', () => {
  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [410, 'not_found'],
    [409, 'conflict'],
    [422, 'invalid'],
    [429, 'rate_limited'],
    [500, 'unexpected'],
  ] as const)('classe le statut %i en %s', (status, kind) => {
    expect(describeProblem(new ApiError(status, 'x', 'Message.')).kind).toBe(kind);
  });

  it('préfère le premier message de champ pour un 422', () => {
    expect(problemText(new ApiError(422, 'validation_failed', 'Invalide.', { reason: ['Le motif est trop court.'] }))).toBe('Le motif est trop court.');
  });

  it('ajoute le délai d’attente d’un 429', () => {
    expect(problemText(new ApiError(429, 'too_many_requests', 'Trop de requêtes', {}, 12))).toBe('Trop de requêtes. Réessayez dans 12 s.');
    expect(problemText(new ApiError(429, 'too_many_requests', 'Trop de requêtes.'))).toBe('Trop de requêtes.');
  });

  it('distingue serveur injoignable, réponse hors contrat et panne inconnue', () => {
    expect(describeProblem(new ApiUnreachableError()).kind).toBe('unreachable');
    expect(describeProblem(new UnexpectedResponseError()).message).toContain('Réponse inattendue');
    expect(problemText(new Error('secret interne'))).toBe('La requête a échoué. Réessayez dans un instant.');
  });

  it('ne rejoue que les pannes qui peuvent passer', () => {
    expect(isRetryable(new ApiError(503, 'x', 'Indisponible'))).toBe(true);
    expect(isRetryable(new ApiError(403, 'x', 'Interdit'))).toBe(false);
    expect(isRetryable(new UnexpectedResponseError())).toBe(false);
    expect(isRetryable(new ApiUnreachableError())).toBe(true);
  });
});
