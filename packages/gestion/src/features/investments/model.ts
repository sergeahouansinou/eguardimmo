import type { Currency } from '../../format/money';

export interface Money {
  amount: number;
  currency: Currency;
}

export const LOAN_PURPOSES = ['acquisition', 'works', 'refinancing', 'other'] as const;
export type LoanPurpose = (typeof LOAN_PURPOSES)[number];

export const DEFERRAL_KINDS = ['none', 'partial', 'total'] as const;
export type DeferralKind = (typeof DEFERRAL_KINDS)[number];

export const INSURANCE_MODES = ['none', 'initial_capital', 'outstanding_capital', 'fixed'] as const;
export type InsuranceMode = (typeof INSURANCE_MODES)[number];

export const LOAN_STATUSES = ['active', 'repaid', 'archived', 'voided'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const SCHEDULE_SOURCES = ['computed', 'imported'] as const;
export type ScheduleSource = (typeof SCHEDULE_SOURCES)[number];

export const PREPAYMENT_OPTIONS = ['reduce_term', 'reduce_payment'] as const;
export type PrepaymentOption = (typeof PREPAYMENT_OPTIONS)[number];

export const FEE_KINDS = ['dossier', 'guarantee', 'mortgage', 'prepayment_penalty', 'other'] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export interface LoanFee {
  id: string;
  kind: FeeKind;
  paidOn: string;
  amount: Money;
  hasFile: boolean;
}

export interface LoanAttestation {
  id: string;
  incomeYear: number;
  interest: Money;
  insurance: Money;
  fees: Money;
  hasFile: boolean;
}

export interface Loan {
  id: string;
  propertyId: string;
  unitId: string | null;
  lenderLabel: string;
  contractReference: string | null;
  purpose: LoanPurpose;
  principal: Money;
  nominalRate: string;
  firstDueOn: string;
  termMonths: number;
  deferralKind: DeferralKind;
  deferralMonths: number;
  insuranceMode: InsuranceMode;
  insuranceRate: string | null;
  insuranceAmount: Money | null;
  replacesLoanId: string | null;
  scheduleSource: ScheduleSource;
  status: LoanStatus;
  voidReason: string | null;
  repaidOn: string | null;
  hasFile: boolean;
  outstanding: { asOf: string; amount: Money };
  lockVersion: number;
  fees: LoanFee[];
  attestations: LoanAttestation[];
  detailed: boolean;
}

export interface ScheduleLine {
  position: number;
  dueOn: string;
  payment: Money;
  interest: Money;
  principal: Money;
  insurance: Money;
  total: Money;
  outstandingAfter: Money;
}

export interface Schedule {
  loanId: string;
  source: ScheduleSource;
  currency: Currency;
  lines: ScheduleLine[];
  totals: { interest: Money; insurance: Money; principal: Money };
}

export interface Acquisition {
  id: string;
  propertyId: string;
  unitId: string | null;
  acquiredOn: string;
  price: Money;
  acquisitionCosts: Money;
  agencyFees: Money;
  initialWorks: Money;
  cost: Money;
  hasFile: boolean;
  lockVersion: number;
}

export interface LoanFilters {
  propertyId: string | null;
  status: LoanStatus | null;
}

export const NO_LOAN_FILTERS: LoanFilters = { propertyId: null, status: null };

export interface LoanInput {
  propertyId: string;
  unitId: string | null;
  lenderLabel: string;
  contractReference: string | null;
  purpose: LoanPurpose;
  principal: number;
  nominalRate: string;
  firstDueOn: string;
  termMonths: number;
  deferralKind: DeferralKind;
  deferralMonths: number;
  insuranceMode: InsuranceMode;
  insuranceRate: string | null;
  insuranceAmount: number | null;
  replacesLoanId: string | null;
  document: File | null;
}

export interface PrepaymentInput {
  date: string;
  amount: number;
  option: PrepaymentOption;
  penalty: number;
  lockVersion: number;
}

export interface FeeInput {
  kind: FeeKind;
  paidOn: string;
  amount: number;
  document: File | null;
}

export interface AttestationInput {
  incomeYear: number;
  interest: number;
  insurance: number;
  fees: number;
  document: File;
}

export interface AcquisitionInput {
  propertyId: string;
  unitId: string | null;
  acquiredOn: string;
  price: number;
  acquisitionCosts: number;
  agencyFees: number;
  initialWorks: number;
  document: File | null;
}

export interface AcquisitionUpdate {
  acquiredOn: string;
  price: number;
  acquisitionCosts: number;
  agencyFees: number;
  initialWorks: number;
  lockVersion: number;
}
