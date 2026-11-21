import { CURRENCIES } from '../../../format/money';
import type { Currency } from '../../../format/money';
import type {
  Intervention,
  InterventionDetail,
  Money,
  PartyChoice,
  QuoteSummary,
  Supplier,
  Term,
  UnitChoice,
} from '../model';
import { TAX_CATEGORIES } from '../model';
import { MaintenanceApiError } from './maintenanceErrors';
import type { ApiIntervention, ApiInterventionDetail, ApiQuoteSummary, ApiSupplier, ApiTerms } from './maintenanceSchemas';
import type { z } from 'zod';
import type { apiPartyPage, apiUnitPage } from './maintenanceSchemas';

const isCurrency = (code: string): code is Currency => CURRENCIES.some((currency) => currency === code);

export function toMoney(api: { amount: number; currency: string }): Money {
  if (!isCurrency(api.currency)) {
    throw new MaintenanceApiError('unexpected_response', `La devise ${api.currency} n’est pas prise en charge par ces écrans (EUR et XOF seulement).`, { code: 'unsupported_currency' });
  }
  return { amount: api.amount, currency: api.currency };
}

const moneyOrNull = (api: { amount: number; currency: string } | null): Money | null => (api === null ? null : toMoney(api));

export function toIntervention(api: ApiIntervention): Intervention {
  return {
    id: api.id,
    reference: api.reference,
    origin: api.origin,
    status: api.status,
    priority: api.priority,
    reportedUrgency: api.reported_urgency,
    natureTermId: api.nature_term_id,
    title: api.title,
    description: api.description,
    room: api.room,
    availability: api.availability,
    propertyId: api.property_id,
    unitId: api.unit_id,
    unit: api.unit === null ? null : { id: api.unit.id, reference: api.unit.reference, propertyName: api.unit.property_name },
    leaseId: api.lease_id,
    mandateId: api.mandate_id,
    mandant: api.mandant,
    reporter: api.reporter,
    supplier: api.supplier,
    responsibility: api.responsibility,
    reportedOn: api.reported_on,
    dueOn: api.due_on,
    estimatedAmount: moneyOrNull(api.estimated_amount),
    ceilingAmount: moneyOrNull(api.ceiling_amount),
    approvalBasis: api.approval_basis,
    emergencyReason: api.emergency_reason,
    declineReason: api.decline_reason,
    declineNote: api.decline_note,
    completedOn: api.completed_on,
    completionNote: api.completion_note,
    closedAt: api.closed_at,
    followsInterventionId: api.follows_intervention_id,
    visits: api.visits.map((visit) => ({ id: visit.id, scheduledOn: visit.scheduled_on, slot: visit.slot, status: visit.status })),
    lockVersion: api.lock_version,
    createdAt: api.created_at,
  };
}

export function toDetail(api: ApiInterventionDetail): InterventionDetail {
  const { amount: committed, currency: committedCurrency } = api.committed_amount;
  const currency = toMoney({ amount: 0, currency: committedCurrency }).currency;
  return {
    ...toIntervention(api),
    currency,
    committedAmount: committed === null ? null : { amount: committed, currency },
    events: api.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      actorKind: event.actor_kind,
      text: event.text,
      visibleToOwner: event.visible_to_owner,
      visibleToTenant: event.visible_to_tenant,
      createdAt: event.created_at,
    })),
    files: api.files.map((file) => ({
      id: file.id,
      kind: file.kind,
      uploadedByKind: file.uploaded_by_kind,
      visibleToOwner: file.visible_to_owner,
      visibleToTenant: file.visible_to_tenant,
      createdAt: file.created_at,
    })),
    visits: api.visits.map((visit) => ({
      id: visit.id,
      supplierPartyId: visit.supplier_party_id,
      scheduledOn: visit.scheduled_on,
      slot: visit.slot,
      presenceRequired: visit.presence_required,
      status: visit.status,
      requestedOn: visit.requested_on,
      requestedSlot: visit.requested_slot,
      contactName: visit.contact_name,
      contactPhone: visit.contact_phone,
      lockVersion: visit.lock_version,
    })),
    quotes: api.quotes.map((quote) => ({
      id: quote.id,
      supplierPartyId: quote.supplier_party_id,
      reference: quote.reference,
      kind: quote.kind,
      status: quote.status,
      issuedOn: quote.issued_on,
      validUntil: quote.valid_until,
      proposedOn: quote.proposed_on,
      message: quote.message,
      totalNet: toMoney(quote.total_net),
      totalTax: toMoney(quote.total_tax),
      totalGross: toMoney(quote.total_gross),
      lines: (quote.lines ?? []).map((line) => ({
        position: line.position,
        label: line.label,
        quantityMilli: line.quantity_milli,
        unit: line.unit,
        unitPrice: line.unit_price,
        netAmount: line.net_amount,
        taxCategory: line.tax_category,
        taxRatePcm: line.tax_rate_pcm,
      })),
    })),
    approvals: api.approvals.map((approval) => ({
      id: approval.id,
      quoteId: approval.quote_id,
      amount: toMoney(approval.amount),
      ceilingAmount: moneyOrNull(approval.ceiling_amount),
      status: approval.status,
      requestedAt: approval.requested_at,
      decideBefore: approval.decide_before,
      decidedAt: approval.decided_at,
      decidedVia: approval.decided_via,
      comment: approval.comment,
      proofFileId: approval.proof_file_id,
      lockVersion: approval.lock_version,
    })),
    invoices: api.invoices.map((invoice) => ({
      id: invoice.id,
      supplierPartyId: invoice.supplier_party_id,
      number: invoice.number,
      invoiceOn: invoice.invoice_on,
      dueOn: invoice.due_on,
      totalNet: toMoney(invoice.total_net),
      totalTax: toMoney(invoice.total_tax),
      totalGross: toMoney(invoice.total_gross),
      status: invoice.status,
      exceedsApprovedAmount: invoice.exceeds_approved_amount,
      taxes: (invoice.taxes ?? []).map((tax) => ({ category: tax.category, ratePcm: tax.rate_pcm, baseAmount: tax.base_amount, taxAmount: tax.tax_amount })),
      allocations: (invoice.allocations ?? []).map((allocation) => ({
        id: allocation.id,
        target: allocation.target,
        shareAmount: toMoney(allocation.share_amount),
        wearBasisPoints: allocation.wear_basis_points,
        chargedAmount: toMoney(allocation.charged_amount),
        basisNote: allocation.basis_note,
        cancelledAt: allocation.cancelled_at,
      })),
      payments: (invoice.payments ?? []).map((payment) => ({
        id: payment.id,
        amount: toMoney(payment.amount),
        method: payment.method,
        paidOn: payment.paid_on,
        reference: payment.reference,
        cancelledAt: payment.cancelled_at,
      })),
      lockVersion: invoice.lock_version,
    })),
  };
}

export function toSupplier(api: ApiSupplier): Supplier {
  return {
    id: api.id,
    partyId: api.party.id,
    name: api.party.name,
    anonymized: api.party.is_anonymized === true,
    status: api.status,
    preferred: api.preferred,
    paymentTermsDays: api.payment_terms_days,
    internalNote: api.internal_note,
    tradeTermIds: api.trade_term_ids,
    lockVersion: api.lock_version,
  };
}

const FALLBACK_LOCALE = 'fr';

export function toTerm(api: ApiTerms['data'][number]): Term {
  const rate = api.metadata?.rate_pcm;
  const category = api.metadata?.category;
  return {
    id: api.id,
    key: api.key,
    label: api.labels[FALLBACK_LOCALE] ?? Object.values(api.labels)[0] ?? api.key,
    ratePcm: typeof rate === 'number' ? rate : null,
    category: TAX_CATEGORIES.find((candidate) => candidate === category) ?? null,
  };
}

export function toUnits(page: z.infer<typeof apiUnitPage>): UnitChoice[] {
  return page.data.map((unit) => ({ id: unit.id, label: unit.property ? `${unit.reference} · ${unit.property.name}` : unit.reference }));
}

export function toParties(page: z.infer<typeof apiPartyPage>): PartyChoice[] {
  return page.data.filter((party) => !party.is_anonymized && party.archived_at === null).map((party) => ({ id: party.id, name: party.display_name }));
}

export function toQuoteSummary(api: ApiQuoteSummary): QuoteSummary {
  return {
    id: api.id,
    interventionId: api.intervention_id,
    supplierPartyId: api.supplier_party_id,
    reference: api.reference,
    kind: api.kind,
    status: api.status,
    issuedOn: api.issued_on,
    validUntil: api.valid_until,
    proposedOn: api.proposed_on,
    message: api.message,
    totalNet: toMoney(api.total_net),
    totalTax: toMoney(api.total_tax),
    totalGross: toMoney(api.total_gross),
    lockVersion: api.lock_version,
    intervention: api.intervention === null ? null : { id: api.intervention.id, reference: api.intervention.reference, status: api.intervention.status, unitId: api.intervention.unit_id },
    approval: api.approval === null ? null : { status: api.approval.status, ceilingAmount: toMoney(api.approval.ceiling_amount), decideBefore: api.approval.decide_before },
  };
}
