import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { UnexpectedResponseError } from '../../external/api/errors';

export type CampaignFailureKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'twoFactorRequired'
  | 'reauthRequired'
  | 'notFound'
  | 'versionConflict'
  | 'notEditable'
  | 'conflict'
  | 'invalid'
  | 'quota'
  | 'sendingDisabled'
  | 'attachmentInfected'
  | 'unavailable'
  | 'unreachable'
  | 'unexpected'
  | 'other';

export interface CampaignFailure {
  kind: CampaignFailureKind;
  message: string;
}

const GENERIC = 'Une erreur est survenue. Réessayez dans un instant.';

function wait(seconds: number | null): string {
  if (seconds === null) return 'un instant';
  return seconds < 90 ? `${String(seconds)} s` : `${String(Math.ceil(seconds / 60))} min`;
}

const BY_CODE: Readonly<Record<string, CampaignFailure>> = {
  role_forbidden: { kind: 'forbidden', message: 'Votre rôle ne permet pas de gérer les campagnes : elles sont réservées au titulaire, aux administrateurs et aux gestionnaires.' },
  two_factor_required: { kind: 'twoFactorRequired', message: 'Activez la double authentification sur votre compte pour envoyer ou programmer une campagne.' },
  reauthentication_required: { kind: 'reauthRequired', message: 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes pour continuer.' },
  campaign_sender_not_allowed: { kind: 'forbidden', message: 'L’auteur de l’envoi n’est plus membre actif avec un rôle autorisé et la double authentification : la campagne reste en l’état.' },
  campaign_not_found: { kind: 'notFound', message: 'Cette campagne n’existe pas ou n’est plus accessible.' },
  campaign_attachment_not_found: { kind: 'notFound', message: 'Cette pièce jointe n’existe plus.' },
  announcement_not_found: { kind: 'notFound', message: 'Cette annonce n’existe pas ou ne vous concerne pas.' },
  campaign_not_editable: { kind: 'notEditable', message: 'Seul un brouillon se modifie : une campagne programmée s’annule, une campagne envoyée ne change plus.' },
  campaign_version_conflict: { kind: 'versionConflict', message: 'Cette campagne a été modifiée entre-temps par une autre personne. Rechargez-la pour reprendre la dernière version.' },
  campaign_attachment_limit: { kind: 'conflict', message: 'Une campagne porte trois pièces jointes au plus.' },
  campaign_attachment_not_ready: { kind: 'conflict', message: 'Une pièce jointe n’a pas encore passé la vérification antivirus ou n’a pas pu être vérifiée : l’envoi reste bloqué. Réessayez dans quelques minutes.' },
  attachment_not_ready: { kind: 'conflict', message: 'Cette pièce jointe est en cours de vérification antivirus : réessayez dans quelques minutes.' },
  attachment_infected: { kind: 'attachmentInfected', message: 'Cette pièce jointe a été bloquée par l’antivirus et n’est plus disponible.' },
  campaign_audience_empty: { kind: 'invalid', message: 'Aucun destinataire ne recevrait cette campagne : choisissez d’autres destinataires.' },
  campaign_audience_unavailable: { kind: 'invalid', message: 'Ces destinataires ne sont pas disponibles pour votre organisation.' },
  campaign_schedule_invalid: { kind: 'invalid', message: 'La date d’envoi doit être dans 15 minutes au moins.' },
  campaign_sending_disabled: { kind: 'sendingDisabled', message: 'L’envoi d’e-mails n’est pas encore activé sur la plateforme. La campagne reste enregistrée : vous pourrez l’envoyer dès son activation.' },
};

function invalidFields(error: ApiError): CampaignFailure | null {
  const fields = Object.entries(error.fieldErrors);
  const fusion = fields.flatMap(([, messages]) => messages).find((message) => message.startsWith('Champ de fusion inconnu'));
  if (fusion !== undefined) return { kind: 'invalid', message: fusion };
  const names = fields.map(([name]) => name);
  if (names.includes('subject')) return { kind: 'invalid', message: 'L’objet est obligatoire (140 caractères au plus).' };
  if (names.includes('body')) return { kind: 'invalid', message: 'Le message est obligatoire pour un envoi (10 000 caractères au plus).' };
  if (names.some((name) => name.startsWith('building_ids'))) return { kind: 'invalid', message: 'Un immeuble choisi n’existe plus dans votre organisation : rechargez la page.' };
  if (names.includes('file')) return { kind: 'invalid', message: 'La pièce jointe est refusée : PDF uniquement, 5 Mo au plus.' };
  if (names.includes('scheduled_at')) return { kind: 'invalid', message: 'Choisissez une date et une heure d’envoi valides.' };
  return null;
}

export function describeCampaignFailure(error: unknown): CampaignFailure {
  if (error instanceof ApiError) {
    const known = BY_CODE[error.code];
    if (error.code === 'campaign_quota_reached') {
      return { kind: 'quota', message: `Le plafond de destinataires sur 24 heures ou d’envois par heure est atteint. Réessayez dans ${wait(error.retryAfterSeconds)}.` };
    }
    if (known) return known;
    if (error.status === 401) return { kind: 'unauthenticated', message: 'Votre session a expiré. Reconnectez-vous pour continuer.' };
    if (error.status === 403) return { kind: 'forbidden', message: 'Vous n’avez pas le droit d’effectuer cette action.' };
    if (error.status === 404) return { kind: 'notFound', message: 'Cet élément n’existe pas ou n’est plus accessible.' };
    if (error.status === 422) return invalidFields(error) ?? { kind: 'invalid', message: 'Certains champs sont invalides : vérifiez votre saisie.' };
    if (error.status === 429) return { kind: 'quota', message: `Trop de demandes en peu de temps. Patientez ${wait(error.retryAfterSeconds)} avant de réessayer.` };
    if (error.status === 503) return { kind: 'unavailable', message: 'Le service est momentanément indisponible. Réessayez dans un instant.' };
    return { kind: 'other', message: GENERIC };
  }
  if (error instanceof ApiUnreachableError) return { kind: 'unreachable', message: error.message };
  if (error instanceof UnexpectedResponseError) return { kind: 'unexpected', message: error.message };
  return { kind: 'other', message: GENERIC };
}

export function campaignErrorMessage(error: unknown): string {
  return describeCampaignFailure(error).message;
}

export function isVersionConflict(error: unknown): boolean {
  return describeCampaignFailure(error).kind === 'versionConflict';
}
