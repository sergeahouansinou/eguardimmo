import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { InvoicingApiError, translateApiError } from './invoicingErrors';

const apiError = (status: number, code: string, message: string, fields: Record<string, string[]> = {}, retry: number | null = null) => new ApiError(status, code, message, fields, retry);

describe('translateApiError (facturation)', () => {
  it('traduit 401 en session expirée', () => {
    expect(translateApiError(apiError(401, 'unauthenticated', 'Unauthenticated.'))).toMatchObject({ kind: 'unauthenticated', status: 401, message: 'Votre session a expiré. Reconnectez-vous.' });
  });

  it('traduit 403 role_forbidden sans reprendre le message serveur', () => {
    const error = translateApiError(apiError(403, 'role_forbidden', 'Votre rôle ne permet pas cette action.'));
    expect(error).toBeInstanceOf(InvoicingApiError);
    expect(error).toMatchObject({ kind: 'forbidden', code: 'role_forbidden', message: 'Votre rôle ne permet pas cette action sur la facturation.' });
  });

  it('distingue le refus d’une organisation individuelle', () => {
    expect(translateApiError(apiError(403, 'invoicing_agency_only', 'brut'))).toMatchObject({ kind: 'agency_only', message: 'La facturation est réservée aux organisations de type agence.' });
  });

  it.each([
    ['invoice_not_found', 404, 'not_found', 'Cette facture n’existe pas dans votre organisation.'],
    ['invoice_payment_not_found', 404, 'not_found', 'Ce règlement n’existe pas dans votre organisation.'],
    ['invoice_stale_version', 409, 'conflict', 'Ce brouillon a été modifié depuis votre lecture : rechargez la page avant de l’enregistrer.'],
    ['invoice_idempotency_key_reused', 409, 'conflict', 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez le formulaire pour en saisir une nouvelle.'],
    ['invoice_not_draft', 409, 'conflict', 'Seul un brouillon peut être modifié, émis ou abandonné.'],
    ['invoice_not_payable', 409, 'conflict', 'Seule une facture émise ayant un reste dû peut recevoir un règlement.'],
    ['invoice_issuer_incomplete', 422, 'invalid', 'Renseignez l’identité légale de votre agence (raison sociale, adresse, SIREN, numéro de TVA) avant d’émettre une facture.'],
    ['invoice_recipient_incomplete', 422, 'invalid', 'Un destinataire professionnel doit avoir une adresse et un SIREN ; une partie anonymisée ne peut pas être facturée.'],
    ['invoice_recipient_email_missing', 422, 'invalid', 'Le destinataire n’a pas d’adresse e-mail principale : ajoutez-en une sur sa fiche avant l’envoi.'],
    ['invoice_payment_exceeds_outstanding', 422, 'invalid', 'Le règlement dépasse le reste dû de la facture.'],
    ['invoice_credit_exceeds_outstanding', 422, 'invalid', 'Le cumul des avoirs ne peut pas dépasser le reste dû de la facture.'],
    ['invoice_credit_exceeds_line', 422, 'invalid', 'Le cumul des avoirs d’une ligne ne peut pas dépasser sa quantité facturée.'],
    ['invoice_item_forbidden_for_tenant', 422, 'invalid', 'Les frais de relance ou de procédure se refacturent au mandant, jamais à un locataire d’habitation.'],
    ['invoice_einvoicing_required', 422, 'invalid', 'Ce destinataire assujetti doit recevoir une facture électronique : l’émission en PDF seul est refusée.'],
    ['invoice_tax_rate_not_allowed', 422, 'invalid', 'Ce taux ou cette catégorie de TVA n’est pas autorisé pour cette nature de ligne ou ce destinataire. L’autoliquidation exige un destinataire société avec numéro de TVA.'],
    ['invoice_references_inconsistent', 422, 'invalid', 'Le destinataire doit être partie au bail référencé (ou le mandant d’un mandat qui couvre un lot du bail). Sans bail, un mandat ne se facture qu’à son mandant.'],
    ['invoice_tax_rate_unknown', 422, 'invalid', 'Aucun taux de taxe ne correspond à cette catégorie à la date de la facture.'],
    ['invoice_lines_invalid', 422, 'invalid', 'La facture doit porter entre 1 et 100 lignes aux montants valides.'],
    ['invoice_due_date_invalid', 422, 'invalid', 'L’échéance ne peut pas précéder la date d’émission.'],
    ['invoice_payment_invalid', 422, 'invalid', 'La date du règlement doit être comprise entre l’émission de la facture et aujourd’hui.'],
    ['invoice_not_issued', 409, 'conflict', 'Cette pièce n’a pas encore été émise.'],
    ['invoice_not_creditable', 409, 'conflict', 'Seule une facture émise, non totalement annulée, peut recevoir un avoir.'],
    ['invoice_jurisdiction_unsupported', 422, 'invalid', 'La juridiction du siège de votre agence n’a pas encore de règles de facturation.'],
  ] as const)('traduit %s (%i) avec un message français maîtrisé', (code, status, kind, message) => {
    expect(translateApiError(apiError(status, code, 'Message serveur brut'))).toMatchObject({ kind, status, code, message });
  });

  it('garde le détail du serveur pour un code inconnu', () => {
    expect(translateApiError(apiError(409, 'invoice_nouveau_code', 'Détail serveur'))).toMatchObject({ kind: 'conflict', message: 'Détail serveur' });
  });

  it('remplace une clé de validation imbriquée par le message de son dernier segment', () => {
    const error = translateApiError(apiError(422, 'validation_failed', 'Certaines informations sont invalides.', { 'lines.0.unit_price': ['validation.min.numeric'] }));
    expect(error).toMatchObject({ kind: 'invalid', message: 'Le prix unitaire d’une ligne est invalide.' });
    expect((error as InvoicingApiError).fieldErrors).toEqual({ 'lines.0.unit_price': ['validation.min.numeric'] });
  });

  it('traduit 429 sans reprendre le message serveur', () => {
    expect(translateApiError(apiError(429, 'too_many_requests', 'Trop de requêtes.', {}, 12))).toMatchObject({ kind: 'rate_limited', message: 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.' });
  });

  it('traduit 503 du PDF en précisant qu’aucune écriture n’a eu lieu', () => {
    expect(translateApiError(apiError(503, 'invoice_pdf_unavailable', 'brut', {}, 30))).toMatchObject({
      kind: 'unavailable',
      message: 'Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans 30 secondes.',
    });
    expect(translateApiError(apiError(503, 'invoice_pdf_unavailable', 'brut'))).toMatchObject({ message: 'Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.' });
  });

  it('laisse passer une panne réseau et une erreur inconnue', () => {
    const unreachable = new ApiUnreachableError();
    expect(translateApiError(unreachable)).toBe(unreachable);
    expect(translateApiError(apiError(500, 'server_error', 'Erreur'))).toBeInstanceOf(ApiError);
  });
});
