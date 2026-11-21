import type { Tone } from '@eguardimmo/shell';
import type { FailureWording } from './errors';
import { FILE_CODES } from './fileErrors';
import type { NoticeStatus } from './noticeSchemas';

export const NOTICE_STATUS_VIEW: Record<NoticeStatus, { label: string; tone: Tone }> = {
  submitted: { label: 'Transmise, en attente d’accusé de réception', tone: 'info' },
  acknowledged: { label: 'Réception accusée par l’agence', tone: 'success' },
  withdrawn: { label: 'Retirée', tone: 'neutral' },
  closed: { label: 'Clôturée', tone: 'neutral' },
};

export const CLOSED_OUTCOME_LABEL = {
  recorded: 'Votre congé a été enregistré sur le bail par l’agence.',
  superseded: 'Cette demande a été remplacée par un autre traitement du bail par l’agence.',
} as const;

export const NOTICE_UNAVAILABLE: Readonly<Record<string, string>> = {
  lease_jurisdiction_unsupported: 'La demande de congé en ligne n’est pas encore ouverte pour le régime de votre bail. Écrivez à votre agence.',
  lease_notice_not_allowed: 'Un congé ne peut plus être demandé en ligne pour ce bail : le bail n’est pas en cours, est déjà terminé ou a déjà un préavis enregistré.',
  notice_request_exists: 'Vous avez déjà une demande de congé en cours pour ce bail : suivez-la ci-dessous.',
  notice_reason_unsupported: 'Aucun motif de préavis n’est proposé pour ce bail. Écrivez à votre agence.',
};

export const NOTICE_CODES: Readonly<Record<string, string>> = {
  ...FILE_CODES,
  ...NOTICE_UNAVAILABLE,
  lease_not_found: 'Ce bail n’existe pas ou n’est plus accessible depuis votre espace.',
  notice_request_not_found: 'Cette demande de congé n’existe pas ou ne vous appartient pas.',
  notice_request_locked: 'Votre demande a déjà été accusée ou clôturée par l’agence : elle ne peut plus être retirée en ligne. Écrivez à l’agence pour en convenir avec elle.',
  notice_departure_too_early: 'La date de départ souhaitée précède la fin du préavis applicable. Choisissez une date plus tardive.',
  notice_proof_required: 'Ce motif de préavis réduit exige un justificatif : joignez-le avant d’envoyer.',
  notice_letter_unavailable: 'La lettre n’a pas pu être produite : rien n’a été enregistré. Réessayez dans quelques instants.',
  idempotency_key_reused: 'Cet envoi a déjà été enregistré avec un contenu différent. Rechargez la page pour recommencer.',
  validation_failed: 'Certains champs sont invalides : vérifiez votre saisie.',
};

export const NOTICE_WORDING: FailureWording = {
  notFound: NOTICE_CODES.notice_request_not_found,
  codes: NOTICE_CODES,
  unavailable: 'La lettre de congé n’a pas pu être produite : rien n’a été enregistré. Réessayez dans quelques instants.',
};
