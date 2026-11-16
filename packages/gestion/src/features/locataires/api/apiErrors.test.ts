import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { LocatairesApiError, STALE_VERSION_MESSAGE, TenantStaleVersionError, isTenantStaleVersion, translateApiError } from './apiErrors';

const apiError = (status: number, code: string, message: string, fields: Record<string, string[]> = {}) => new ApiError(status, code, message, fields);

describe('translateApiError', () => {
  it('traduit 401 en session expirée, sans reprendre le message serveur', () => {
    const error = translateApiError(apiError(401, 'unauthenticated', 'Unauthenticated.'));
    expect(error).toBeInstanceOf(LocatairesApiError);
    expect(error).toMatchObject({ kind: 'unauthenticated', status: 401, message: 'Votre session a expiré. Reconnectez-vous.' });
  });

  it('traduit 403 en droit manquant', () => {
    expect(translateApiError(apiError(403, 'role_forbidden', 'Rôle insuffisant.'))).toMatchObject({
      kind: 'forbidden',
      status: 403,
      code: 'role_forbidden',
      message: 'Vous n’avez pas le droit d’effectuer cette action sur les locataires.',
    });
  });

  it('traduit 404 avec le détail du serveur', () => {
    expect(translateApiError(apiError(404, 'party_not_found', 'Ce contact n\'existe pas dans votre organisation.'))).toMatchObject({ kind: 'not_found', code: 'party_not_found' });
  });

  it('traduit 409 party_version_conflict en erreur typée « modifiée entre-temps »', () => {
    const error = translateApiError(apiError(409, 'party_version_conflict', 'La fiche a été modifiée depuis sa lecture'));
    expect(error).toBeInstanceOf(TenantStaleVersionError);
    expect(isTenantStaleVersion(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'stale_version', status: 409, message: STALE_VERSION_MESSAGE });
  });

  it('garde les autres 409 comme conflits avec leur code et leur message', () => {
    const error = translateApiError(apiError(409, 'identifier_taken', 'Un contact de votre organisation porte déjà cet identifiant.'));
    expect(error).toMatchObject({ kind: 'conflict', code: 'identifier_taken', message: 'Un contact de votre organisation porte déjà cet identifiant.' });
    expect(isTenantStaleVersion(error)).toBe(false);
  });

  it('traduit 422 avec la première erreur de champ', () => {
    const error = translateApiError(apiError(422, 'validation_failed', 'Certaines informations sont invalides.', { last_name: ['Le nom est obligatoire.'] }));
    expect(error).toMatchObject({ kind: 'invalid', status: 422, message: 'Le nom est obligatoire.', fieldErrors: { last_name: ['Le nom est obligatoire.'] } });
  });

  it('laisse passer les autres statuts et les pannes réseau sans les déguiser', () => {
    const server = apiError(500, 'server_error', 'Une erreur interne est survenue.');
    const unreachable = new ApiUnreachableError();
    expect(translateApiError(server)).toBe(server);
    expect(translateApiError(unreachable)).toBe(unreachable);
  });
});
