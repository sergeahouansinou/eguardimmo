import type { Money } from '../finances/rent/model';

export type { Money };

export const REPORT_STATUSES = ['draft', 'generated', 'published', 'superseded', 'discarded'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PERIOD_KINDS = ['monthly', 'quarterly', 'custom'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const SECTIONS = ['rent', 'fees', 'payout', 'arrears', 'works', 'receipts'] as const;
export type Section = (typeof SECTIONS)[number];

export const LINE_KINDS = ['rent_called', 'rent_collected', 'advance', 'fee', 'fee_vat', 'works', 'payout', 'adjustment', 'arrears'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const AGING_BUCKETS = ['0_30', '31_60', '61_90', 'over_90'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export interface DatePeriod {
  start: string;
  end: string;
}

export interface RentCard {
  month: string;
  currency: Money['currency'];
  rentCalled: Money;
  rentCollected: Money;
  collectionRateBp: number | null;
}

export interface AgencyKpis extends RentCard {
  feesNet: Money;
  periodClosed: boolean;
}

export interface LandlordHome extends RentCard {
  leasesEnding: number;
  vacantUnits: number;
  openInterventions: number;
  certificatesToRenew: number;
}

export interface PayoutMandant {
  partyId: string;
  name: string | null;
  payable: Money;
}

export interface AgencyPayouts {
  payableTotal: Money;
  inTransitTotal: Money;
  mandantsWithPayable: number;
  topMandants: PayoutMandant[];
  activeHolds: number;
  pendingItems: number;
}

export interface AgencyAlerts {
  mandatesToRenew: { count: number; next: { id: string; reference: string; endsOn: string }[] };
  certificatesToRenew: number;
  reportsDue: { period: DatePeriod; count: number; mandantIds: string[] };
}

export interface Aging {
  asOf: string;
  buckets: { bucket: AgingBucket; amount: Money; count: number }[];
  total: Money;
  count: number;
}

export interface ReportOptions {
  letterhead: boolean;
  reminderDetail: boolean;
  receiptsAttached: boolean;
}

export interface ReportTotals {
  openingBalance: Money | null;
  collected: Money | null;
  fees: Money | null;
  works: Money | null;
  payout: Money | null;
  adjustments: Money | null;
  closingBalance: Money | null;
}

export interface ReportLine {
  position: number;
  kind: LineKind;
  date: string;
  unitId: string | null;
  leaseId: string | null;
  mandateId: string | null;
  label: string;
  amount: Money;
  direction: 'credit' | 'debit';
}

export interface ReportUnit {
  id: string;
  reference: string;
  propertyName: string | null;
  tenants: string[];
}

export interface ReportMandate {
  id: string;
  reference: string;
  feeKind: string | null;
  feeBasisPoints: number | null;
}

export interface Report {
  id: string;
  number: string | null;
  status: ReportStatus;
  mandantId: string;
  mandantName: string | null;
  period: DatePeriod & { kind: PeriodKind };
  currency: Money['currency'];
  sections: Section[];
  options: ReportOptions;
  totals: ReportTotals;
  templateVersion: string | null;
  supersedesId: string | null;
  rectificationReason: string | null;
  scheduledFor: string | null;
  notify: boolean;
  generatedAt: string | null;
  publishedAt: string | null;
  firstReadAt: string | null;
  lockVersion: number;
  lines: ReportLine[] | null;
  units: ReportUnit[];
  mandates: ReportMandate[];
}

export interface DueMandant {
  partyId: string;
  name: string;
}

export interface ReportPage {
  items: Report[];
  nextCursor: string | null;
  due: { period: DatePeriod; mandants: DueMandant[] } | null;
}

export interface ReportQuery {
  cursor: string | null;
  status?: ReportStatus;
  mandantId?: string;
}

export interface MandantOption {
  partyId: string;
  name: string;
}

export interface CreateReportsInput {
  kind: PeriodKind;
  start: string;
  end: string;
  mandantIds: readonly string[];
  sections: readonly Section[];
  options: ReportOptions;
  generate: boolean;
  notify: boolean;
}

export interface ReportFailure {
  code: string;
  status: number;
  detail: string;
}

export interface CreateOutcome {
  mandantId: string;
  outcome: 'created' | 'replayed' | 'failed';
  report: Report | null;
  error: ReportFailure | null;
}

export interface ReportChanges {
  sections?: readonly Section[];
  options?: Partial<ReportOptions>;
  notify?: boolean;
}

export interface StatementLine {
  date: string;
  reference: string | null;
  label: string;
  source: string;
  isReversal: boolean;
  debit: Money;
  credit: Money;
  balance: Money;
}

export interface Statement {
  mandantId: string;
  mandantName: string | null;
  from: string;
  to: string;
  openingBalance: Money;
  closingBalance: Money;
  lines: StatementLine[];
}

export interface ReportingPermissions {
  cards: boolean;
  agency: boolean;
  publish: boolean;
  export: boolean;
}
