import type { BadgeTone } from '@eguardimmo/ui';

export const INSURANCE_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
export type InsuranceStatus = (typeof INSURANCE_STATUSES)[number];

export const REJECTION_REASONS = ['unreadable', 'wrong_person', 'wrong_address', 'expired', 'missing_rental_risks', 'other'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const COVERAGE_STATES = ['valid', 'expiring', 'missing'] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export const MAX_NOTE_LENGTH = 500;

export interface InsuranceSubmission {
  id: string;
  leaseId: string;
  partyId: string;
  storedFileId: string;
  insurer: string;
  policyNumber: string;
  startsOn: string;
  endsOn: string;
  status: InsuranceStatus;
  rejectionReason: RejectionReason | null;
  note: string | null;
  decidedAt: string | null;
  certificateId: string | null;
  createdAt: string;
}

export interface InsuranceOverview {
  coverage: { state: CoverageState; endsOn: string | null };
  submissions: InsuranceSubmission[];
}

export interface InsuranceQuery {
  cursor: string | null;
  status: InsuranceStatus | null;
}

export const insuranceStatusBadge: Record<InsuranceStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'À examiner', tone: 'warning' },
  accepted: { label: 'Acceptée', tone: 'success' },
  rejected: { label: 'Refusée', tone: 'danger' },
  withdrawn: { label: 'Retirée par le locataire', tone: 'neutral' },
};

export const rejectionReasonLabel: Record<RejectionReason, string> = {
  unreadable: 'Document illisible',
  wrong_person: 'Attestation au nom d’une autre personne',
  wrong_address: 'Adresse du logement différente',
  expired: 'Attestation expirée',
  missing_rental_risks: 'Risques locatifs non couverts',
  other: 'Autre motif',
};

export const coverageBadge: Record<CoverageState, { label: string; tone: BadgeTone }> = {
  valid: { label: 'Couverture valide', tone: 'success' },
  expiring: { label: 'Couverture bientôt échue', tone: 'warning' },
  missing: { label: 'Aucune couverture valide', tone: 'danger' },
};
