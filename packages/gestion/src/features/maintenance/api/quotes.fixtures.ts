import * as api from './responses.fixtures';

const detail = api.advancedDetail.data;
const captured = detail.quotes[0];
const approval = detail.approvals[0];

if (captured === undefined || approval === undefined) throw new Error('Le relevé de référence ne porte ni devis ni accord.');

const summaryOf = (quote: typeof captured, status: string, id: string, reference: string) => ({
  id,
  intervention_id: quote.intervention_id,
  supplier_party_id: quote.supplier_party_id,
  reference,
  kind: quote.kind,
  status,
  issued_on: quote.issued_on,
  valid_until: quote.valid_until,
  proposed_on: quote.proposed_on,
  message: quote.message,
  total_net: quote.total_net,
  total_tax: quote.total_tax,
  total_gross: quote.total_gross,
  lock_version: quote.lock_version,
});

const intervention = (status: string) => ({ id: detail.id, reference: detail.reference, status, unit_id: detail.unit_id });

export const quoteSubmitted = {
  ...summaryOf(captured, captured.status, captured.id, captured.reference),
  intervention: intervention(detail.status),
  approval: { status: approval.status, ceiling_amount: approval.ceiling_amount, decide_before: approval.decide_before },
};

export const quoteReceived = {
  ...summaryOf(captured, 'received', '01a1ef81-503c-73bd-bbd5-e38ebc741e00', 'DEV-received'),
  kind: 'supplement',
  supplier_party_id: null,
  intervention: intervention('quoting'),
  approval: null,
};

const meta = { ...api.interventionsPage.meta, path: `https://api.eguardimmo.test/api/v1/org/${api.IDS.org}/quotes` };
const links = { first: null, last: null, prev: null, next: null };

export const quotesPage = { data: [quoteSubmitted, quoteReceived], links, meta: { ...meta, next_cursor: null } };
export const quotesFirstPage = { data: [quoteSubmitted], links, meta: { ...meta, next_cursor: 'curseur-2' } };
export const quotesSecondPage = { data: [quoteReceived], links, meta: { ...meta, next_cursor: null } };
export const quotesEmptyPage = { data: [], links, meta: { ...meta, next_cursor: null } };
