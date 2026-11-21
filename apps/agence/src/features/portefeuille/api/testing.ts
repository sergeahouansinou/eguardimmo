import { createApiClient } from "@eguardimmo/api";
import { vi } from "vitest";

export interface RecordedCall {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
  form: FormData | null;
}

export interface MockReply {
  status?: number;
  body?: unknown;
}

export type MockRoute = MockReply | ((call: RecordedCall) => MockReply);

export function mockApi(routes: Record<string, MockRoute>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const call: RecordedCall = {
      method: init?.method ?? "GET",
      path: url.pathname,
      search: url.searchParams,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null,
      form: init?.body instanceof FormData ? init.body : null,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    if (route === undefined) return Promise.resolve(new Response(JSON.stringify({ detail: `Route non prévue : ${call.method} ${call.path}` }), { status: 500 }));
    const reply = typeof route === "function" ? route(call) : route;
    const status = reply.status ?? 200;
    return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(reply.body ?? null), { status, headers: { "Content-Type": "application/json" } }));
  });
  const client = createApiClient({ baseUrl: "https://api.test", fetchImpl, readCookie: () => "xsrf" });
  const callsTo = (method: string, path: string) => calls.filter((call) => call.method === method && call.path === path);
  return { client, calls, callsTo, fetchImpl };
}

export const ORG = "01934f6e-0000-7000-8000-00000000000b";
export const orgPath = (path: string): string => `/api/v1/org/${ORG}${path}`;

export const ID = {
  mandate: "01934f6e-0000-7000-8000-0000000000a1",
  other: "01934f6e-0000-7000-8000-0000000000a2",
  draft: "01934f6e-0000-7000-8000-0000000000a3",
  archived: "01934f6e-0000-7000-8000-0000000000a4",
  mandant: "01934f6e-0000-7000-8000-0000000000b1",
  company: "01934f6e-0000-7000-8000-0000000000b2",
  type: "01934f6e-0000-7000-8000-0000000000c1",
  unitA: "01934f6e-0000-7000-8000-0000000000d1",
  unitB: "01934f6e-0000-7000-8000-0000000000d2",
  lineA: "01934f6e-0000-7000-8000-0000000000e1",
  lineB: "01934f6e-0000-7000-8000-0000000000e2",
  terms: "01934f6e-0000-7000-8000-0000000000f1",
  amendment: "01934f6e-0000-7000-8000-0000000000f2",
  property: "01934f6e-0000-7000-8000-0000000000aa",
  signedFile: "01934f6e-0000-7000-8000-0000000000f9",
  documentA: "01934f6e-0000-7000-8000-000000000101",
  documentB: "01934f6e-0000-7000-8000-000000000102",
  storedFile: "01934f6e-0000-7000-8000-000000000201",
} as const;

type Json = Record<string, unknown>;

export function unitLine(overrides: Json = {}): Json {
  return {
    id: ID.lineA,
    unit: { id: ID.unitA, reference: "A12", property: { id: ID.property, name: "Résidence du Port" } },
    valid_from: "2026-01-01",
    end_date: null,
    ...overrides,
  };
}

export function termsJson(overrides: Json = {}): Json {
  return {
    id: ID.terms,
    fee_kind: "percentage",
    fee_basis_points: 700,
    fee_flat_amount: null,
    payout_day: 5,
    works_limit_amount: { amount: 50_000, currency: "EUR" },
    fee_base: "rent_and_charges",
    fee_minimum_amount: { amount: 0, currency: "EUR" },
    fee_tax_mode: "excl_tax",
    letting_fee_basis_points: null,
    works_fee_basis_points: null,
    signed_file_id: null,
    valid_from: "2026-01-01",
    valid_to: null,
    reason: "initial",
    ...overrides,
  };
}

export function xofTermsJson(overrides: Json = {}): Json {
  return termsJson({
    works_limit_amount: { amount: 300_000, currency: "XOF" },
    fee_minimum_amount: { amount: 5_000, currency: "XOF" },
    ...overrides,
  });
}

export function mandateSummary(overrides: Json = {}): Json {
  return {
    id: ID.mandate,
    reference: "M-2026-0001",
    status: "active",
    mandant: { id: ID.mandant, display_name: "Claire Vasseur", kind: "person", is_anonymized: false },
    mandate_type: { id: ID.type, key: "gestion", label: "Mandat de gestion", semantic_key: "management" },
    starts_on: "2026-01-01",
    end_date: "2028-12-31",
    tacit_renewal: false,
    currency: "EUR",
    units: [unitLine()],
    terms: termsJson(),
    lock_version: 3,
    archived_at: null,
    has_end_request: false,
    ...overrides,
  };
}

export function mandateDetail(overrides: Json = {}): Json {
  return {
    ...mandateSummary(),
    renewal_months: 12,
    notice_months: 3,
    signed_on: "2025-12-20",
    signed_file_id: null,
    termination: null,
    note: null,
    custom_fields: {},
    terms_history: [termsJson()],
    ...overrides,
  };
}

export const mandantRow = (overrides: Json = {}): Json => ({ party_id: ID.mandant, display_name: "Claire Vasseur", mandate_count: 1, running_mandate_count: 1, ...overrides });

export const page = (data: Json[], nextCursor: string | null = null): Json => ({ data, meta: { per_page: 100, next_cursor: nextCursor } });

export const problem = (status: number, code: string, detail: string, errors?: Record<string, string[]>): MockReply => ({
  status,
  body: { type: `https://errors.test/${code}`, title: detail, status, detail, code, ...(errors ? { errors } : {}) },
});

export function termDefaultsJson(overrides: Json = {}): Json {
  return {
    fee_kind: "percentage",
    fee_basis_points: 650,
    fee_flat_amount: null,
    fee_base: "rent_and_charges",
    fee_minimum_amount: { amount: 1_500, currency: "EUR" },
    fee_tax_mode: "excl_tax",
    payout_day: 7,
    works_limit_amount: { amount: 60_000, currency: "EUR" },
    letting_fee_basis_points: 5_000,
    works_fee_basis_points: null,
    currency: "EUR",
    lock_version: 2,
    updated_at: "2026-11-10T09:30:00+00:00",
    ...overrides,
  };
}

export function documentJson(overrides: Json = {}): Json {
  return {
    id: ID.documentA,
    mandate_id: ID.mandate,
    stored_file_id: ID.storedFile,
    kind: "diagnostic",
    uploaded_by_kind: "agency",
    shared_by_user_id: "01934f6e-0000-7000-8000-000000000301",
    shared_at: "2026-11-12T08:00:00+00:00",
    revoked_at: null,
    ...overrides,
  };
}

export const storedFileJson = (overrides: Json = {}): Json => ({
  id: ID.storedFile,
  name: "diagnostic.pdf",
  mime_type: "application/pdf",
  size_bytes: 1_024,
  ...overrides,
});
