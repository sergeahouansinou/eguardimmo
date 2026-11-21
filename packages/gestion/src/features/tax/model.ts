import type { Currency } from '../../format/money';
import type { Money } from '../investments/model';

export const SUMMARY_STATUSES = ['final', 'published', 'superseded'] as const;
export type SummaryStatus = (typeof SUMMARY_STATUSES)[number];

export const LINE_STATUSES = ['computed', 'proposed', 'to_complete', 'conflict', 'total'] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export interface TaxSource {
  kind: string;
  ref: string | null;
  amount: Money;
}

export interface TaxLine {
  code: string;
  label: string;
  status: LineStatus;
  exact: Money;
  rounded: Money;
  sources: TaxSource[];
  sourcesTruncated: boolean;
}

export interface TaxProperty {
  propertyId: string | null;
  name: string;
  premises: number;
  coOwners: { shareBp: number; nature: string }[];
  lines: TaxLine[];
}

export interface TaxMicro {
  grossReceipts: Money;
  allowanceBp: number;
  baseAfterAllowance: Money;
  threshold: Money;
  realBase: Money;
}

export interface TaxDeficit {
  result: Money;
  interestPart: Money;
  otherPart: Money;
  imputableOnGlobalIncome: Money;
  carriedForward: Money;
}

export interface TaxWarning {
  code: string;
  propertyId: string | null;
  message: string | null;
}

export interface TaxBlocker {
  code: string;
  propertyId: string;
}

export interface TaxIncome {
  incomeYear: number;
  formVersion: string;
  currency: Currency;
  provisional: boolean;
  householdComplete: boolean;
  properties: TaxProperty[];
  totals: TaxLine[];
  micro: TaxMicro;
  deficit: TaxDeficit | null;
  warnings: TaxWarning[];
  warning: string;
  mentions: string[];
  blockers: TaxBlocker[];
}

export interface TaxTotal {
  code: string;
  amount: Money;
}

export interface TaxSummary {
  id: string;
  scope: 'organization' | 'mandant';
  mandantPartyId: string | null;
  incomeYear: number;
  formVersion: string;
  status: SummaryStatus;
  currency: Currency;
  templateVersion: string;
  supersedesId: string | null;
  rectificationReason: string | null;
  hasPdf: boolean;
  publishedAt: string | null;
  lockVersion: number;
  createdAt: string | null;
  totals: TaxTotal[];
  income: TaxIncome | null;
}

export interface TaxPage {
  items: TaxSummary[];
  nextCursor: string | null;
}

export interface TaxQuery {
  incomeYear: number | null;
  mandantId: string | null;
  cursor: string | null;
}

export interface MandantChoice {
  partyId: string;
  name: string;
}

export interface GenerationResult {
  mandantId: string;
  outcome: 'created' | 'replayed' | 'failed';
  statement: TaxSummary | null;
  error: { code: string; status: number; detail: string } | null;
}

export interface RectificationInput {
  reason: string;
  lockVersion: number;
}

export const SUPPORTED_YEAR = 2025;
export const TOTAL_CODES = ['215', '240', '250', '261', '263'] as const;
