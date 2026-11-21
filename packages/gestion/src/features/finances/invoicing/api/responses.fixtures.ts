export const IDS = {
  org: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa601',
  party: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa602',
  otherParty: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa603',
  draft: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa610',
  issued: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa611',
  partial: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa612',
  paid: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa613',
  creditNote: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa614',
  line: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa620',
  secondLine: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa621',
  term: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa630',
  serviceTerm: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa631',
  payment: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa640',
  lease: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa650',
};

const eur = (amount: number) => ({ amount, currency: 'EUR' });

const line = (id: string, position: number, description: string, quantityMilli: number, unitPrice: number, netAmount: number, category = 'S', ratePcm = 20000, creditedLineId: string | null = null) => ({
  id,
  position,
  item_term_id: IDS.term,
  description,
  quantity_milli: quantityMilli,
  unit_price: unitPrice,
  net_amount: netAmount,
  tax_category: category,
  tax_rate_pcm: ratePcm,
  credited_line_id: creditedLineId,
});

const tax = (base: number, amount: number, category = 'S', ratePcm = 20000) => ({ tax_code: 'vat', category, rate_pcm: ratePcm, base_amount: base, tax_amount: amount });

const invoice = (overrides: Record<string, unknown>) => ({
  id: IDS.issued,
  kind: 'invoice',
  status: 'issued',
  number: 'FA-2026-0001',
  credited_invoice_id: null,
  issued_on: '2026-11-16',
  due_on: '2026-12-16',
  service_from: '2026-11-01',
  service_to: '2026-11-30',
  recipient_party_id: IDS.party,
  lease_id: null,
  mandate_id: null,
  currency: 'EUR',
  total_net: eur(10000),
  total_tax: eur(2000),
  total_gross: eur(12000),
  outstanding: eur(12000),
  credit_reason: null,
  lock_version: 0,
  overdue_flagged_at: null,
  sent_at: null,
  created_at: '2026-11-16T09:00:00+00:00',
  lines: [line(IDS.line, 1, 'Honoraires de gestion, novembre 2026', 1000, 10000, 10000)],
  taxes: [tax(10000, 2000)],
  payments: [],
  replayed: null,
  ...overrides,
});

export const payment = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.payment,
  invoice_id: IDS.issued,
  amount: eur(5000),
  method: 'transfer',
  paid_on: '2026-11-16',
  reference: 'VIR-123',
  cancelled_at: null,
  recorded_at: '2026-11-16T10:00:00+00:00',
  replayed: false,
  ...overrides,
});

export const draftDetail = {
  data: invoice({
    id: IDS.draft,
    status: 'draft',
    number: null,
    issued_on: null,
    due_on: null,
    outstanding: null,
    total_net: eur(0),
    total_tax: eur(0),
    total_gross: eur(0),
    taxes: [],
    payments: [],
    lines: [line(IDS.line, 1, 'Honoraires de gestion, novembre 2026', 1000, 10000, 10000)],
  }),
};

export const draftCreated = { data: invoice({ id: IDS.draft, status: 'draft', number: null, issued_on: null, due_on: null, outstanding: null, payments: null, replayed: false }) };
export const draftUpdated = { data: invoice({ id: IDS.draft, status: 'draft', number: null, issued_on: null, due_on: null, outstanding: null, payments: null, lock_version: 1 }) };
export const draftDiscarded = { data: invoice({ id: IDS.draft, status: 'discarded', number: null, issued_on: null, due_on: null, outstanding: null, lines: null, taxes: null, payments: null }) };

export const issuedDetail = { data: invoice({}) };
export const issuedNow = { data: invoice({ outstanding: null, replayed: false }) };
export const issuedReplay = { data: invoice({ outstanding: null, replayed: true }) };
export const sentInvoice = { data: invoice({ outstanding: null, lines: null, taxes: null, payments: null, sent_at: '2026-11-16T11:00:00+00:00' }) };

export const partialDetail = {
  data: invoice({ id: IDS.partial, status: 'partially_paid', number: 'FA-2026-0002', outstanding: eur(7000), payments: [payment({ invoice_id: IDS.partial })] }),
};

export const paidDetail = {
  data: invoice({ id: IDS.paid, status: 'paid', number: 'FA-2026-0003', outstanding: eur(0), payments: [payment({ invoice_id: IDS.paid, amount: eur(12000), recorded_at: '2026-11-16T10:00:00+00:00' })] }),
};

export const overdueDetail = { data: invoice({ due_on: '2026-11-05' }) };

export const creditNoteDetail = {
  data: invoice({
    id: IDS.creditNote,
    kind: 'credit_note',
    number: 'AF-2026-0001',
    credited_invoice_id: IDS.issued,
    due_on: null,
    outstanding: null,
    credit_reason: 'Remise commerciale',
    total_net: eur(5000),
    total_tax: eur(1000),
    total_gross: eur(6000),
    lines: [line(IDS.secondLine, 1, 'Honoraires de gestion, novembre 2026', 500, 10000, 5000, 'S', 20000, IDS.line)],
    taxes: [tax(5000, 1000)],
    payments: null,
    replayed: false,
  }),
};

export const creditNoteReplay = { data: { ...creditNoteDetail.data, replayed: true } };

const listRow = (source: { data: Record<string, unknown> }) => ({ ...source.data, lines: null, taxes: null, payments: null });

export const invoicesPage = {
  data: [listRow(draftDetail), listRow(overdueDetail), listRow(partialDetail), listRow(paidDetail), listRow(creditNoteDetail)],
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: `https://api.eguardimmo.test/api/v1/org/${IDS.org}/invoices`, per_page: 25, next_cursor: null, prev_cursor: null },
};

export const paymentRecorded = { data: payment() };
export const paymentReplay = { data: payment({ replayed: true }) };
export const paymentCancelled = { data: payment({ cancelled_at: '2026-11-17T09:30:00+00:00', replayed: null }) };

export const partiesPage = {
  data: [
    { id: IDS.party, kind: 'company', display_name: 'SCI Les Tilleuls', primary_email: 'contact@tilleuls.example.test', primary_phone: null, is_anonymized: false, archived_at: null },
    { id: IDS.otherParty, kind: 'person', display_name: 'Danielle Martin', primary_email: null, primary_phone: null, is_anonymized: false, archived_at: null },
  ],
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: `https://api.eguardimmo.test/api/v1/org/${IDS.org}/parties`, per_page: 100, next_cursor: null, prev_cursor: null },
};

const term = (id: string, key: string, label: string, semantic: string) => ({
  id,
  vocabulary: 'invoice_item',
  key,
  labels: { fr: label },
  semantic_key: semantic,
  parent_id: null,
  position: 0,
  metadata: {},
  platform: true,
  system: true,
  archived: false,
  hidden: false,
  overridden: false,
});

export const itemTerms = {
  data: [term(IDS.term, 'management_fee', 'Honoraires de gestion', 'fee.management'), term(IDS.serviceTerm, 'service', 'Prestation de services', 'service')],
};

const problem = (status: number, code: string, title: string, detail: string, extra: Record<string, unknown> = {}) => ({
  type: `https://api.eguardimmo.test/problems/${code}`,
  title,
  status,
  detail,
  code,
  request_id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa6ff',
  ...extra,
});

export const problemNotFound = problem(404, 'invoice_not_found', 'Facture introuvable', 'Cette facture n\'existe pas dans votre organisation.');
export const problemAgencyOnly = problem(403, 'invoicing_agency_only', 'Fonction réservée aux agences', 'La facturation est réservée aux organisations de type agence.');
export const problemForbidden = problem(403, 'role_forbidden', 'Action réservée', 'Votre rôle ne permet pas cette action.');
export const problemIssuerIncomplete = problem(422, 'invoice_issuer_incomplete', 'Identité légale de l\'émetteur incomplète', 'Renseignez l\'identité légale du siège (raison sociale, adresse, SIREN, numéro de TVA) avant d\'émettre.');
export const problemRecipientEmailMissing = problem(422, 'invoice_recipient_email_missing', 'Destinataire sans adresse e-mail', 'Le destinataire n\'a pas d\'adresse e-mail principale.');
export const problemStaleVersion = problem(409, 'invoice_stale_version', 'Brouillon modifié entre-temps', 'Ce brouillon a été modifié depuis votre lecture : rechargez-le avant de l\'enregistrer.');
export const problemPaymentExceeds = problem(422, 'invoice_payment_exceeds_outstanding', 'Règlement supérieur au reste dû', 'Le règlement dépasse le reste dû de la facture.');
export const problemCreditExceeds = problem(422, 'invoice_credit_exceeds_outstanding', 'Avoir supérieur au reste dû', 'Le cumul des avoirs ne peut pas dépasser le reste dû de la facture.');
export const problemKeyReused = problem(409, 'invoice_idempotency_key_reused', 'Clé d\'idempotence déjà utilisée', 'Cette clé d\'idempotence a déjà servi pour une demande différente.');
export const problemPdfUnavailable = problem(503, 'invoice_pdf_unavailable', 'Service PDF indisponible', 'Le service de génération des PDF ne répond pas : réessayez dans un instant.', { retry_after: 30 });
export const problemThrottled = problem(429, 'too_many_requests', 'Trop de requêtes', 'Trop de requêtes.');
export const problemSendThrottled = problem(429, 'too_many_requests', 'Trop de tentatives', 'Trop de tentatives. Réessayez plus tard.', { retry_after: 1800 });
export const problemValidation = (field: string) => problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.', { errors: { [field]: ['validation.required'] } });
export const PDF_BYTES = '%PDF-1.4 fixture';
