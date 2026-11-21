import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { OwnerReport, OwnerReportDetail } from "./model";
import { reportDetailSchema, reportPageSchema, reportReadResponseSchema, reportResponseSchema, reportSchema } from "./schemas";

export const REPORTS_PATH = "/api/v1/owner/management-reports";

export const reportPdfPath = (id: string): string => `${REPORTS_PATH}/${segment(id)}/pdf`;

function toReport(report: z.infer<typeof reportSchema>): OwnerReport {
  return {
    id: report.id,
    number: report.number,
    status: report.status,
    agency: report.agency,
    mandantName: report.mandant.name,
    periodKind: report.period.kind,
    periodStart: report.period.start,
    periodEnd: report.period.end,
    currency: report.currency,
    sections: report.sections,
    totals: {
      openingBalance: report.totals.opening_balance,
      collected: report.totals.collected,
      fees: report.totals.fees,
      works: report.totals.works,
      payout: report.totals.payout,
      adjustments: report.totals.adjustments,
      closingBalance: report.totals.closing_balance,
    },
    supersedesId: report.supersedes_id,
    publishedAt: report.published_at,
    firstReadAt: report.first_read_at ?? null,
  };
}

function toDetail(report: z.infer<typeof reportDetailSchema>): OwnerReportDetail {
  return {
    ...toReport(report),
    units: report.units.map((unit) => ({
      id: unit.id,
      reference: unit.reference,
      propertyName: unit.property_name,
      leaseReference: unit.lease_reference ?? null,
      tenants: unit.tenants ?? [],
    })),
    receipts: report.receipts.map((receipt) => ({ number: receipt.number, issuedOn: receipt.issued_on ?? null })),
    lines: report.lines.map((line) => ({
      position: line.position,
      kind: line.kind,
      date: line.date,
      unitId: line.unit_id,
      label: line.label,
      amount: line.amount,
      direction: line.direction,
      interventionReference: line.intervention_reference,
    })),
  };
}

export async function fetchReportsPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerReport>> {
  const page = parse(reportPageSchema, await client.get(REPORTS_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toReport), nextCursor: page.meta.next_cursor };
}

export async function fetchReport(client: ApiClient, id: string): Promise<OwnerReportDetail> {
  return toDetail(parse(reportResponseSchema, await client.get(`${REPORTS_PATH}/${segment(id)}`)).data);
}

export async function markReportRead(client: ApiClient, id: string): Promise<OwnerReport> {
  return toReport(parse(reportReadResponseSchema, await client.post(`${REPORTS_PATH}/${segment(id)}/read`)).data);
}
