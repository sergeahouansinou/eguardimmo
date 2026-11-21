import type { Currency } from '../../../../format/money';
import type { FeeKind, Money } from '../model';

export const FEE_BASES = ['rent', 'rent_and_charges'] as const;
export type FeeBase = (typeof FEE_BASES)[number];

export const FEE_TAX_MODES = ['excl_tax', 'incl_tax'] as const;
export type FeeTaxMode = (typeof FEE_TAX_MODES)[number];

export const AMOUNT_SOURCES = ['statement', 'computed', 'simulation'] as const;
export type AmountSource = (typeof AMOUNT_SOURCES)[number];

export const MONTHS_MIN = 1;
export const MONTHS_MAX = 12;
export const MONTHS_DEFAULT = 3;
export const MAX_BASIS_POINTS = 10_000;
export const MAX_AMOUNT_MINOR = 100_000_000_000;

export interface FeeProposal {
  mandateId: string;
  kind: FeeKind;
  basisPoints: number | null;
  flatAmount: number | null;
  base: FeeBase;
  minimumAmount: number;
  taxMode: FeeTaxMode;
  months: number;
}

export interface FeeMandateTerms {
  kind: FeeKind;
  basisPoints: number | null;
  flatAmount: number | null;
  base: FeeBase | null;
  minimumAmount: number;
  taxMode: FeeTaxMode;
}

export interface FeeMandateOption {
  id: string;
  reference: string;
  mandantName: string;
  currency: Currency;
  terms: FeeMandateTerms | null;
}

export interface SimulatedAmounts {
  source: AmountSource;
  feeNet: Money;
  taxAmount: Money;
  feeTotal: Money;
  minimumApplied: boolean;
}

export interface SimulationMonth {
  month: string;
  baseRent: Money;
  baseCharges: Money;
  current: SimulatedAmounts | null;
  simulated: SimulatedAmounts;
  difference: { feeNet: Money; feeTotal: Money } | null;
}

export interface SimulationTotals {
  simulatedNet: Money;
  simulatedTotal: Money;
  currentNet: Money | null;
  currentTotal: Money | null;
  differenceNet: Money | null;
  differenceTotal: Money | null;
}

export interface FeeSimulation {
  mandateId: string;
  monthsRequested: number;
  monthsReturned: number;
  currency: Currency;
  months: SimulationMonth[];
  noClosedPeriod: boolean;
  totals: SimulationTotals | null;
}
