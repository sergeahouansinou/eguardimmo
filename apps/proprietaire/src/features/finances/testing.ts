import { vi } from "vitest";

export const ORG = "01934f6e-0000-7000-8000-00000000000b";
export const PROPERTY = "01934f6e-0000-7000-8000-0000000000a1";
export const EXPENSE = "01934f6e-0000-7000-8000-0000000000d1";
export const EXERCISE = "01934f6e-0000-7000-8000-000000000101";
export const CATEGORY = "01934f6e-0000-7000-8000-0000000000c1";
export const ACCOUNT = "01934f6e-0000-7000-8000-0000000000e1";
export const STATEMENT = "01934f6e-0000-7000-8000-0000000000e2";
export const RECONCILIATION = "01934f6e-0000-7000-8000-0000000000e3";
export const LINE = "01934f6e-0000-7000-8000-0000000000e4";

export const org = (path: string) => `/api/v1/org/${ORG}${path}`;

const eur = (amount: number) => ({ amount, currency: "EUR" });
const links = { first: null, last: null, prev: null, next: null };
export const page = (data: unknown[]) => ({ data, links, meta: { path: "https://api.test/x", per_page: 25, next_cursor: null, prev_cursor: null } });

const expense = {
  id: EXPENSE,
  property_id: PROPERTY,
  unit_id: null,
  kind: "payment",
  category_term_id: CATEGORY,
  payee_party_id: null,
  payee_label: "Plomberie du Lac",
  reference: "FAC-2026-014",
  document_on: "2026-03-12",
  service_from: "2026-01-01",
  service_to: "2026-04-01",
  total_gross: eur(120000),
  tax_amount: eur(20000),
  recoverable_amount: eur(100000),
  recoverable_rubric: "cleaning",
  settlement: "bank",
  paid_on: "2026-03-15",
  mandate_id: null,
  mandant_party_id: null,
  status: "recorded",
  cancel_reason: null,
  posted: true,
  files: [],
  lock_version: 1,
  created_at: "2026-03-12T09:00:00+00:00",
};

const exercise = {
  id: EXERCISE,
  property_id: PROPERTY,
  period_start: "2025-01-01",
  period_end: "2026-01-01",
  status: "draft",
  jurisdiction: "FR",
  only_lease_id: null,
  prescription_acknowledged: false,
  computed_at: null,
  issued_at: null,
  lock_version: 3,
};

const term = (vocabulary: string, key: string, label: string, id: string) => ({
  id,
  vocabulary,
  key,
  labels: { fr: label },
  semantic_key: null,
  parent_id: null,
  position: 1,
  metadata: { recoverable_by_default: true },
  platform: true,
  system: true,
  archived: false,
  hidden: false,
  overridden: false,
});

const csvProfile = { delimiter: ";", encoding: "UTF-8", has_header: true, date_format: "d/m/Y", decimal_separator: ",", columns: { booking_date: 1, label: 2, amount: 3 } };

const account = {
  id: ACCOUNT,
  ledger_role: "bank",
  label: "Compte courant Dupont",
  bank_name: "Banque Populaire",
  holder_name: "Marie Dupont",
  identifier_kind: "iban",
  last4: "0189",
  country: "FR",
  currency: "EUR",
  status: "active",
  reconciliation_from: "2026-01-01",
  opening_bank_balance: eur(1250050),
  replaces_id: null,
  csv_profile: csvProfile,
  last_reconciled_on: "2026-02-28",
  closed_at: null,
  created_at: "2026-01-02T09:00:00+00:00",
};

const statement = {
  id: STATEMENT,
  bank_account_id: ACCOUNT,
  source: "csv",
  format_version: null,
  statement_ref: null,
  sequence: null,
  period_from: "2026-03-01",
  period_to: "2026-03-31",
  opening_balance: eur(1250050),
  closing_balance: eur(1480050),
  currency: "EUR",
  lines_total: 1,
  lines_imported: 1,
  lines_duplicated: 0,
  lines_rejected: 0,
  is_copy: false,
  imported_by_user_id: "01934f6e-0000-7000-8000-0000000000a0",
  voided_at: null,
  void_reason: null,
  has_file: true,
  created_at: "2026-04-02T08:00:00+00:00",
};

const line = {
  id: LINE,
  statement_id: STATEMENT,
  bank_account_id: ACCOUNT,
  booking_date: "2026-03-05",
  value_date: null,
  direction: "credit",
  amount: eur(85000),
  signed_amount: eur(85000),
  original_amount: null,
  reversal: false,
  label: "VIR LOYER MARS MARTIN",
  bank_reference: null,
  end_to_end_id: null,
  transaction_code: null,
  remittance_reference: null,
  counterparty_name: "Julie Martin",
  counterparty_last4: "3321",
  state: "unmatched",
  ignore_reason: null,
  lock_version: 1,
  match_id: null,
  suggestion: null,
};

const reconciliation = {
  id: RECONCILIATION,
  bank_account_id: ACCOUNT,
  as_of: "2026-03-31",
  currency: "EUR",
  status: "draft",
  bank_balance_source: "statement",
  bank_balance: eur(1480050),
  has_balance_proof: false,
  book_balance: eur(1480050),
  unmatched_lines_total: eur(0),
  unmatched_entries_total: eur(0),
  ignored_total: eur(0),
  timing_difference: eur(0),
  unexplained_difference: eur(0),
  has_gap: false,
  validatable: true,
  items: { unmatched_lines: [], ignored_lines: [], unmatched_entries: [], gaps: [], truncated: false },
  validated_by_user_id: null,
  validated_at: null,
  supersedes_id: null,
  created_at: "2026-04-06T09:00:00+00:00",
};

export function profile(role: string, kind = "individual") {
  return { data: [{ space: "organization", label: "Marie Dupont", meta: { organization: ORG, kind, role } }] };
}

export const financeRoutes: Record<string, unknown> = {
  [org("/charges/expenses")]: page([expense]),
  [org(`/charges/expenses/${EXPENSE}`)]: { data: expense },
  [org("/charges/exercises")]: page([exercise]),
  [org(`/charges/exercises/${EXERCISE}`)]: { data: { ...exercise, items: [], statements: [] } },
  [org(`/charges/properties/${PROPERTY}/charge-keys`)]: { data: [] },
  [org("/properties")]: page([{ id: PROPERTY, name: "Résidence des Lilas", type: "building", address: {}, active_units_count: 2, archived_at: null }]),
  [org("/units")]: page([]),
  [org("/catalog/vocabularies/expense_category/terms")]: { data: [term("expense_category", "maintenance", "Entretien", CATEGORY)] },
  [org("/catalog/vocabularies/charge_rubric/terms")]: { data: [term("charge_rubric", "cleaning", "Entretien des parties communes", "01934f6e-0000-7000-8000-0000000001a1")] },
  [org("/banking/accounts")]: { data: [account] },
  [org("/banking/statements")]: page([statement]),
  [org(`/banking/statements/${STATEMENT}`)]: { data: statement, meta: { gaps: [] } },
  [org("/banking/lines")]: page([line]),
  [org("/banking/reconciliations")]: page([reconciliation]),
  [org(`/banking/reconciliations/${RECONCILIATION}`)]: { data: reconciliation },
  [org("/banking/suggestions")]: page([]),
  [org("/banking/rules")]: { data: [] },
};

function bodyOf(body: BodyInit | null | undefined): unknown {
  if (typeof body === "string") return JSON.parse(body);
  if (body instanceof FormData) return Object.fromEntries(body.entries());
  return null;
}

export interface Recorded {
  path: string;
  method: string;
  body: unknown;
  idempotencyKey: string | null;
}

export function stubApi(role = "owner", kind = "individual", extra: Record<string, unknown> = {}) {
  const calls: Recorded[] = [];
  const routes: Record<string, unknown> = { "/api/v1/me/profiles": profile(role, kind), ...financeRoutes, ...extra };
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const method = init?.method ?? "GET";
    calls.push({ path: url.pathname, method, body: bodyOf(init?.body), idempotencyKey: new Headers(init?.headers).get("Idempotency-Key") });
    const known = method === "GET" ? routes[url.pathname] : routes[`${method} ${url.pathname}`];
    const body = known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: known === undefined ? 500 : 200, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, paths: () => calls.map((call) => call.path) };
}
