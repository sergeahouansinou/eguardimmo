import { vi } from "vitest";

export const ORG = "01934f6e-0000-7000-8000-00000000000a";
export const LEASE = "01a1e544-3c7b-7316-ad15-a82486eff490";
export const INSTALLMENT = "01a1e544-3cc7-70db-88c0-a4c892957933";
export const RECEIPT = "01a1e544-3e96-70a3-8349-0c11332b8205";
const PARTY = "01a1e544-3c81-7271-9be9-e27ad46d4aa7";
const UNIT = "01a1e544-3c7f-73f3-b4e7-64b4f79c77a6";

export const rentUrl = (path: string) => `/api/v1/org/${ORG}/rent${path}`;

const eur = (amount: number) => ({ amount, currency: "EUR" });
const amounts = { rent: eur(65000), charges: eur(5000), vat: eur(0), total: eur(70000) };
const pageMeta = { per_page: 25, next_cursor: null };

const installment = {
  id: INSTALLMENT,
  lease: { id: LEASE, reference: "BL-2026-42865" },
  party_id: PARTY,
  unit_id: UNIT,
  period: { start: "2026-11-01", end: "2026-11-30" },
  due_date: "2026-11-05",
  status: "partially_paid",
  is_overdue: true,
  amounts,
  outstanding: eur(30000),
  issued_on: "2026-11-16",
  cancelled_on: null,
  cancellation_reason: null,
  notice: { id: "01a1e544-3e54-73b3-89a5-d0d1dfa744b8", number: "AV-2026-0001", issued_on: "2026-11-16", fingerprint: "68d3dbe2" },
  receipt: null,
  receipt_state: "not_due",
};

const payment = {
  id: "01a1e544-3e76-7147-a762-3f8003326502",
  lease_id: LEASE,
  party_id: PARTY,
  status: "recorded",
  method: "transfer",
  amount: eur(40000),
  received_on: "2026-11-16",
  reference: "VIR-123",
  note: null,
  cancelled_on: null,
  cancellation_reason: null,
  recorded_at: "2026-11-16T10:00:00+00:00",
  allocations: [{ installment_id: INSTALLMENT, amount: eur(40000) }],
  advance: eur(0),
  replayed: null,
  receipts: null,
};

const receipt = {
  id: RECEIPT,
  number: "QT-2026-0001",
  lease: { id: LEASE, reference: "BL-2026-42865" },
  installment_id: INSTALLMENT,
  tenants: ["Awa Diallo"],
  unit: { reference: "LOT-1", property_name: "Résidence Les Lilas", address: { line1: "12 rue des Lilas", postal_code: "75011", city: "Paris" } },
  period: { start: "2026-11-01", end: "2026-11-30", due_date: "2026-11-05" },
  amounts,
  issued_on: "2026-11-16",
  fingerprint: "abcdef",
  is_void: false,
  voided_at: null,
  void_reason: null,
  snapshot: null,
};

export const rentRoutes: Record<string, unknown> = {
  "/api/v1/me/profiles": { data: [{ space: "organization", label: "Dupont Gestion", meta: { organization: ORG, kind: "individual", role: "owner" } }] },
  [rentUrl("/installments")]: { data: [installment], meta: pageMeta },
  [rentUrl(`/installments/${INSTALLMENT}`)]: { data: { ...installment, lines: [] } },
  [rentUrl("/payments")]: { data: [payment], meta: pageMeta },
  [rentUrl("/receipts")]: { data: [receipt], meta: pageMeta },
  [rentUrl(`/receipts/${RECEIPT}`)]: { data: receipt },
  [`/api/v1/org/${ORG}/leases`]: { data: [], meta: pageMeta },
};

export function stubApi(extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes = { ...rentRoutes, ...extra };
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(url.pathname);
    const known = routes[url.pathname];
    const body = known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: known === undefined ? 500 : 200, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}
