import { describe, expect, it } from "vitest";
import { OrgApiError } from "@/features/org/errors";
import { ORG_ID, ORG_ROOT, fakeClient, problem } from "@/features/org/testing";
import { createApiComptabiliteSource } from "./source";

const money = (amount: number) => ({ amount, currency: "EUR" });
const ENTRY = "01934f6e-0000-7000-8000-0000000003a1";
const LEASE = "01934f6e-0000-7000-8000-0000000004a1";

const entryApi = {
  id: ENTRY,
  reference: "2026-000012",
  fiscal_year: 2026,
  number: 12,
  journal: "rent",
  entry_date: "2026-11-01",
  label: "Appel de loyer 2026-11",
  source: { type: "installment", id: "01934f6e-0000-7000-8000-0000000005a1" },
  reversal_of_id: null,
  posted_at: "2026-11-01T06:00:00+00:00",
};

describe("source API de la comptabilité", () => {
  it("lit le plan comptable avec les soldes par devise", async () => {
    const client = fakeClient(() => ({ data: [{ id: "c1", code: "2000", label: "Créances locataires", role: "tenant_receivable", normal_side: "debit", balances: [money(45_000)] }] }));
    const accounts = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).accounts();
    expect(client.calls[0]?.path).toBe(`${ORG_ROOT}/accounting/accounts`);
    expect(accounts).toEqual([{ id: "c1", code: "2000", label: "Créances locataires", role: "tenant_receivable", normalSide: "debit", balances: [money(45_000)] }]);
  });

  it("liste les écritures avec filtres et curseur, sans paramètre vide", async () => {
    const client = fakeClient(() => ({ data: [{ ...entryApi, lines_count: 3 }], meta: { next_cursor: "abc", per_page: 50 } }));
    const page = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).entries({ journal: "rent", from: "2026-11-01" }, "cur");
    expect(client.calls[0]?.query).toEqual({ per_page: 50, cursor: "cur", journal: "rent", lease: undefined, from: "2026-11-01", to: undefined });
    expect(page.nextCursor).toBe("abc");
    expect(page.items[0]).toMatchObject({ reference: "2026-000012", journal: "rent", date: "2026-11-01", sourceType: "installment", linesCount: 3, reversalOfId: null });
  });

  it("lit le détail d’une écriture et ses lignes", async () => {
    const client = fakeClient(() => ({
      data: {
        ...entryApi,
        lines: [
          { id: "l1", position: 1, account: { id: "c1", code: "2000", role: "tenant_receivable", label: "Créances locataires" }, debit: money(70_000), credit: money(0), lease_id: LEASE, party_id: null, unit_id: null, item: null },
          { id: "l2", position: 2, account: { id: "c2", code: "3010", role: "owner_rent_called", label: "Loyers appelés" }, debit: money(0), credit: money(70_000), lease_id: LEASE, party_id: null, unit_id: null, item: { type: "installment", id: "x" } },
        ],
      },
    }));
    const entry = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).entry(ENTRY);
    expect(client.calls[0]?.path).toBe(`${ORG_ROOT}/accounting/entries/${ENTRY}`);
    expect(entry.lines.map((line) => [line.account.code, line.debit.amount, line.credit.amount, line.leaseId])).toEqual([
      ["2000", 70_000, 0, LEASE],
      ["3010", 0, 70_000, LEASE],
    ]);
  });

  it("lit le relevé d’un bail avec devise et période", async () => {
    const client = fakeClient(() => ({
      data: { lease_id: LEASE, from: "2026-11-01", to: "2026-11-30", opening_balance: money(0), lines: [{ entry_id: ENTRY, reference: "2026-000012", date: "2026-11-01", journal: "rent", label: "Appel", debit: money(70_000), credit: money(0), balance: money(70_000) }], closing_balance: money(70_000) },
    }));
    const statement = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).statement({ lease: LEASE, currency: "EUR", from: "2026-11-01", to: "2026-11-30" });
    expect(client.calls[0]).toMatchObject({ path: `${ORG_ROOT}/accounting/leases/${LEASE}/statement`, query: { currency: "EUR", from: "2026-11-01", to: "2026-11-30" } });
    expect(statement.closing).toEqual(money(70_000));
    expect(statement.lines[0]?.entryId).toBe(ENTRY);
  });

  it("parcourt les pages de baux jusqu’à la dernière", async () => {
    const lease = (id: string) => ({ id, reference: `B-${id}`, currency: "EUR", main_unit: { reference: "Apt 1" }, tenants: [{ display_name: "Marc Roy" }] });
    const client = fakeClient((call) => (call.query?.cursor === "p2" ? { data: [lease("b")], meta: { next_cursor: null } } : { data: [lease("a")], meta: { next_cursor: "p2" } }));
    const options = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).leases();
    expect(client.calls).toHaveLength(2);
    expect(options.map((option) => option.label)).toEqual(["B-a · Apt 1 · Marc Roy", "B-b · Apt 1 · Marc Roy"]);
  });

  it.each([
    [403, "role_forbidden", "forbidden"],
    [404, "entry_not_found", "not_found"],
    [422, "statement_too_long", "invalid"],
    [503, "unavailable", "unavailable"],
  ] as const)("traduit une réponse %i en erreur %s", async (status, code, kind) => {
    const client = fakeClient(() => problem(status, code, "Détail serveur."));
    const failure = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).accounts().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OrgApiError);
    expect((failure as OrgApiError).kind).toBe(kind);
  });

  it("refuse une réponse qui ne respecte pas le contrat, au lieu de l’afficher vide", async () => {
    const client = fakeClient(() => ({ data: [{ id: "c1" }] }));
    const failure = await createApiComptabiliteSource({ client, organizationId: ORG_ID }).accounts().catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe("unexpected_response");
  });

  it("n’appelle rien sans organisation", async () => {
    const client = fakeClient(() => ({ data: [] }));
    const failure = await createApiComptabiliteSource({ client, organizationId: null }).accounts().catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe("no_organization");
    expect(client.calls).toHaveLength(0);
  });
});
