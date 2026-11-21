import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { RentApiError, translateApiError } from './rentErrors';

const apiError = (status: number, code: string, message: string, fields: Record<string, string[]> = {}, retry: number | null = null) => new ApiError(status, code, message, fields, retry);

describe('translateApiError (loyers)', () => {
  it('traduit 401 en session expirée', () => {
    expect(translateApiError(apiError(401, 'unauthenticated', 'Unauthenticated.'))).toMatchObject({ kind: 'unauthenticated', status: 401, message: 'Votre session a expiré. Reconnectez-vous.' });
  });

  it('traduit 403 role_forbidden en droit manquant sans reprendre le message serveur', () => {
    const error = translateApiError(apiError(403, 'role_forbidden', 'Votre rôle ne permet pas cette action.'));
    expect(error).toBeInstanceOf(RentApiError);
    expect(error).toMatchObject({ kind: 'forbidden', code: 'role_forbidden', message: 'Votre rôle ne permet pas cette action sur les loyers.' });
  });

  it.each([
    ['rent_installment_not_found', 404, 'not_found', 'Cette échéance n’existe pas dans votre organisation.'],
    ['rent_payment_not_found', 404, 'not_found', 'Ce paiement n’existe pas dans votre organisation.'],
    ['rent_receipt_not_found', 404, 'not_found', 'Cette quittance n’existe pas dans votre organisation.'],
    ['rent_notice_not_found', 404, 'not_found', 'Aucun avis d’échéance n’a encore été émis pour cette échéance.'],
    ['rent_installment_has_payments', 409, 'conflict', 'Cette échéance a reçu des encaissements : annulez-les avant d’annuler l’échéance.'],
    ['rent_installment_not_paid', 409, 'conflict', 'Une quittance ne s’émet que pour une échéance entièrement soldée.'],
    ['rent_installment_not_issuable', 409, 'conflict', 'Cet avis d’échéance ne peut pas être émis dans l’état actuel de l’échéance.'],
    ['rent_lease_not_billable', 409, 'conflict', 'Ce bail ne peut pas être facturé : il doit être signé, avec un lot, un locataire et un loyer.'],
    ['rent_idempotency_key_reused', 409, 'conflict', 'Cet encaissement a déjà été saisi avec un contenu différent. Rechargez le formulaire pour en saisir un nouveau.'],
  ] as const)('traduit %s (%i) avec un message français maîtrisé', (code, status, kind, message) => {
    expect(translateApiError(apiError(status, code, 'Message serveur brut'))).toMatchObject({ kind, status, code, message });
  });

  it('garde le détail du serveur pour un code inconnu', () => {
    expect(translateApiError(apiError(409, 'rent_nouveau_code', 'Détail serveur'))).toMatchObject({ kind: 'conflict', message: 'Détail serveur' });
  });

  it('remplace les clés de validation brutes du serveur par un message par champ', () => {
    const error = translateApiError(apiError(422, 'validation_failed', 'Certaines informations sont invalides.', { amount: ['validation.min.numeric'] }));
    expect(error).toMatchObject({ kind: 'invalid', status: 422, message: 'Le montant est invalide : indiquez un montant strictement positif.' });
    expect((error as RentApiError).fieldErrors).toEqual({ amount: ['validation.min.numeric'] });
  });

  it('traduit le motif trop court sans nom de champ anglais', () => {
    expect(translateApiError(apiError(422, 'validation_failed', 'x', { reason: ['Le champ reason doit contenir au moins 2 caractères.'] }))).toMatchObject({ message: 'Le motif doit contenir entre 2 et 255 caractères.' });
  });

  it('retombe sur le premier message de champ quand le champ est inconnu', () => {
    expect(translateApiError(apiError(422, 'validation_failed', 'x', { autre: ['Valeur refusée.'] }))).toMatchObject({ message: 'Valeur refusée.' });
  });

  it('annonce l’indisponibilité du PDF avec le délai du serveur', () => {
    expect(translateApiError(apiError(503, 'rent_pdf_unavailable', 'x', {}, 30))).toMatchObject({
      kind: 'unavailable',
      status: 503,
      message: 'Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans 30 secondes.',
    });
    expect(translateApiError(apiError(503, 'rent_pdf_unavailable', 'x'))).toMatchObject({ message: 'Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.' });
  });

  it('traduit la limitation de débit', () => {
    expect(translateApiError(apiError(429, 'too_many_requests', 'x'))).toMatchObject({ kind: 'rate_limited' });
  });

  it('laisse passer les erreurs qui ne viennent pas du serveur', () => {
    const unreachable = new ApiUnreachableError();
    expect(translateApiError(unreachable)).toBe(unreachable);
    const server = apiError(500, 'server_error', 'Erreur interne');
    expect(translateApiError(server)).toBe(server);
  });
});
