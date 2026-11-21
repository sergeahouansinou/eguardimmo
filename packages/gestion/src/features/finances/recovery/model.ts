import type { InstallmentStatus, Money, Page } from '../rent/model';

export type { Money, Page };

export const CASE_STATUSES = ['open', 'in_plan', 'closed', 'uncollectible'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const MANUAL_ACT_TYPES = ['reminder', 'formal_notice', 'call', 'email', 'visit', 'payment_plan', 'bailiff_action', 'note'] as const;
export type ManualActType = (typeof MANUAL_ACT_TYPES)[number];

export const ACT_TYPES = [...MANUAL_ACT_TYPES, 'transmission', 'revocation'] as const;
export type ActType = (typeof ACT_TYPES)[number];

export const TRANSMISSION_STATES = ['active', 'expired', 'revoked'] as const;
export type TransmissionState = (typeof TRANSMISSION_STATES)[number];

export const DEFAULT_VALID_DAYS = 7;
export const MAX_VALID_DAYS = 30;

export const RECEIVABLE_TYPES = ['installment', 'invoice'] as const;
export type ReceivableType = (typeof RECEIVABLE_TYPES)[number];

export interface ReceivableIds {
  installmentIds: readonly string[];
  invoiceIds: readonly string[];
}

export interface UnpaidItem {
  type: ReceivableType;
  itemId: string;
  reference: string | null;
  leaseId: string;
  leaseReference: string | null;
  partyId: string | null;
  partyName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedOn: string | null;
  dueDate: string;
  daysOverdue: number;
  status: InstallmentStatus | null;
  total: Money;
  outstanding: Money;
  caseRef: { id: string; number: string } | null;
}

export interface UnpaidPageResult {
  items: UnpaidItem[];
  nextAfter: string | null;
}

export interface UnpaidQuery {
  leaseId?: string;
  after?: string | null;
  perPage?: number;
}

export interface CaseSummary {
  id: string;
  number: string;
  status: CaseStatus;
  leaseId: string;
  leaseReference: string | null;
  debtorId: string;
  debtorName: string | null;
  currency: Money['currency'];
  openedOn: string;
  closedOn: string | null;
  statusReason: string | null;
  itemsCount: number;
  outstanding: Money;
}

export interface CaseItem {
  id: string;
  type: ReceivableType;
  itemId: string;
  reference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedOn: string | null;
  dueDate: string;
  total: Money;
  amountDueAtInclusion: Money;
  outstanding: Money | null;
  includedAt: string;
  removedAt: string | null;
}

export interface CaseBundleSummary {
  id: string;
  number: string;
  generatedOn: string;
  totalDue: Money;
  piecesCount: number;
  transmissionsCount: number | null;
}

export interface RecoveryCase extends CaseSummary {
  items: CaseItem[];
  bundles: CaseBundleSummary[];
}

export interface CaseQuery {
  status?: CaseStatus;
  leaseId?: string;
  debtorId?: string;
  cursor?: string | null;
  perPage?: number;
}

export interface RecoveryAct {
  id: string;
  caseId: string;
  type: ActType;
  performedOn: string;
  authorUserId: string | null;
  reference: string | null;
  note: string | null;
  recipientName: string | null;
  piecesCount: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ActQuery {
  cursor?: string | null;
  perPage?: number;
}

export interface ActInput {
  type: ManualActType;
  performedOn: string;
  note: string;
  reference: string;
}

export interface BundlePiece {
  kind: string;
  label: string;
  number: string | null;
  fileName: string;
  sha256: string;
}

export interface Transmission {
  id: string;
  bundleId: string;
  recipientPartyId: string;
  recipientEmail: string;
  state: TransmissionState;
  expiresAt: string;
  revokedAt: string | null;
  sentAt: string | null;
  firstDownloadedAt: string | null;
  downloadCount: number;
  replacesId: string | null;
  createdAt: string;
}

export interface Bundle {
  id: string;
  caseId: string;
  number: string;
  generatedOn: string;
  sizeBytes: number;
  sha256: string;
  totalDue: Money;
  calledTotal: Money;
  pieces: BundlePiece[];
  transmissions: Transmission[];
}

export interface Bailiff {
  id: string;
  name: string;
  email: string | null;
}

export interface TransmitInput {
  recipientPartyId: string;
  validDays: number;
}

export interface OpenCaseInput extends ReceivableIds {
  leaseId: string;
  debtorPartyId: string;
}

export interface RecoveryPermissions {
  write: boolean;
}
