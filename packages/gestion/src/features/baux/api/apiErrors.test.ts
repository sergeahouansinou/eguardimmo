import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { BauxApiError, LeaseStaleVersionError, STALE_VERSION_MESSAGE, isLeaseStaleVersion, translateApiError } from './apiErrors';

const apiError = (status: number, code: string, message: string, fields: Record<string, string[]> = {}) => new ApiError(status, code, message, fields);

describe('translateApiError', () => {
  it('traduit 401 en session expirée, sans reprendre le message serveur', () => {
    const error = translateApiError(apiError(401, 'unauthenticated', 'Unauthenticated.'));
    expect(error).toBeInstanceOf(BauxApiError);
    expect(error).toMatchObject({ kind: 'unauthenticated', status: 401, message: 'Votre session a expiré. Reconnectez-vous.' });
  });

  it('traduit 403 en droit manquant', () => {
    expect(translateApiError(apiError(403, 'forbidden', 'This action is unauthorized.'))).toMatchObject({ kind: 'forbidden', status: 403, message: 'Vous n’avez pas le droit d’effectuer cette action sur les baux.' });
  });

  it('traduit 404 avec le détail du serveur', () => {
    expect(translateApiError(apiError(404, 'lease_not_found', 'Ce bail n\'existe pas dans votre organisation.'))).toMatchObject({ kind: 'not_found', code: 'lease_not_found', message: 'Ce bail n\'existe pas dans votre organisation.' });
  });

  it('traduit 409 lease_stale_version en erreur typée dédiée', () => {
    const error = translateApiError(apiError(409, 'lease_stale_version', 'Le bail a été modifié depuis sa lecture'));
    expect(error).toBeInstanceOf(LeaseStaleVersionError);
    expect(isLeaseStaleVersion(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'stale_version', status: 409, message: STALE_VERSION_MESSAGE });
  });

  it('garde les autres 409 comme conflits avec leur code', () => {
    const error = translateApiError(apiError(409, 'lease_overlap', 'Un autre bail occupe déjà l\'un de ces lots pendant tout ou partie de cette période.'));
    expect(error).toMatchObject({ kind: 'conflict', code: 'lease_overlap', message: 'Un autre bail occupe déjà l\'un de ces lots pendant tout ou partie de cette période.' });
    expect(isLeaseStaleVersion(error)).toBe(false);
  });

  it('traduit 422 avec la première erreur de champ', () => {
    const error = translateApiError(apiError(422, 'validation_failed', 'Certaines informations sont invalides.', { due_day: ['Le jour doit être compris entre 1 et 28.'] }));
    expect(error).toMatchObject({ kind: 'invalid', status: 422, message: 'Le jour doit être compris entre 1 et 28.', fieldErrors: { due_day: ['Le jour doit être compris entre 1 et 28.'] } });
  });

  it('laisse passer les autres statuts et les pannes réseau sans les déguiser', () => {
    const server = apiError(500, 'server_error', 'Une erreur interne est survenue.');
    const unreachable = new ApiUnreachableError();
    expect(translateApiError(server)).toBe(server);
    expect(translateApiError(unreachable)).toBe(unreachable);
  });
});
