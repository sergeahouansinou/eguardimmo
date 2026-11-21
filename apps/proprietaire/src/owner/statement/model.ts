import type { Money } from "../shared/model";

export interface StatementLine {
  date: string;
  reference: string;
  label: string;
  source: string;
  isReversal: boolean;
  debit: Money;
  credit: Money;
  balance: Money;
}

export interface OwnerStatement {
  mandantName: string;
  from: string;
  to: string;
  opening: Money;
  closing: Money;
  lines: StatementLine[];
}
