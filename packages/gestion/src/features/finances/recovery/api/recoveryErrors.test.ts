import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { RecoveryApiError, translateApiError } from './recoveryErrors';
import * as api from './responses.fixtures';

const MESSAGE_RE = /[a-z]/i;

function apiError(problem: { status: number; code: string; detail?: string; errors?: Record<string, string[]>; retry_after?: number }): ApiError {
  return new ApiError(problem.status, problem.code, problem.detail ?? 'erreur', problem.errors ?? {}, problem.retry_after ?? null);
}

const translated = (error: unknown): RecoveryApiError => {
  const result = translateApiError(error);
  expect(result).toBeInstanceOf(RecoveryApiError);
  return result as RecoveryApiError;
};

describe('translateApiError', () => {
  it('laisse passer une erreur qui n’est pas une erreur d’API', () => {
    const boom = new Error('boum');
    expect(translateApiError(boom)).toBe(boom);
  });

  it.each([
    [api.problemCaseNotFound, 'not_found', 'n’existe pas'],
    [api.problemItemNotFound, 'not_found', 'pas dans ce dossier'],
    [api.problemCaseExists, 'conflict', 'déjà ouvert'],
    [api.problemCaseNotActive, 'conflict', 'clos ou irrécouvrable'],
    [api.problemTransition, 'conflict', 'statut'],
    [api.problemRevokeAgain, 'conflict', 'déjà révoquée'],
    [api.problemRecipientInvalid, 'invalid', 'commissaire de justice'],
    [api.problemForbidden, 'forbidden', 'rôle'],
    [api.problemTooMany, 'rate_limited', 'Patientez'],
    [api.problemLinkUnavailable, 'unavailable', 'n’est pas configurée'],
  ])('traduit %#', (problem, kind, fragment) => {
    const error = translated(apiError(problem));
    expect(error.kind).toBe(kind);
    expect(error.message).toContain(fragment);
    expect(error.message).toMatch(MESSAGE_RE);
  });

  it('prend le message du premier champ invalide en français', () => {
    expect(translated(apiError(api.problemValidDays)).message).toBe('La durée de validité doit être comprise entre 1 et 30 jours.');
    expect(translated(apiError(api.problemStatusInvalid)).message).toBe('Le statut choisi est invalide.');
  });

  it('annonce le délai du service PDF', () => {
    const error = translated(apiError(api.problemPdfUnavailable));
    expect(error.kind).toBe('unavailable');
    expect(error.message).toContain('30 secondes');
  });
});
