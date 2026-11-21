import type { AgencyRef, Money } from "../shared/model";

export interface ReportTotals {
  openingBalance: Money | null;
  collected: Money | null;
  fees: Money | null;
  works: Money | null;
  payout: Money | null;
  adjustments: Money | null;
  closingBalance: Money | null;
}

export interface OwnerReport {
  id: string;
  number: string;
  status: string;
  agency: AgencyRef;
  mandantName: string | null;
  periodKind: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  sections: string[];
  totals: ReportTotals;
  supersedesId: string | null;
  publishedAt: string | null;
  firstReadAt: string | null;
}

export interface ReportLine {
  position: number;
  kind: string;
  date: string;
  unitId: string | null;
  label: string;
  amount: Money;
  direction: string;
  interventionReference: string | null;
}

export interface ReportUnit {
  id: string;
  reference: string | null;
  propertyName: string | null;
  leaseReference: string | null;
  tenants: string[];
}

export interface ReportReceipt {
  number: string;
  issuedOn: string | null;
}

export interface OwnerReportDetail extends OwnerReport {
  units: ReportUnit[];
  receipts: ReportReceipt[];
  lines: ReportLine[];
}
