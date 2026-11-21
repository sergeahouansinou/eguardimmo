import type { Tone } from '@eguardimmo/shell';
import type { FailureWording } from './errors';
import { FILE_CODES } from './fileErrors';
import type { CoverageState, RejectionReason, SubmissionStatus } from './insuranceSchemas';

export const COVERAGE_VIEW: Record<CoverageState, { label: string; tone: Tone }> = {
  valid: { label: 'Couverture valide', tone: 'success' },
  expiring: { label: 'À renouveler', tone: 'warning' },
  missing: { label: 'Aucune attestation valide', tone: 'danger' },
};

export const SUBMISSION_VIEW: Record<SubmissionStatus, { label: string; tone: Tone }> = {
  pending: { label: 'En attente de vérification', tone: 'info' },
  accepted: { label: 'Acceptée', tone: 'success' },
  rejected: { label: 'Refusée', tone: 'danger' },
  withdrawn: { label: 'Retirée', tone: 'neutral' },
};

export const REJECTION_LABEL: Record<RejectionReason, string> = {
  unreadable: 'Le document est illisible.',
  wrong_person: 'L’attestation n’est pas à votre nom.',
  wrong_address: 'L’adresse assurée n’est pas celle du logement loué.',
  expired: 'L’attestation est expirée.',
  missing_rental_risks: 'Les risques locatifs ne sont pas couverts.',
  other: 'Autre motif.',
};

export const INSURANCE_CODES: Readonly<Record<string, string>> = {
  ...FILE_CODES,
  lease_not_found: 'Ce bail n’existe pas ou n’est plus accessible depuis votre espace.',
  insurance_submission_not_found: 'Ce dépôt n’existe plus ou ne vous appartient pas.',
  insurance_submission_not_pending: 'Ce dépôt a déjà été accepté, refusé ou retiré : il ne peut plus être modifié.',
  insurance_submission_not_allowed: 'Le dépôt d’une attestation est impossible : le bail n’est plus en cours, ou un dépôt est déjà en attente de traitement (retirez-le avant d’en déposer un autre).',
  insurance_period_invalid: 'La période est invalide : la fin doit suivre le début et ne pas être déjà passée.',
  idempotency_key_reused: 'Cet envoi a déjà été enregistré avec un contenu différent. Rechargez la page pour recommencer.',
  validation_failed: 'Certains champs sont invalides : vérifiez votre saisie.',
};

export const INSURANCE_WORDING: FailureWording = {
  notFound: INSURANCE_CODES.insurance_submission_not_found,
  codes: INSURANCE_CODES,
};
