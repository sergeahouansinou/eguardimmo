import type { TaxIncome } from "@eguardimmo/gestion";
import type { AgencyRef, Money } from "../shared/model";

export type TaxStatementStatus = "published" | "superseded";

export interface OwnerTaxStatement {
  id: string;
  agency: AgencyRef;
  incomeYear: number;
  formVersion: string;
  status: TaxStatementStatus;
  currency: string;
  supersedesId: string | null;
  hasPdf: boolean;
  publishedAt: string | null;
  totals: { code: string; amount: Money }[];
}

export interface OwnerTaxStatementDetail extends Omit<OwnerTaxStatement, "totals"> {
  income: TaxIncome;
}
