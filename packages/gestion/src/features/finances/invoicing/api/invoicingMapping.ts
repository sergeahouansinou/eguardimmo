import { CURRENCIES } from '../../../../format/money';
import type { Currency } from '../../../../format/money';
import type { Invoice, InvoicePayment, ItemTerm, Money, Recipient } from '../model';
import { unsupported } from './invoicingErrors';
import type { ApiInvoice, ApiPartyPage, ApiPayment } from './invoicingSchemas';

const isCurrency = (code: string): code is Currency => CURRENCIES.some((currency) => currency === code);

export function toMoney(api: { amount: number; currency: string }): Money {
  if (!isCurrency(api.currency)) throw unsupported(`La devise ${api.currency} n’est pas prise en charge par ces écrans (EUR et XOF seulement).`);
  return { amount: api.amount, currency: api.currency };
}

export function toPayment(api: ApiPayment): InvoicePayment {
  return {
    id: api.id,
    invoiceId: api.invoice_id,
    amount: toMoney(api.amount),
    method: api.method,
    paidOn: api.paid_on,
    reference: api.reference,
    cancelledAt: api.cancelled_at,
    recordedAt: api.recorded_at,
    replayed: api.replayed,
  };
}

export function toInvoice(api: ApiInvoice, today: string): Invoice {
  const minor = (amount: number): Money => toMoney({ amount, currency: api.currency });
  const outstanding = api.outstanding === null ? null : toMoney(api.outstanding);
  return {
    id: api.id,
    kind: api.kind,
    status: api.status,
    number: api.number,
    creditedInvoiceId: api.credited_invoice_id,
    issuedOn: api.issued_on,
    dueOn: api.due_on,
    serviceFrom: api.service_from,
    serviceTo: api.service_to,
    recipientPartyId: api.recipient_party_id,
    leaseId: api.lease_id,
    mandateId: api.mandate_id,
    totalNet: toMoney(api.total_net),
    totalTax: toMoney(api.total_tax),
    totalGross: toMoney(api.total_gross),
    outstanding,
    creditReason: api.credit_reason,
    lockVersion: api.lock_version,
    isOverdue: api.kind === 'invoice' && api.due_on !== null && api.due_on < today && outstanding !== null && outstanding.amount > 0,
    sentAt: api.sent_at,
    createdAt: api.created_at,
    lines:
      api.lines?.map((line) => ({
        id: line.id,
        position: line.position,
        itemTermId: line.item_term_id,
        description: line.description,
        quantityMilli: line.quantity_milli,
        unitPrice: minor(line.unit_price),
        netAmount: minor(line.net_amount),
        taxCategory: line.tax_category,
        taxRatePcm: line.tax_rate_pcm,
        creditedLineId: line.credited_line_id,
      })) ?? null,
    taxes:
      api.taxes?.map((tax) => ({
        taxCode: tax.tax_code,
        category: tax.category,
        ratePcm: tax.rate_pcm,
        base: minor(tax.base_amount),
        amount: minor(tax.tax_amount),
      })) ?? null,
    payments: api.payments?.map(toPayment) ?? null,
    replayed: api.replayed,
  };
}

export function toRecipients(page: ApiPartyPage['data']): Recipient[] {
  return page.map((party) => ({ id: party.id, name: party.display_name, email: party.primary_email, anonymized: party.is_anonymized, archived: party.archived_at !== null }));
}

export function toItemTerm(term: { id: string; labels: Record<string, string>; key: string; semantic_key: string | null }): ItemTerm {
  return { id: term.id, label: term.labels.fr ?? Object.values(term.labels)[0] ?? term.key, semantic: term.semantic_key };
}
