import type { ApiBatch, ApiCoverage, ApiDeposit, ApiEvaluation, ApiFee, ApiHold, ApiItem, ApiPayoutRequest, ApiPeriod, ApiTransfer } from './ownerFundsSchemas';
import type { ClosedPeriod, FeeStatement, MandantAccount, PayoutAccountRequest, PayoutBatch, PayoutHold, PayoutItem, TrustCoverage, TrustDeposit, TrustTransfer } from '../model';

export const toAccount = (api: ApiEvaluation): MandantAccount => ({
  mandantId: api.mandant_party_id,
  payable: api.payable,
  inTransit: api.in_transit,
  calledNotCollected: api.called_not_collected,
  feesDue: api.fees_due,
  feesEstimated: api.fees_estimated,
  reserve: api.reserve,
  fullHold: api.full_hold,
  netPayable: api.net_payable,
  bankLast4: api.bank_last4,
  exclusionReason: api.exclusion_reason,
});

export const toItem = (api: ApiItem): PayoutItem => ({
  id: api.id,
  batchId: api.batch_id,
  mandantId: api.mandant_party_id,
  status: api.status,
  exclusionReason: api.exclusion_reason,
  netAmount: api.net_amount,
  feesSettled: api.fees_settled_amount,
  bankLast4: api.bank_last4,
  executedOn: api.executed_on,
  bankReference: api.bank_reference,
  executedSolo: api.executed_solo,
  failureReason: api.failure_reason,
  lockVersion: api.lock_version,
});

export const toBatch = (api: ApiBatch): PayoutBatch => ({
  id: api.id,
  number: api.number,
  status: api.status,
  currency: api.currency,
  lockVersion: api.lock_version,
  secondApproverRequired: api.second_approver_required,
  validatedAt: api.validated_at,
  cancelledAt: api.cancelled_at,
  cancelReason: api.cancel_reason,
  createdAt: api.created_at,
  items: api.items === undefined ? null : api.items.map(toItem),
});

export const toHold = (api: ApiHold): PayoutHold => ({
  id: api.id,
  mandantId: api.mandant_party_id,
  kind: api.kind,
  amount: api.amount,
  reason: api.reason,
  comment: api.comment,
  releasedAt: api.released_at,
  createdAt: api.created_at,
});

export const toFee = (api: ApiFee): FeeStatement => ({
  id: api.id,
  mandateId: api.mandate_id,
  mandantId: api.mandant_party_id,
  month: api.month,
  baseRent: api.base_rent,
  baseCharges: api.base_charges,
  feeKind: api.fee_kind,
  rateBp: api.rate_bp,
  minimumApplied: api.minimum_applied,
  feeNet: api.fee_net,
  taxAmount: api.tax_amount,
  feeTotal: api.fee_total,
  carriedNet: api.carried_net,
  invoiceId: api.invoice_id,
  creditNoteId: api.credit_note_id,
});

export const toCoverage = (api: ApiCoverage): TrustCoverage => ({
  trustBank: api.trust_bank,
  ownerPayable: api.owner_payable,
  payoutsInTransit: api.payouts_in_transit,
  securityDeposits: api.security_deposits,
  tenantAdvances: api.tenant_advances,
  required: api.required,
  surplus: api.surplus,
  covered: api.covered,
});

export const toDeposit = (api: ApiDeposit): TrustDeposit => ({
  id: api.id,
  status: api.status,
  amount: api.amount,
  executedOn: api.executed_on,
  bankReference: api.bank_reference,
  secondApproverRequired: api.second_approver_required,
  confirmedAt: api.confirmed_at,
  confirmedSolo: api.confirmed_solo,
  createdAt: api.created_at,
});

export const toTransfer = (api: ApiTransfer): TrustTransfer => ({
  id: api.id,
  direction: api.direction,
  amount: api.amount,
  executedOn: api.executed_on,
  bankReference: api.bank_reference,
});

export const toPeriod = (api: ApiPeriod): ClosedPeriod => ({ id: api.id, month: api.month, closedAt: api.closed_at });

export const toPayoutRequest = (api: ApiPayoutRequest): PayoutAccountRequest => ({
  id: api.id,
  mandantId: api.mandant_party_id,
  status: api.status,
  bankLast4: api.bank_last4,
  holderName: api.holder_name,
  hasProof: api.proof_file_id !== null,
  requestedAt: api.created_at,
  decidedAt: api.decided_at,
  rejectReason: api.reject_reason,
  lockVersion: api.lock_version,
});
