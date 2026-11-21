import type { Body } from '@eguardimmo/api';
import type { AcquisitionInput, AcquisitionUpdate, AttestationInput, FeeInput, LoanInput, PrepaymentInput } from '../model';

type Field = string | number | null;

function withFile(fields: Record<string, Field>, name: string, file: File | null): Body {
  const kept = Object.entries(fields).filter(([, value]) => value !== null);
  if (file === null) return Object.fromEntries(kept);
  const form = new FormData();
  for (const [key, value] of kept) form.append(key, String(value));
  form.append(name, file);
  return form;
}

export const loanBody = (input: LoanInput): Body =>
  withFile(
    {
      property_id: input.propertyId,
      unit_id: input.unitId,
      lender_label: input.lenderLabel,
      contract_reference: input.contractReference,
      purpose: input.purpose,
      principal: input.principal,
      nominal_rate: input.nominalRate,
      first_due_on: input.firstDueOn,
      term_months: input.termMonths,
      deferral_kind: input.deferralKind,
      deferral_months: input.deferralMonths,
      insurance_mode: input.insuranceMode,
      insurance_rate: input.insuranceRate,
      insurance_amount: input.insuranceAmount,
      replaces_loan_id: input.replacesLoanId,
    },
    'document',
    input.document,
  );

export const prepaymentBody = (input: PrepaymentInput): Body => ({ date: input.date, amount: input.amount, option: input.option, penalty: input.penalty, lock_version: input.lockVersion });

export const feeBody = (input: FeeInput): Body => withFile({ kind: input.kind, paid_on: input.paidOn, amount: input.amount }, 'document', input.document);

export function attestationBody(input: AttestationInput): FormData {
  const form = new FormData();
  form.append('income_year', String(input.incomeYear));
  form.append('interest', String(input.interest));
  form.append('insurance', String(input.insurance));
  form.append('fees', String(input.fees));
  form.append('document', input.document);
  return form;
}

export function scheduleImportBody(file: File, lockVersion: number): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('lock_version', String(lockVersion));
  return form;
}

export const acquisitionBody = (input: AcquisitionInput): Body =>
  withFile(
    {
      property_id: input.propertyId,
      unit_id: input.unitId,
      acquired_on: input.acquiredOn,
      price: input.price,
      acquisition_costs: input.acquisitionCosts,
      agency_fees: input.agencyFees,
      initial_works: input.initialWorks,
    },
    'document',
    input.document,
  );

export const acquisitionUpdateBody = (input: AcquisitionUpdate): Body => ({
  acquired_on: input.acquiredOn,
  price: input.price,
  acquisition_costs: input.acquisitionCosts,
  agency_fees: input.agencyFees,
  initial_works: input.initialWorks,
  lock_version: input.lockVersion,
});
