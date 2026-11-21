import type { AgencyRef, Money } from "../shared/model";

export type UnitState = "vacant" | "occupied" | "late";

export interface HomeMandate {
  id: string;
  reference: string;
  status: string;
  isSuspended: boolean;
  startsOn: string;
  endDate: string | null;
  feeKind: string;
  feeBasisPoints: number | null;
  feeFlatAmount: Money | null;
  payoutDay: number;
}

export interface HomePayouts {
  pending: { net: Money; fees: Money } | null;
  last: { amount: Money; date: string | null; number: string | null } | null;
  nextDate: string | null;
  nextNotice: string | null;
}

export interface HomeReport {
  id: string;
  number: string;
  status: string;
  period: { kind: string; start: string; end: string };
  publishedAt: string | null;
  isRead: boolean;
}

export interface HomeUnit {
  id: string;
  reference: string;
  propertyName: string;
  label: string;
  type: string;
  surfaceHundredths: number | null;
  state: UnitState;
  tenantName: string | null;
  rent: Money | null;
  collected: Money;
}

export interface OwnerHome {
  agency: AgencyRef;
  mandantName: string;
  role: string;
  currency: string;
  mandate: HomeMandate | null;
  mandatesCount: number;
  month: { period: string; from: string; to: string; called: Money; collected: Money; arrears: { amount: Money; count: number; maxDaysLate: number } };
  payouts: HomePayouts | null;
  lastReport: HomeReport | null;
  counters: { unitsTotal: number; unitsOccupied: number; unitsVacant: number; quotesToDecide: number };
  units: HomeUnit[];
}
