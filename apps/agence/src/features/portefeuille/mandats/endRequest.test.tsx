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

const endRequest = (overrides: Record<string, unknown> = {}) => ({
  data: {
    id: "01934f6e-0000-7000-8000-0000000000e9",
    mandate_id: ID.mandate,
    status: "pending",
    reason: "Je vends le bien au printemps.",
    requested_at: "2026-11-14T09:15:00+00:00",
    cancelled_at: null,
    decided_at: null,
    decision_note: null,
    ...overrides,
  },
});

function renderDetail(route: MockRoute, canWrite = true, detailOverrides: Record<string, unknown> = {}) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: () => ({ body: page([mandateSummary()]) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    [`GET ${mandatePath()}`]: { body: { data: mandateDetail(detailOverrides) } },
    [`GET ${ENDPOINT}`]: route,
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, ...renderPortefeuille(<MandatDetailPage id={ID.mandate} />, source) };
}

beforeEach(() => {
  resetNavigation();
});

describe("demande de fin de mandat du propriétaire sur la fiche mandat", () => {
  it("annonce la demande avec sa date, son motif et le bouton de classement", async () => {
    const { container, callsTo } = renderDetail({ body: endRequest() });

    await screen.findByText("Le propriétaire a demandé la fin du mandat le 14/11/2026");
    const alert = screen.getByRole("status");

    expect(await screen.findByText("Je vends le bien au printemps.")).toBeTruthy();
    expect(screen.getByText(/à traiter avec le propriétaire\. La résiliation reste à votre initiative/)).toBeTruthy();
    expect(within(alert).getByRole("button", { name: "Classer sans suite" })).toBeTruthy();
    expect(callsTo("GET", ENDPOINT)).toHaveLength(1);
    await expectNoA11yViolations(container);
  });

  it("ne propose pas de classer la demande à un rôle qui ne peut pas écrire", async () => {
    renderDetail({ body: endRequest() }, false);

    await screen.findByText("Le propriétaire a demandé la fin du mandat le 14/11/2026");

    expect(screen.queryByRole("button", { name: "Classer sans suite" })).toBeNull();
  });

  it("n'affiche aucun bandeau quand aucune demande ne vit", async () => {
    const { callsTo } = renderDetail({ body: { data: null } });

    await screen.findByText("Mandat M-2026-0001");
    await waitFor(() => { expect(callsTo("GET", ENDPOINT)).toHaveLength(1); });

    expect(screen.queryByText(/a demandé la fin du mandat/)).toBeNull();
    expect(screen.queryByText(/non vérifiée/)).toBeNull();
  });

  it("n'affiche pas de motif quand le propriétaire n'en a pas donné", async () => {
    renderDetail({ body: endRequest({ reason: null }) });

    await screen.findByText(/a demandé la fin du mandat/);

    expect(screen.queryByText(/Motif indiqué/)).toBeNull();
  });

  it("annonce une demande classée sans suite avec sa date et la note de l'agence, en texte brut", async () => {
    const { container } = renderDetail({
      body: endRequest({ status: "dismissed", decided_at: "2026-11-15T10:00:00+00:00", decision_note: "<i>Vu au téléphone</i>\nLe mandat continue." }),
    });

    await screen.findByText("Demande de fin de mandat classée sans suite le 15/11/2026");

    expect(screen.getByText(/Demande du propriétaire du 14\/11\/2026 : le mandat se poursuit/)).toBeTruthy();
    expect(screen.getByText(/<i>Vu au téléphone<\/i>/)).toBeTruthy();
    expect(document.querySelector("i")).toBeNull();
    expect(screen.queryByRole("button", { name: "Classer sans suite" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("annonce une demande satisfaite par la résiliation du mandat", async () => {
    renderDetail(
      { body: endRequest({ status: "fulfilled", decided_at: "2026-11-16T08:00:00+00:00" }) },
      true,
      { status: "terminated", end_date: "2027-03-01", termination: { reason: "Accord amiable", notice_given_on: "2026-11-10", effective_on: "2027-03-01", note: null } },
    );

    await screen.findByText("Demande de fin de mandat satisfaite le 16/11/2026");

    expect(screen.getByText(/Le mandat a été résilié à la suite de la demande du propriétaire du 14\/11\/2026/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Classer sans suite" })).toBeNull();
  });

  it("annonce une demande retirée par le propriétaire, sans rien à traiter", async () => {
    renderDetail({ body: endRequest({ status: "cancelled", cancelled_at: "2026-11-15T08:00:00+00:00" }) });

    await screen.findByText("Le propriétaire a retiré sa demande de fin de mandat le 15/11/2026");

    expect(screen.getByText(/le mandat se poursuit, rien à traiter/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Classer sans suite" })).toBeNull();
  });

  it("affiche le motif comme du texte, jamais comme du HTML", async () => {
    renderDetail({ body: endRequest({ reason: "<b>urgent</b> <img src=x onerror=alert(1)>" }) });

    expect(await screen.findByText(/<b>urgent<\/b>/)).toBeTruthy();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("distingue une demande non vérifiable d'une absence de demande, et permet de réessayer", async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderDetail(() => {
      calls += 1;
      return calls === 1 ? problem(503, "service_unavailable", "Indisponible") : { body: endRequest() };
    });

    expect(await screen.findByText("Demande de fin de mandat non vérifiée")).toBeTruthy();
    expect(screen.queryByText(/a demandé la fin du mandat/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Le propriétaire a demandé la fin du mandat le 14/11/2026")).toBeTruthy();
    expect(screen.queryByText("Demande de fin de mandat non vérifiée")).toBeNull();
  });

  it.each([[403, "role_forbidden"], [404, "mandate_not_found"], [500, "server_error"]])("signale une demande non vérifiée sur %i", async (status, code) => {
    renderDetail(problem(status, code, "Erreur"));

    expect(await screen.findByText("Demande de fin de mandat non vérifiée")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mandat M-2026-0001" })).toBeTruthy();
  });
});
