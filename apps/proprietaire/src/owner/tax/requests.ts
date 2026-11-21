import { toTaxIncome } from "@eguardimmo/gestion";
import type { ApiClient } from "@eguardimmo/api";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { OwnerTaxStatement, OwnerTaxStatementDetail } from "./model";
import { statementPageSchema, statementResponseSchema } from "./schemas";

export const TAX_STATEMENTS_PATH = "/api/v1/owner/tax-statements";

export const taxStatementPdfPath = (id: string): string => `${TAX_STATEMENTS_PATH}/${segment(id)}/pdf`;

export async function fetchTaxStatementsPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerTaxStatement>> {
  const page = parse(statementPageSchema, await client.get(TAX_STATEMENTS_PATH, listQuery(agency, cursor)));
  return {
    items: page.data.map((statement) => ({
      id: statement.id,
      agency: statement.agency,
      incomeYear: statement.income_year,
      formVersion: statement.form_version,
      status: statement.status,
      currency: statement.currency,
      supersedesId: statement.supersedes_id,
      hasPdf: statement.has_pdf,
      publishedAt: statement.published_at,
      totals: statement.totals,
    })),
    nextCursor: page.meta.next_cursor,
  };
}

export async function fetchTaxStatement(client: ApiClient, id: string): Promise<OwnerTaxStatementDetail> {
  const { data } = parse(statementResponseSchema, await client.get(`${TAX_STATEMENTS_PATH}/${segment(id)}`));
  return {
    id: data.id,
    agency: data.agency,
    incomeYear: data.income_year,
    formVersion: data.form_version,
    status: data.status,
    currency: data.currency,
    supersedesId: data.supersedes_id,
    hasPdf: data.has_pdf,
    publishedAt: data.published_at,
    income: toTaxIncome(data.income),
  };
}
