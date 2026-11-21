import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_URL, renderApi, stubApi } from "../../../test/api";
import type { ApiStub, RecordedCall } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one } from "../shared/fixtures";
import { APPROVAL_ID, INTERVENTION_DETAIL, INTERVENTION_ID, QUOTE_FINGERPRINT } from "./fixtures";
import { InterventionScreen } from "./InterventionScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const DETAIL = `GET /api/v1/owner/interventions/${INTERVENTION_ID}`;
const DECISION = `POST /api/v1/owner/interventions/${INTERVENTION_ID}/approvals/${APPROVAL_ID}/decision`;

const OUTCOME = { id: APPROVAL_ID, intervention_id: INTERVENTION_ID, status: "accepted", decided_at: "2026-11-19T10:00:00+00:00", decided_via: "owner_space", comment: null, lock_version: 4, replayed: false };

const decisionCalls = (stub: ApiStub): RecordedCall[] => stub.calls.filter((call) => call.method === "POST" && call.path.endsWith("/decision"));
const urlOf = (input: RequestInfo | URL): string => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
const keyOf = (call: RecordedCall | undefined): string | null => new Headers(call?.init?.headers).get("Idempotency-Key");

beforeEach(() => {
  setLocation(`/confie/interventions/${INTERVENTION_ID}`);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openDialog(name: string) {
  const view = renderApi(<InterventionScreen id={INTERVENTION_ID} />);
  await view.user.click(await screen.findByRole("button", { name }));
  return { ...view, dialog: await screen.findByRole("dialog") };
}

describe("décision sur devis depuis l'espace propriétaire", () => {
  it("accepte le devis avec les versions lues, une clé d'idempotence et sans commentaire", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one(OUTCOME) } });
    const { user, dialog } = await openDialog("Accepter le devis");

    expect(within(dialog).getByText("DV-2026-0007")).toBeTruthy();
    expect(within(dialog).getByText("Plomberie Koffi")).toBeTruthy();
    expect(within(dialog).getByText("120 €")).toBeTruthy();
    expect(within(dialog).getByText(/ma confirmation par double authentification/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));

    expect(await screen.findByText("Devis accepté. Votre décision est enregistrée et l’agence en est informée.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    const [call] = decisionCalls(stub);
    expect(call?.json).toEqual({ decision: "accept", lock_version: 3, quote_fingerprint: QUOTE_FINGERPRINT, statement_version: "v1" });
    expect(keyOf(call)).toMatch(/^[0-9a-f]{32}$/);
    expect(stub.count("GET", `/api/v1/owner/interventions/${INTERVENTION_ID}`)).toBe(2);
  });

  it("exige un motif de cinq caractères pour refuser et l'envoie", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one({ ...OUTCOME, status: "refused", comment: "Montant trop élevé" }) } });
    const { user, dialog } = await openDialog("Refuser le devis");

    await user.click(within(dialog).getByRole("button", { name: "Refuser le devis" }));
    expect(within(dialog).getByText("Ce champ est obligatoire : 5 caractères au moins.")).toBeTruthy();
    expect(decisionCalls(stub)).toHaveLength(0);

    await user.type(within(dialog).getByRole("textbox", { name: "Motif du refus" }), "  Montant trop élevé  ");
    await user.click(within(dialog).getByRole("button", { name: "Refuser le devis" }));

    expect(await screen.findByText(/Devis refusé/)).toBeTruthy();
    expect(decisionCalls(stub)[0]?.json).toMatchObject({ decision: "refuse", comment: "Montant trop élevé" });
  });

  it("transmet une demande de précision", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one({ ...OUTCOME, status: "question" }) } });
    const { user, dialog } = await openDialog("Demander une précision");

    await user.type(within(dialog).getByRole("textbox", { name: "Votre question" }), "Quelles fournitures ?");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer ma question" }));

    expect(await screen.findByText(/Votre question est enregistrée/)).toBeTruthy();
    expect(decisionCalls(stub)[0]?.json).toMatchObject({ decision: "question", comment: "Quelles fournitures ?" });
  });

  it("rejoue la même clé d'idempotence après une panne réseau", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one(OUTCOME) } });
    const { user, dialog } = await openDialog("Accepter le devis");
    const original = globalThis.fetch;
    const keys: (string | null)[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && urlOf(input).endsWith("/decision")) keys.push(new Headers(init.headers).get("Idempotency-Key"));
      if (keys.length === 1 && init?.method === "POST" && urlOf(input).endsWith("/decision")) {
        return Promise.reject(new TypeError("réseau"));
      }
      return original(input, init);
    });

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));
    expect(await within(dialog).findByText(/Le serveur est injoignable/)).toBeTruthy();
    expect(within(dialog).getByText(/ne sera enregistrée qu’une seule fois/)).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));
    await screen.findByText(/Devis accepté/);

    expect(decisionCalls(stub)).toHaveLength(1);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("génère une clé différente pour une nouvelle intention", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one(OUTCOME) } });
    const view = renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await view.user.click(await screen.findByRole("button", { name: "Accepter le devis" }));
      await view.user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Accepter le devis" }));
      await waitFor(() => {
        expect(decisionCalls(stub)).toHaveLength(attempt + 1);
      });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    }

    const [first, second] = decisionCalls(stub);
    expect(keyOf(first)).not.toBe(keyOf(second));
  });

  it("recharge et prévient quand la demande a changé (approval_stale)", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: problem(409, "approval_stale") });
    const { user, dialog } = await openDialog("Accepter le devis");

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));

    expect(await screen.findByText("Décision non enregistrée")).toBeTruthy();
    expect(screen.getByText(/a changé depuis votre lecture/)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(stub.count("GET", `/api/v1/owner/interventions/${INTERVENTION_ID}`)).toBe(2);
    });
  });

  it("annonce une décision déjà enregistrée sans rien modifier", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: { body: one({ ...OUTCOME, replayed: true }) } });
    const { user, dialog } = await openDialog("Accepter le devis");

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));

    expect(await screen.findByText("Cette décision était déjà enregistrée : rien n’a été modifié.")).toBeTruthy();
  });

  it("renvoie vers la confirmation par code de l'application d'authentification, avec retour sur la page", async () => {
    window.history.pushState({}, "", `/confie/interventions/${INTERVENTION_ID}?agency=1#haut`);
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: problem(403, "reauthentication_required") });
    const { user, dialog } = await openDialog("Accepter le devis");

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));

    const link = await within(dialog).findByRole("link", { name: "Confirmer mon identité" });
    const href = new URL(link.getAttribute("href") ?? "");
    expect(href.origin).toBe(AUTH_URL);
    expect(href.pathname).toBe("/compte/securite/confirmation/code");
    expect(href.searchParams.get("exige")).toBe("code");
    const suite = new URL(href.searchParams.get("suite") ?? "", AUTH_URL);
    expect(suite.pathname).toBe("/continuer");
    const back = new URL(suite.searchParams.get("return_to") ?? "");
    expect(back.pathname).toBe(`/confie/interventions/${INTERVENTION_ID}`);
    expect(back.hash).toBe("");
  });

  it("propose d'activer la double authentification quand elle manque", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: problem(403, "two_factor_required") });
    const { user, dialog } = await openDialog("Accepter le devis");

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));

    const link = await within(dialog).findByRole("link", { name: "Activer la double authentification" });
    expect(link.getAttribute("href")).toBe(`${AUTH_URL}/compte/securite/double-authentification`);
  });

  it("traduit la limite de débit et garde le dialogue ouvert", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) }, [DECISION]: problem(429, "too_many", {}) });
    const { user, dialog } = await openDialog("Accepter le devis");

    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));

    expect(await within(dialog).findByText(/Trop de demandes en peu de temps/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("place le focus dans le dialogue, sans violation d'accessibilité, et le rend au déclencheur à la fermeture", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    const { user, dialog } = await openDialog("Refuser le devis");

    expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: "Motif du refus" }));
    await expectNoA11yViolations(document.body);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Refuser le devis" }));
  });
});

describe("décision masquée selon le droit d'écrire", () => {
  it("n'expose aucune action à un co-indivisaire", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } }, [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText(/Seul le titulaire du mandat ou son représentant peut décider/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accepter|Refuser|précision/ })).toBeNull();
  });

  it("n'expose aucune action pendant la période de grâce", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, read_only: true, in_grace: true, access_until: "2027-03-31" }] } }, [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText(/lecture seule jusqu’au 31\/03\/2027/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accepter|Refuser|précision/ })).toBeNull();
  });

  it("refuse de décider sur une version du texte de mention inconnue", async () => {
    const detail = { ...INTERVENTION_DETAIL, approvals: [{ ...INTERVENTION_DETAIL.approvals[0], statement_version: "v9" }] };
    stubApi({ [DETAIL]: { body: one(detail) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Décision indisponible depuis cette page")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accepter/ })).toBeNull();
  });

  it("n'expose pas d'action sur une demande déjà tranchée", async () => {
    const detail = { ...INTERVENTION_DETAIL, approvals: [{ ...INTERVENTION_DETAIL.approvals[0], status: "accepted", statement_version: null, decided_at: "2026-11-15T10:00:00+00:00", decided_via: "owner_space" }] };
    stubApi({ [DETAIL]: { body: one(detail) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    await screen.findByRole("region", { name: "Demandes d’accord" });
    expect(screen.queryByRole("button", { name: /Accepter|Refuser|précision/ })).toBeNull();
  });

  it("ne propose plus de question quand une précision est déjà demandée", async () => {
    const detail = { ...INTERVENTION_DETAIL, approvals: [{ ...INTERVENTION_DETAIL.approvals[0], status: "question" }] };
    stubApi({ [DETAIL]: { body: one(detail) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByRole("button", { name: "Accepter le devis" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refuser le devis" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Demander une précision" })).toBeNull();
  });
});
