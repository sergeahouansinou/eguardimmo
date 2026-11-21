import type { ApiClient } from "@eguardimmo/api";
import type { Period } from "@/features/confie/data/period";
import { downloadName } from "../shared/download";
import { parse } from "../shared/parse";
import type { OwnerStatement } from "./model";
import { statementSchema } from "./schemas";

export const STATEMENT_PATH = "/api/v1/owner/statement";

export function statementQuery(agency: string, period: Period, format: "json" | "csv"): string {
  return new URLSearchParams({ from: period.from, to: period.to, agency, format }).toString();
}

export const statementCsvPath = (agency: string, period: Period): string => `${STATEMENT_PATH}?${statementQuery(agency, period, "csv")}`;

export const statementFilename = (mandantName: string, period: Period): string =>
  downloadName(`releve-compte-${mandantName.replaceAll(".", " ")}-${period.from}-${period.to}.csv`);

export async function fetchStatement(client: ApiClient, agency: string, period: Period): Promise<OwnerStatement> {
  const { data } = parse(statementSchema, await client.get(STATEMENT_PATH, { from: period.from, to: period.to, agency }));
  return {
    mandantName: data.mandant.name,
    from: data.from,
    to: data.to,
    opening: data.opening_balance,
    closing: data.closing_balance,
    lines: data.lines.map((line) => ({
      date: line.date,
      reference: line.reference,
      label: line.label,
      source: line.source,
      isReversal: line.is_reversal,
      debit: line.debit,
      credit: line.credit,
      balance: line.balance,
    })),
  };
}
