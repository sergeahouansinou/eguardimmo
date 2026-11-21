import type { Money } from '../rent/model';

export type { Money };

export const BATCH_STATUSES = ['draft', 'validated', 'executed', 'cancelled'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const ITEM_STATUSES = ['included', 'excluded', 'pending', 'paid', 'failed', 'returned'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const EXCLUSION_REASONS = [
  'no_payout_account',
  'account_recently_changed',
  'negative_balance',
  'active_hold',
  'below_minimum',
  'before_payout_day',
  'trust_funds_gap',
  'stale',
  'invoice_pdf_unavailable',
  'invoice_not_issuable',
  'nothing_to_pay',
  'manual',
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const HOLD_KINDS = ['full', 'reserve'] as const;
export type HoldKind = (typeof HOLD_KINDS)[number];

export const HOLD_REASONS = ['dispute', 'mandate_ending', 'works_reserve', 'succession', 'other'] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const DEPOSIT_STATUSES = ['pending', 'confirmed'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const FEE_KINDS = ['percentage', 'flat'] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export const PAYOUT_REQUEST_STATUSES = ['awaiting_code', 'pending', 'approved', 'rejected', 'withdrawn', 'expired'] as const;
export type PayoutRequestStatus = (typeof PAYOUT_REQUEST_STATUSES)[number];

export interface PayoutAccountRequest {
  id: string;
  mandantId: string;
  status: PayoutRequestStatus;
  bankLast4: string | null;
  holderName: string | null;
  hasProof: boolean;
  requestedAt: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
  lockVersion: number;
}

export interface PayoutRequestQuery {
  cursor?: string | null;
  status?: PayoutRequestStatus;
  mandantId?: string;
}

export interface ApproveRequestInput {
  lockVersion: number;
  iban: string;
  holderName: string;
}

export interface PayoutProof {
  blob: Blob;
  extension: 'pdf' | 'jpg' | 'png';
}

export interface MandantAccount {
  mandantId: string;
  payable: Money;
  inTransit: Money;
  calledNotCollected: Money;
  feesDue: Money;
  feesEstimated: Money;
  reserve: Money;
  fullHold: boolean;
  netPayable: Money;
  bankLast4: string | null;
  exclusionReason: ExclusionReason | null;
}

export interface PayoutPreview {
  accounts: MandantAccount[];
  limit: number;
  truncated: boolean;
}

export interface PayoutItem {
  id: string;
  batchId: string;
  mandantId: string;
  status: ItemStatus;
  exclusionReason: ExclusionReason | null;
  netAmount: Money;
  feesSettled: Money;
  bankLast4: string | null;
  executedOn: string | null;
  bankReference: string | null;
  executedSolo: boolean;
  failureReason: string | null;
  lockVersion: number;
}

export interface PayoutBatch {
  id: string;
  number: string | null;
  status: BatchStatus;
  currency: string;
  lockVersion: number;
  secondApproverRequired: boolean;
  validatedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string | null;
  items: PayoutItem[] | null;
}

export interface PayoutHold {
  id: string;
  mandantId: string;
  kind: HoldKind;
  amount: Money | null;
  reason: HoldReason;
  comment: string | null;
  releasedAt: string | null;
  createdAt: string | null;
}

export interface FeeStatement {
  id: string;
  mandateId: string;
  mandantId: string;
  month: string;
  baseRent: Money;
  baseCharges: Money;
  feeKind: FeeKind;
  rateBp: number | null;
  minimumApplied: boolean;
  feeNet: Money;
  taxAmount: Money;
  feeTotal: Money;
  carriedNet: Money;
  invoiceId: string | null;
  creditNoteId: string | null;
}

export interface TrustCoverage {
  trustBank: Money;
  ownerPayable: Money;
  payoutsInTransit: Money;
  securityDeposits: Money;
  tenantAdvances: Money;
  required: Money;
  surplus: Money;
  covered: boolean;
}

export interface TrustDeposit {
  id: string;
  status: DepositStatus;
  amount: Money;
  executedOn: string;
  bankReference: string;
  secondApproverRequired: boolean;
  confirmedAt: string | null;
  confirmedSolo: boolean;
  createdAt: string | null;
}

export interface TrustTransfer {
  id: string;
  direction: 'withdraw_fees' | 'deposit';
  amount: Money;
  executedOn: string;
  bankReference: string | null;
}

export interface ClosedPeriod {
  id: string;
  month: string;
  closedAt: string;
}

export interface CloseResult {
  period: ClosedPeriod;
  warnings: string[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface OwnerFundsPermissions {
  available: boolean;
  prepare: boolean;
  sensitive: boolean;
  export: boolean;
}

export interface HoldQuery {
  cursor?: string | null;
  mandantId?: string;
  activeOnly?: boolean;
}

export interface FeeQuery {
  cursor?: string | null;
  month?: string;
  mandantId?: string;
}

export interface PlaceHoldInput {
  mandantId: string;
  kind: HoldKind;
  amount: string;
  currency: Money['currency'];
  reason: HoldReason;
  comment: string;
}

export interface ExecuteInput {
  executedOn: string;
  reference: string;
  acknowledgeAccountChange: boolean;
}

export interface TransferInput {
  amount: string;
  currency: Money['currency'];
  executedOn: string;
  reference: string;
}
