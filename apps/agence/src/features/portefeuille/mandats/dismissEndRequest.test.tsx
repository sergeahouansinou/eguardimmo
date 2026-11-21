import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem } from "../api/testing";
import type { MockRoute } from "../api/testing";
import { renderPortefeuille } from "../testing";
import { MandatDetailPage } from "./MandatDetailPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);
const ENDPOINT = mandatePath("/end-request");
const DISMISS = mandatePath("/end-request/dismiss");
const TITLE = "Classer sans suite la demande de fin du mandat M-2026-0001";

const request = (overrides: Record<string, unknown> = {}) => ({
  id: "01934f6e-0000-7000-8000-0000000000e9",
  mandate_id: ID.mandate,
  status: "pending",
  reason: "Je vends le bien au printemps.",
  requested_at: "2026-11-14T09:15:00+00:00",
  cancelled_at: null,
  decided_at: null,
  decision_note: null,
  ...overrides,
});
const dismissed = (note: string | null = null) => ({ body: { data: request({ status: "dismissed", decided_at: "2026-11-16T10:00:00+00:00", decision_note: note }) } });

function renderDetail(dismiss: MockRoute, canWrite = true) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: () => ({ body: page([mandateSummary({ has_end_request: true })]) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    [`GET ${mandatePath()}`]: { body: { data: mandateDetail() } },
    [`GET ${ENDPOINT}`]: { body: { data: request() } },
    [`POST ${DISMISS}`]: dismiss,
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, ...renderPortefeuille(<MandatDetailPage id={ID.mandate} />, source) };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Classer sans suite" }));
  return screen.findByRole("dialog", { name: TITLE });
}

beforeEach(() => {
  resetNavigation();
});

describe("classement sans suite d'une demande de fin de mandat", () => {
  it("envoie la note, annonce la demande classée et recharge le portefeuille sans réafficher la demande en attente", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(dismissed("Vu au téléphone."));
    const dialog = await openDialog(user);
    await expectNoA11yViolations(document.body);

    await user.type(within(dialog).getByRole("textbox", { name: "Note (facultative)" }), "  Vu au téléphone.  ");
    expect(within(dialog).getByText("16 / 500 caractères")).toBeTruthy();
    const listCalls = callsTo("GET", orgPath("/mandates")).length;
    await user.click(within(dialog).getByRole("button", { name: "Classer sans suite" }));

    expect(await screen.findByText("Demande de fin de mandat classée sans suite le 16/11/2026")).toBeTruthy();
    expect(screen.getByText(/Vu au téléphone\./)).toBeTruthy();
    expect(screen.getByText("Demande de fin du mandat M-2026-0001 classée sans suite")).toBeTruthy();
    expect(callsTo("POST", DISMISS).map((call) => call.body)).toEqual([{ note: "Vu au téléphone." }]);
    await waitFor(() => { expect(callsTo("GET", orgPath("/mandates")).length).toBeGreaterThan(listCalls); });
    expect(screen.queryByText(/Le propriétaire a demandé la fin du mandat/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("n'envoie aucune note quand le champ est vide ou blanc", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(dismissed());
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByRole("textbox", { name: "Note (facultative)" }), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Classer sans suite" }));

    await screen.findByText("Demande de fin de mandat classée sans suite le 16/11/2026");
    expect(callsTo("POST", DISMISS).map((call) => call.body)).toEqual([{}]);
  });

  it("refuse une note de plus de 500 caractères sans appeler le serveur", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(dismissed());
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("textbox", { name: "Note (facultative)" }));
    await user.paste("a".repeat(501));

    expect(within(dialog).getByText("La note ne peut pas dépasser 500 caractères.")).toBeTruthy();
    expect(within(dialog).getByText("501 / 500 caractères")).toBeTruthy();
    const submit = within(dialog).getByRole("button", { name: "Classer sans suite" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    await user.click(submit);
    expect(callsTo("POST", DISMISS)).toHaveLength(0);

    await user.clear(within(dialog).getByRole("textbox", { name: "Note (facultative)" }));
    await user.paste("a".repeat(500));
    expect(within(dialog).queryByText("La note ne peut pas dépasser 500 caractères.")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Classer sans suite" }).hasAttribute("disabled")).toBe(false);
  });

  it("ferme la fenêtre sans rien envoyer quand on annule", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(dismissed());
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(callsTo("POST", DISMISS)).toHaveLength(0);
    expect(screen.getByText(/a demandé la fin du mandat/)).toBeTruthy();
  });

  it("accepte le rejeu du serveur, qui renvoie la même demande déjà classée", async () => {
    const user = userEvent.setup();
    renderDetail(dismissed("Déjà vu."));
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Classer sans suite" }));

    expect(await screen.findByText("Demande de fin de mandat classée sans suite le 16/11/2026")).toBeTruthy();
    expect(screen.getByText(/Déjà vu\./)).toBeTruthy();
  });

  it("refuse une réponse du serveur qui ne confirme pas le classement", async () => {
    const user = userEvent.setup();
    renderDetail({ body: { data: request() } });
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Classer sans suite" }));

    expect(await screen.findByText("La demande n’a pas pu être classée")).toBeTruthy();
    expect(screen.getByText(/Réponse inattendue du serveur/)).toBeTruthy();
  });

  it.each([
    [409, "mandate_end_request_not_pending", /a déjà été traitée ou retirée/],
    [404, "mandate_end_request_not_found", /Il n’y a plus de demande de fin de mandat à classer/],
    [404, "mandate_not_found", /Ce mandat n’existe plus ou n’est plus accessible/],
    [403, "role_forbidden", /Votre rôle ne permet pas de modifier les mandats/],
  ])("explique l'erreur %i %s et resynchronise la fiche", async (status, code, message) => {
    const user = userEvent.setup();
    const { callsTo } = renderDetail(problem(status, code, "Message du serveur"));
    const dialog = await openDialog(user);
    const reads = callsTo("GET", ENDPOINT).length;

    await user.click(within(dialog).getByRole("button", { name: "Classer sans suite" }));

    expect(await screen.findByText("La demande n’a pas pu être classée")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText("Message du serveur")).toBeNull();
    await waitFor(() => { expect(callsTo("GET", ENDPOINT).length).toBeGreaterThan(reads); });
  });
});
