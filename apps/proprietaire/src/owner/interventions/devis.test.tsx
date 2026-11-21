import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_URL, renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one } from "../shared/fixtures";
import { APPROVAL_ID, INTERVENTION_DETAIL, INTERVENTION_ID, QUOTE_FINGERPRINT } from "./fixtures";
import { DevisScreen } from "./DevisScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const DETAIL = `GET /api/v1/owner/interventions/${INTERVENTION_ID}`;
const DECISION = `POST /api/v1/owner/interventions/${INTERVENTION_ID}/approvals/${APPROVAL_ID}/decision`;
const OUTCOME = { id: APPROVAL_ID, intervention_id: INTERVENTION_ID, status: "accepted", decided_at: "2026-11-19T10:00:00+00:00", decided_via: "owner_space", comment: null, lock_version: 4, replayed: false };
const DECIDED = { ...INTERVENTION_DETAIL, approvals: [{ ...INTERVENTION_DETAIL.approvals[0], status: "accepted", statement_version: null, decided_at: "2026-11-19T10:00:00+00:00", decided_via: "owner_space" }] };

beforeEach(() => {
  setLocation(`/confie/interventions/${INTERVENTION_ID}/devis`);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("page de validation du devis en mode api", () => {
  it("présente le devis soumis, son montant et l'échéance de décision", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    const { container } = renderApi(<DevisScreen id={INTERVENTION_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Validation du devis" })).toBeTruthy();
    const section = screen.getByRole("region", { name: "DV-2026-0007" });
    expect(within(section).getByText("Plomberie Koffi")).toBeTruthy();
    expect(within(section).getAllByText("120 €").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("100 €").length).toBeGreaterThan(0);
    expect(within(section).getByText("Remplacement du siphon")).toBeTruthy();
    expect(within(section).getByText(/26\/11\/2026 à 09 h 00/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir l’intervention" }).getAttribute("href")).toBe(`/confie/interventions/${INTERVENTION_ID}`);
    await expectNoA11yViolations(container);
  });

  it("accepte le devis avec les versions lues puis recharge et annonce la décision", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one(OUTCOME) } });
    const { user } = renderApi(<DevisScreen id={INTERVENTION_ID} />);

    await user.click(await screen.findByRole("button", { name: "Accepter le devis" }));
    stub.on("GET", `/api/v1/owner/interventions/${INTERVENTION_ID}`, { body: one(DECIDED) });
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Accepter le devis" }));

    expect(await screen.findByText("Devis accepté. Votre décision est enregistrée et l’agence en est informée.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Accepter le devis" })).toBeNull();
    });
    expect(screen.queryByText("Aucune décision n’est attendue")).toBeNull();
    const call = stub.calls.find((candidate) => candidate.method === "POST");
    expect(call?.json).toEqual({ decision: "accept", lock_version: 3, quote_fingerprint: QUOTE_FINGERPRINT, statement_version: "v1" });
    expect(new Headers(call?.init?.headers).get("Idempotency-Key")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("renvoie vers la confirmation par code quand la preuve 2FA est trop ancienne", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: problem(403, "reauthentication_required") });
    const { user } = renderApi(<DevisScreen id={INTERVENTION_ID} />);

    await user.click(await screen.findByRole("button", { name: "Accepter le devis" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Accepter le devis" }));

    const link = await screen.findByRole("link", { name: "Confirmer mon identité" });
    expect(new URL(link.getAttribute("href") ?? "").origin + new URL(link.getAttribute("href") ?? "").pathname).toBe(`${AUTH_URL}/compte/securite/confirmation/code`);
  });

  it("indique qu'aucune décision n'est attendue quand le devis est déjà tranché", async () => {
    stubApi({ [DETAIL]: { body: one(DECIDED) } });
    renderApi(<DevisScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Aucune décision n’est attendue")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accepter|Refuser|précision/ })).toBeNull();
  });

  it("n'expose aucune action à un co-indivisaire et le dit", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } }, [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    renderApi(<DevisScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Lecture seule")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accepter|Refuser|précision/ })).toBeNull();
  });

  it("n'autorise pas la décision quand le devis de la demande n'est pas servi", async () => {
    const detail = { ...INTERVENTION_DETAIL, approvals: [{ ...INTERVENTION_DETAIL.approvals[0], quote_id: null }] };
    stubApi({ [DETAIL]: { body: one(detail) } });
    renderApi(<DevisScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Devis indisponible")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accepter|Refuser|précision/ })).toBeNull();
  });

  it("traduit une intervention introuvable ou d'un autre mandant", async () => {
    stubApi({ [DETAIL]: problem(404, "owner_intervention_not_found") });
    renderApi(<DevisScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Ce devis n’a pas pu être chargé")).toBeTruthy();
    expect(screen.getByText("Cette intervention n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux interventions" }).getAttribute("href")).toBe("/confie/interventions");
  });
});
