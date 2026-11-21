import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { OwnerInvoice, OwnerInvoiceDetail } from "./model";
import { invoiceDetailSchema, invoicePageSchema, invoiceResponseSchema, invoiceSchema } from "./schemas";

export const INVOICES_PATH = "/api/v1/owner/invoices";

export const invoiceDownloadPath = (id: string): string => `${INVOICES_PATH}/${segment(id)}/download`;

function toInvoice(invoice: z.infer<typeof invoiceSchema>): OwnerInvoice {
  return {
    id: invoice.id,
    kind: invoice.kind,
    status: invoice.status,
    number: invoice.number,
    agency: invoice.agency,
    creditedInvoiceId: invoice.credited_invoice_id,
    issuedOn: invoice.issued_on,
    dueOn: invoice.due_on,
    serviceFrom: invoice.service_from,
    serviceTo: invoice.service_to,
    currency: invoice.currency,
    totalNet: invoice.total_net,
    totalTax: invoice.total_tax,
    totalGross: invoice.total_gross,
    hasPdf: invoice.has_pdf,
  };
}

function toDetail(invoice: z.infer<typeof invoiceDetailSchema>): OwnerInvoiceDetail {
  return {
    ...toInvoice(invoice),
    lines: invoice.lines.map((line) => ({
      position: line.position,
      description: line.description,
      quantityMilli: line.quantity_milli,
      unitPrice: line.unit_price,
      netAmount: line.net_amount,
      taxCategory: line.tax_category,
      taxRatePcm: line.tax_rate_pcm,
    })),
    taxes: invoice.taxes.map((tax) => ({ category: tax.category, ratePcm: tax.rate_pcm, baseAmount: tax.base_amount, taxAmount: tax.tax_amount })),
  };
}

export async function fetchInvoicesPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerInvoice>> {
  const page = parse(invoicePageSchema, await client.get(INVOICES_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toInvoice), nextCursor: page.meta.next_cursor };
}

export async function fetchInvoice(client: ApiClient, id: string): Promise<OwnerInvoiceDetail> {
  return toDetail(parse(invoiceResponseSchema, await client.get(`${INVOICES_PATH}/${segment(id)}`)).data);
}
