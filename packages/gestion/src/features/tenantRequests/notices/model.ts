import type { BadgeTone } from '@eguardimmo/ui';

export const NOTICE_STATUSES = ['submitted', 'acknowledged', 'withdrawn', 'closed'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export const NOTICE_OUTCOMES = ['recorded', 'superseded'] as const;
export type NoticeOutcome = (typeof NOTICE_OUTCOMES)[number];

export interface NoticeRequest {
  id: string;
  leaseId: string;
  partyId: string;
  status: NoticeStatus;
  reasonKey: string;
  requestedDepartureOn: string;
  earliestDepartureOn: string;
  receivedOn: string | null;
  hasProof: boolean;
  letterDocumentId: string | null;
  letterFingerprint: string | null;
  forwardingAddress: string | null;
  consentVersion: string;
  acknowledgedAt: string | null;
  withdrawnAt: string | null;
  closedOutcome: NoticeOutcome | null;
  closedAt: string | null;
  lateFlaggedAt: string | null;
  createdAt: string;
}

export interface NoticeQuery {
  cursor: string | null;
  status: NoticeStatus | null;
  leaseId: string | null;
}

export interface LeaseNoticeInput {
  receivedOn: string;
  departureOn: string | null;
  reason: string;
  replace: boolean;
}

export const isLive = (notice: NoticeRequest): boolean => notice.status === 'submitted' || notice.status === 'acknowledged';
export const isLate = (notice: NoticeRequest): boolean => notice.status === 'submitted' && notice.lateFlaggedAt !== null;

export const noticeStatusBadge: Record<NoticeStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: 'Accusé attendu', tone: 'warning' },
  acknowledged: { label: 'Accusé de réception posé', tone: 'info' },
  withdrawn: { label: 'Retirée par le locataire', tone: 'neutral' },
  closed: { label: 'Clôturée', tone: 'success' },
};

export const outcomeLabel: Record<NoticeOutcome, string> = {
  recorded: 'Congé enregistré sur le bail',
  superseded: 'Sans objet : un autre congé a été enregistré',
};

const REASON_LABELS: Readonly<Record<string, string>> = {
  standard: 'Préavis de droit commun',
  first_employment: 'Obtention d’un premier emploi',
  transfer: 'Mutation professionnelle',
  job_loss: 'Perte d’emploi',
  new_job_after_loss: 'Nouvel emploi consécutif à une perte d’emploi',
  health: 'État de santé justifiant un changement de domicile',
  minimum_income: 'Bénéficiaire du RSA ou de l’AAH',
  social_housing: 'Attribution d’un logement social',
  domestic_violence: 'Violences conjugales',
};

export const reasonLabel = (key: string): string => REASON_LABELS[key] ?? 'Motif déclaré par le locataire';
