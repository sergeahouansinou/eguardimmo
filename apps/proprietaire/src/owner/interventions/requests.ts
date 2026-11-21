import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { ApprovalDecision, ApprovalOutcome, InterventionApproval, OwnerIntervention, OwnerInterventionDetail } from "./model";
import { decisionResponseSchema, interventionDetailSchema, interventionPageSchema, interventionResponseSchema, interventionSchema } from "./schemas";

export const INTERVENTIONS_PATH = "/api/v1/owner/interventions";

export const interventionFilePath = (interventionId: string, fileId: string): string => `${INTERVENTIONS_PATH}/${segment(interventionId)}/files/${segment(fileId)}`;

function toIntervention(value: z.infer<typeof interventionSchema>): OwnerIntervention {
  return {
    id: value.id,
    reference: value.reference,
    status: value.status,
    priority: value.priority,
    natureLabel: value.nature.label,
    title: value.title,
    agency: value.agency,
    propertyName: value.place.property_name,
    unitReference: value.place.unit_reference,
    commonArea: value.place.common_area,
    supplierName: value.supplier?.name ?? null,
    responsibility: value.responsibility,
    approvalBasis: value.approval_basis,
    estimatedAmount: value.estimated_amount,
    reportedOn: value.reported_on,
    dueOn: value.due_on,
    completedOn: value.completed_on,
    closedAt: value.closed_at,
  };
}

function toDetail(value: z.infer<typeof interventionDetailSchema>): OwnerInterventionDetail {
  return {
    ...toIntervention(value),
    description: value.description,
    emergencyReason: value.emergency_reason,
    visits: value.visits.map((visit) => ({ id: visit.id, scheduledOn: visit.scheduled_on, slot: visit.slot, status: visit.status })),
    events: value.events.map((event) => ({ id: event.id, kind: event.kind, author: event.author, text: event.text, createdAt: event.created_at })),
    files: value.files.map((file) => ({ id: file.id, kind: file.kind, name: file.name, createdAt: file.created_at })),
    quotes: value.quotes.map((quote) => ({
      id: quote.id,
      reference: quote.reference,
      kind: quote.kind,
      status: quote.status,
      issuedOn: quote.issued_on,
      validUntil: quote.valid_until,
      proposedOn: quote.proposed_on,
      totalNet: quote.total_net,
      totalTax: quote.total_tax,
      totalGross: quote.total_gross,
      lines: quote.lines.map((line) => ({
        position: line.position,
        label: line.label,
        quantityMilli: line.quantity_milli,
        unit: line.unit,
        unitPrice: line.unit_price,
        netAmount: line.net_amount,
        taxRatePcm: line.tax_rate_pcm,
      })),
    })),
    approvals: value.approvals.map((approval) => ({
      id: approval.id,
      lockVersion: approval.lock_version,
      quoteFingerprint: approval.quote_fingerprint,
      statementVersion: approval.statement_version,
      quoteId: approval.quote_id,
      status: approval.status,
      amount: approval.amount,
      ceilingAmount: approval.ceiling_amount,
      requestedAt: approval.requested_at,
      decideBefore: approval.decide_before,
      decidedAt: approval.decided_at,
      decidedVia: approval.decided_via,
      comment: approval.comment,
    })),
    invoices: value.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      invoiceOn: invoice.invoice_on,
      dueOn: invoice.due_on,
      totalNet: invoice.total_net,
      totalTax: invoice.total_tax,
      totalGross: invoice.total_gross,
    })),
    allocations: value.allocations.map((allocation) => ({ id: allocation.id, invoiceId: allocation.invoice_id, chargedAmount: allocation.charged_amount, createdAt: allocation.created_at })),
  };
}

export async function fetchInterventionsPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerIntervention>> {
  const page = parse(interventionPageSchema, await client.get(INTERVENTIONS_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toIntervention), nextCursor: page.meta.next_cursor };
}

export async function fetchIntervention(client: ApiClient, id: string): Promise<OwnerInterventionDetail> {
  return toDetail(parse(interventionResponseSchema, await client.get(`${INTERVENTIONS_PATH}/${segment(id)}`)).data);
}

export interface DecisionInput {
  interventionId: string;
  approval: InterventionApproval;
  decision: ApprovalDecision;
  comment: string | null;
}

export async function decideApproval(client: ApiClient, input: DecisionInput, idempotencyKey: string): Promise<ApprovalOutcome> {
  const { approval, comment } = input;
  const body = {
    decision: input.decision,
    ...(comment === null ? {} : { comment }),
    lock_version: approval.lockVersion,
    quote_fingerprint: approval.quoteFingerprint,
    statement_version: approval.statementVersion,
  };
  const response = parse(
    decisionResponseSchema,
    await client.post(`${INTERVENTIONS_PATH}/${segment(input.interventionId)}/approvals/${segment(approval.id)}/decision`, body, { headers: { "Idempotency-Key": idempotencyKey } }),
  ).data;
  return { id: response.id, status: response.status, decidedAt: response.decided_at, replayed: response.replayed };
}
