import type { ApiClient } from '@eguardimmo/api';
import { todayIso } from '../../../locataires/kit/dates';
import { translateSendError } from './invoicingErrors';
import { toInvoice, toItemTerm, toPayment, toRecipients } from './invoicingMapping';
import { creditNotePayload, draftPayload, paymentPayload } from './invoicingPayloads';
import { apiInvoicePage, apiInvoiceResponse, apiItemTerms, apiPartyPage, apiPaymentResponse } from './invoicingSchemas';
import type { ApiPartyPage } from './invoicingSchemas';
import { createInvoicingTransport } from './invoicingTransport';
import type { InvoiceQuery, Recipient } from '../model';
import { invoicingPermissions } from '../permissions';
import type { InvoicingOrganizationKind, InvoicingRole } from '../permissions';
import type { InvoicingSource } from '../source';

export interface ApiInvoicingSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: InvoicingRole | null;
  kind: InvoicingOrganizationKind | null;
}

export interface ApiInvoicingSourceDependencies {
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const PARTY_PAGE_SIZE = 100;
const MAX_PARTY_PAGES = 10;
const segment = (id: string): string => encodeURIComponent(id);

const invoiceQuery = (query: InvoiceQuery) => ({
  per_page: query.perPage ?? PAGE_SIZE,
  cursor: query.cursor,
  kind: query.kind,
  status: query.status,
  year: query.year,
  search: query.search,
  overdue: query.overdue === true ? 1 : undefined,
  party: query.partyId,
});

export function createApiInvoicingSource(
  { client, organizationId, role, kind }: ApiInvoicingSourceOptions,
  { now = () => new Date(), fetchImpl }: ApiInvoicingSourceDependencies = {},
): InvoicingSource {
  const transport = createInvoicingTransport(client, organizationId, fetchImpl);
  const today = (): string => todayIso(now());
  const invoiceAction = async (id: string, action: string, body?: Record<string, unknown>) =>
    toInvoice((await transport.post(`/invoices/${segment(id)}/${action}`, apiInvoiceResponse, body)).data, today());

  return {
    permissions: invoicingPermissions(role, kind),
    invoices: async (query) => {
      const page = await transport.get('/invoices', apiInvoicePage, invoiceQuery(query));
      return { items: page.data.map((invoice) => toInvoice(invoice, today())), nextCursor: page.meta.next_cursor };
    },
    invoice: async (id) => toInvoice((await transport.get(`/invoices/${segment(id)}`, apiInvoiceResponse)).data, today()),
    saveDraft: async (input) => {
      const body = draftPayload(input);
      const response =
        input.invoiceId === null
          ? await transport.post('/invoices', apiInvoiceResponse, body)
          : await transport.patch(`/invoices/${segment(input.invoiceId)}`, apiInvoiceResponse, body);
      return toInvoice(response.data, today());
    },
    discardDraft: (id) => invoiceAction(id, 'discard'),
    issue: (id) => invoiceAction(id, 'issue'),
    recordPayment: async (invoiceId, input) => toPayment((await transport.post(`/invoices/${segment(invoiceId)}/payments`, apiPaymentResponse, paymentPayload(input, today()))).data),
    cancelPayment: async (paymentId) => toPayment((await transport.post(`/invoice-payments/${segment(paymentId)}/cancel`, apiPaymentResponse)).data),
    createCreditNote: (invoiceId, input) => invoiceAction(invoiceId, 'credit-notes', creditNotePayload(input)),
    send: async (id) => {
      try {
        return await invoiceAction(id, 'send');
      } catch (error) {
        throw translateSendError(error);
      }
    },
    pdf: (id) => transport.pdf(`/invoices/${segment(id)}/pdf`),
    recipients: async () => {
      const found = new Map<string, Recipient>();
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PARTY_PAGES; page += 1) {
        const result: ApiPartyPage = await transport.get('/parties', apiPartyPage, { status: 'all', per_page: PARTY_PAGE_SIZE, cursor });
        for (const party of toRecipients(result.data)) found.set(party.id, party);
        cursor = result.meta.next_cursor;
        if (cursor === null) break;
      }
      return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    itemTerms: async () => {
      const { data } = await transport.get('/catalog/vocabularies/invoice_item/terms', apiItemTerms);
      return data.filter((term) => !term.archived && !term.hidden).map(toItemTerm);
    },
  };
}
