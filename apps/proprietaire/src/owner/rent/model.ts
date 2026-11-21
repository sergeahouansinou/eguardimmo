import type { AgencyRef, CursorPage, Money } from "../shared/model";

export interface RentAmounts {
  called: Money;
  collected: Money;
  fees: Money;
  works: Money;
  net: Money;
}

export interface RentUnitRow {
  id: string;
  reference: string;
  propertyName: string;
  amounts: RentAmounts;
  arrears: Money | null;
}

export interface RentMandant {
  agency: AgencyRef;
  mandantName: string | null;
  role: string;
  currency: string;
  units: RentUnitRow[];
  others: RentAmounts;
  totals: RentAmounts;
}

export interface RentMonth {
  month: string;
  mandants: RentMandant[];
}

export interface Payout {
  id: string;
  number: string;
  status: string;
  date: string | null;
  amount: Money;
  bankLast4: string | null;
  agency: AgencyRef;
  mandantName: string | null;
}

export interface UpcomingPayout {
  agency: AgencyRef;
  mandantName: string | null;
  date: string | null;
  notice: { code: string; message: string } | null;
}

export interface PayoutsPage extends CursorPage<Payout> {
  upcoming: UpcomingPayout[];
}
