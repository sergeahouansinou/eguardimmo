import type { Acquisition, Loan, Schedule } from '../model';
import type { ApiAcquisition, ApiLoan, ApiSchedule } from './schemas';

export const toLoan = (api: ApiLoan): Loan => ({
  id: api.id,
  propertyId: api.property_id,
  unitId: api.unit_id,
  lenderLabel: api.lender_label,
  contractReference: api.contract_reference,
  purpose: api.purpose,
  principal: api.principal,
  nominalRate: api.nominal_rate,
  firstDueOn: api.first_due_on,
  termMonths: api.term_months,
  deferralKind: api.deferral_kind,
  deferralMonths: api.deferral_months,
  insuranceMode: api.insurance_mode,
  insuranceRate: api.insurance_rate,
  insuranceAmount: api.insurance_amount,
  replacesLoanId: api.replaces_loan_id,
  scheduleSource: api.schedule_source,
  status: api.status,
  voidReason: api.void_reason,
  repaidOn: api.repaid_on,
  hasFile: api.stored_file_id !== null,
  outstanding: { asOf: api.outstanding.as_of, amount: api.outstanding.amount },
  lockVersion: api.lock_version,
  fees: (api.fees ?? []).map((fee) => ({ id: fee.id, kind: fee.kind, paidOn: fee.paid_on, amount: fee.amount, hasFile: fee.stored_file_id !== null })),
  attestations: (api.attestations ?? []).map((item) => ({ id: item.id, incomeYear: item.income_year, interest: item.interest, insurance: item.insurance, fees: item.fees, hasFile: item.stored_file_id !== null })),
  detailed: api.fees !== undefined,
});

export const toSchedule = (api: ApiSchedule): Schedule => ({
  loanId: api.loan_id,
  source: api.source,
  currency: api.currency,
  lines: api.lines.map((line) => ({
    position: line.position,
    dueOn: line.due_on,
    payment: line.payment,
    interest: line.interest,
    principal: line.principal,
    insurance: line.insurance,
    total: line.total,
    outstandingAfter: line.outstanding_after,
  })),
  totals: api.totals,
});

export const toAcquisition = (api: ApiAcquisition): Acquisition => ({
  id: api.id,
  propertyId: api.property_id,
  unitId: api.unit_id,
  acquiredOn: api.acquired_on,
  price: api.price,
  acquisitionCosts: api.acquisition_costs,
  agencyFees: api.agency_fees,
  initialWorks: api.initial_works,
  cost: api.cost,
  hasFile: api.stored_file_id !== null,
  lockVersion: api.lock_version,
});
