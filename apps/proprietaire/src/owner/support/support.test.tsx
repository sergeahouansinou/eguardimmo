import { SupportNewRequestPage, SupportRequestsPage, SupportTicketPage } from "@eguardimmo/messagerie";
import {
  SECOND_TICKET_ID,
  TICKET_ID,
  statusResponse,
  supportMessageFixture,
  supportReplyFixture,
  supportTicketFixture,
  ticketDetailResponse,
  ticketListResponse,
} from "@eguardimmo/messagerie/support-testing";
import { screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { push, setLocation } from "../../../test/navigation";
import { problem } from "../responses.fixtures";
import { OwnerSupportProvider } from "./OwnerSupportProvider";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const ROOT = "/api/v1/support";
const TICKET = `${ROOT}/tickets/${TICKET_ID}`;
const owner = (overrides = {}) => supportTicketFixture({ space: "owner", requester: { id: "0193a5e1-0000-7000-8000-0000000001c1", name: "Awa Koffi" }, ...overrides });

beforeEach(() => {
  push.mockClear();
  setLocation("/confie/support");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ui: ReactElement) {
  return renderApi(<OwnerSupportProvider>{ui}</OwnerSupportProvider>);
}

describe("demandes au support du propriétaire (api)", () => {
  it("liste les demandes avec le statut du support et des liens vers /confie/support", async () => {
    stubApi({
      [`GET ${ROOT}/tickets`]: { body: ticketListResponse([owner({ status: "waiting" }), owner({ id: SECOND_TICKET_ID, reference: "SUP-2026-0002", subject: "Facture", status: "resolved" })]) },
      [`GET ${ROOT}/status`]: { body: statusResponse(true) },
    });
    const { container } = mount(<SupportRequestsPage />);

    const list = await screen.findByRole("list", { name: "Mes demandes" });
    expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([`/confie/support/${TICKET_ID}`, `/confie/support/${SECOND_TICKET_ID}`]);
    expect(screen.getByRole("link", { name: /Nouvelle demande/ }).getAttribute("href")).toBe("/confie/support/nouvelle");
    await expectNoA11yViolations(container);
  });

  it("annonce l’absence de demande, puis traduit une erreur du serveur", async () => {
    const api = stubApi({ [`GET ${ROOT}/tickets`]: { body: ticketListResponse([]) }, [`GET ${ROOT}/status`]: { body: statusResponse() } });
    const first = mount(<SupportRequestsPage />);

    expect(await screen.findByText("Aucune demande pour le moment")).toBeTruthy();
    first.unmount();

    api.on("GET", `${ROOT}/tickets`, problem(503, "unavailable"));
    mount(<SupportRequestsPage />);
    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
  });

  it("ouvre une demande de l’espace propriétaire avec un client_id, puis ouvre le fil", async () => {
    const api = stubApi({
      [`GET ${ROOT}/status`]: { body: statusResponse() },
      [`POST ${ROOT}/tickets`]: { status: 201, body: ticketDetailResponse(owner(), [supportMessageFixture({ body: "Je n’arrive pas à télécharger mon relevé." })]) },
    });
    const { user } = mount(<SupportNewRequestPage />);

    await user.type(await screen.findByRole("textbox", { name: "Sujet" }), "Relevé introuvable");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Je n’arrive pas à télécharger mon relevé.");
    await user.click(screen.getByRole("button", { name: "Envoyer au support" }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/confie/support/${TICKET_ID}`); });
    const sent = api.calls.find((call) => call.method === "POST" && call.path === `${ROOT}/tickets`);
    expect(sent?.json).toMatchObject({ space: "owner", category: "other", subject: "Relevé introuvable", body: "Je n’arrive pas à télécharger mon relevé." });
    expect(sent?.json).not.toHaveProperty("organization_id");
    expect((sent?.json as { client_id: string }).client_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it("refuse une demande vide sans appeler le serveur", async () => {
    const api = stubApi({ [`GET ${ROOT}/status`]: { body: statusResponse() } });
    const { user } = mount(<SupportNewRequestPage />);

    await user.click(await screen.findByRole("button", { name: "Envoyer au support" }));

    expect(await screen.findByText("Saisissez un sujet")).toBeTruthy();
    expect(screen.getByText("Saisissez votre message")).toBeTruthy();
    expect(api.count("POST", `${ROOT}/tickets`)).toBe(0);
  });

  it("affiche le fil et envoie une réponse avec un client_id", async () => {
    const reply = supportReplyFixture();
    const api = stubApi({
      [`GET ${TICKET}`]: { body: ticketDetailResponse(owner({ status: "waiting" }), [supportMessageFixture(), reply]) },
      [`PATCH ${TICKET}`]: { body: ticketDetailResponse(owner({ status: "waiting" }), [supportMessageFixture(), reply]) },
      [`GET ${TICKET}/messages`]: { body: { data: [], meta: { has_more: false, status: "waiting", requester_last_read_at: null, support_last_read_at: null } } },
      [`GET ${ROOT}/status`]: { body: statusResponse() },
      [`POST ${TICKET}/messages`]: { status: 201, body: ticketDetailResponse(owner(), [supportMessageFixture(), reply, supportMessageFixture({ id: "0193a5e1-0000-7000-8000-0000000001d3", body: "Merci, c’est réglé." })]) },
    });
    const { user } = mount(<SupportTicketPage ticketId={TICKET_ID} />);

    expect(await screen.findByText("Bonjour, la quittance est dans « Loyers ».")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Votre message" }), "Merci, c’est réglé.");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findAllByText("Merci, c’est réglé.")).not.toHaveLength(0);
    const sent = api.calls.find((call) => call.method === "POST" && call.path === `${TICKET}/messages`);
    expect(sent?.json).toMatchObject({ body: "Merci, c’est réglé." });
    expect((sent?.json as { client_id: string }).client_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it("signale une demande introuvable ou hors de vos accès", async () => {
    stubApi({ [`GET ${TICKET}`]: problem(404, "not_found"), [`GET ${ROOT}/status`]: { body: statusResponse() } });
    mount(<SupportTicketPage ticketId={TICKET_ID} />);

    expect((await screen.findByRole("alert")).textContent).toContain("n’existe pas ou n’est plus accessible");
    expect(screen.queryByRole("textbox", { name: "Votre message" })).toBeNull();
  });
});
