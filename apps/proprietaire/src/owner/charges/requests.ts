import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { OwnerStatement, OwnerStatementDetail, StatementPeriod } from "./model";
import { statementPageSchema, statementResponseSchema, statementSchema } from "./schemas";

export const STATEMENTS_PATH = "/api/v1/owner/charge-statements";

function toPeriod(period: z.infer<typeof statementSchema>["period"]): StatementPeriod | null {
  return period.start === null || period.end === null ? null : { start: period.start, end: period.end };
}

function toStatement(statement: z.infer<typeof statementSchema>): OwnerStatement {
  return {
    id: statement.id,
    number: statement.number,
    status: statement.status,
    agencyName: statement.agency_name,
    period: toPeriod(statement.period),
    tenantNames: statement.tenant_names,
    unitReference: statement.unit.reference,
    propertyName: statement.unit.property_name,
    shareTotal: statement.share_total,
    provisionsCalled: statement.provisions_called,
    balance: statement.balance,
    issuedAt: statement.issued_at,
  };
}

export async function fetchStatementsPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerStatement>> {
  const page = parse(statementPageSchema, await client.get(STATEMENTS_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toStatement), nextCursor: page.next_cursor };
}

export async function fetchStatement(client: ApiClient, id: string): Promise<OwnerStatementDetail> {
  const { data } = parse(statementResponseSchema, await client.get(`${STATEMENTS_PATH}/${segment(id)}`));
  return {
    ...toStatement(data),
    lines: data.lines.map((line) => ({ label: line.label, splitLabel: line.split_label, itemAmount: line.item_amount, days: line.days, share: line.share })),
  };
}
