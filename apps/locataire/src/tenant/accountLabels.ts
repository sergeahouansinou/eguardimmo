import type { Tone } from '@eguardimmo/shell';
import type { FailureWording } from './errors';

export const CONTACT_FIELD_LABEL = { email: 'Adresse e-mail', phone: 'Téléphone' } as const;

export const CONTACT_STATUS_VIEW: Record<'pending' | 'applied' | 'dismissed', { label: string; tone: Tone }> = {
  pending: { label: 'En attente de traitement par l’agence', tone: 'info' },
  applied: { label: 'Appliquée par l’agence', tone: 'success' },
  dismissed: { label: 'Écartée ou remplacée', tone: 'neutral' },
};

export const ACCOUNT_CODES: Readonly<Record<string, string>> = {
  email_change_code_invalid: 'Ce code est incorrect ou expiré, ou cette adresse ne peut pas être utilisée. Vérifiez le code reçu ou recommencez la demande.',
  email_change_attempts_exceeded: 'Trop d’essais avec ce code. Recommencez la demande de changement d’adresse pour recevoir un nouveau code.',
  phone_invalid: 'Ce numéro de téléphone est invalide. Saisissez-le au format international, par exemple +33 6 12 34 56 78.',
  contact_update_not_found: 'Cette agence ne figure pas parmi celles auxquelles votre compte est rattaché.',
  contact_update_empty: 'Votre compte ne porte aucune des coordonnées choisies : renseignez-les d’abord, puis transmettez-les.',
  idempotency_key_reused: 'Cette demande a déjà été enregistrée avec un contenu différent. Rechargez la page pour recommencer.',
  validation_failed: 'Certains champs sont invalides : vérifiez votre saisie.',
};

export const ACCOUNT_WORDING: FailureWording = { notFound: ACCOUNT_CODES.contact_update_not_found, codes: ACCOUNT_CODES };
