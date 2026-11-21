import type { Money } from "../shared/model";

export interface StatementPeriod {
  start: string;
  end: string;
}

export interface OwnerStatement {
  id: string;
  number: string | null;
  status: string;
  agencyName: string | null;
  period: StatementPeriod | null;
  tenantNames: string[];
  unitReference: string | null;
  propertyName: string | null;
  shareTotal: Money;
  provisionsCalled: Money;
  balance: Money;
  issuedAt: string | null;
}

export interface StatementLine {
  label: string;
  splitLabel: string;
  itemAmount: Money;
  days: number;
  share: Money;
}

export interface OwnerStatementDetail extends OwnerStatement {
  lines: StatementLine[];
}
