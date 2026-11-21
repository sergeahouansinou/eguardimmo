import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { announcementFixture, announcementListResponse, readAnnouncementFixture } from "@eguardimmo/messagerie/announcements-testing";
import { unreadResponse } from "@eguardimmo/messagerie/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL, AUTH_URL, stubApi } from "../../test/api";
import { setLocation } from "../../test/navigation";
import { ME_RESPONSE } from "./responses.fixtures";

vi.mock("@/lib/env", () => ({
  dataSource: "api",
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_AUTH_URL: AUTH_URL, NEXT_PUBLIC_DATA_SOURCE: "api" }),
}));
vi.mock("next/navigation", async () => (await import("../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../test/navigation")).linkMock);

const UNREAD = "GET /api/v1/owner/conversations/unread";

beforeEach(() => {
  setLocation("/confie");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mountShell() {
  const { ConfieProviders } = await import("@/confie-config/ConfieProviders");
  const { ConfieShell } = await import("@/confie-config/ConfieShell");
  return render(
    <ConfieProviders>
      <ConfieShell>
        <p>Contenu de la page</p>
      </ConfieShell>
    </ConfieProviders>,
  );
}

describe("coquille de l’espace propriétaire en mode api", () => {
  it("affiche dans la navigation le nombre de messages non lus servi par le serveur", async () => {
    const api = stubApi({ "GET /api/v1/me": { body: ME_RESPONSE }, [UNREAD]: { body: unreadResponse(4) } });

    await mountShell();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    const link = await within(side).findByRole("link", { name: /Messages/ });
    expect(link.getAttribute("href")).toBe("/confie/messages");
    await waitFor(() => { expect(link.textContent).toContain("4"); });
    expect(api.calls.filter((call) => call.path.includes("/conversations")).map((call) => call.path)).toEqual(["/api/v1/owner/conversations/unread"]);
  });

  it("affiche dans la navigation le nombre d’annonces non lues, sans compter les annonces lues", async () => {
    const api = stubApi({
      "GET /api/v1/me": { body: ME_RESPONSE },
      [UNREAD]: { body: unreadResponse(0) },
      "GET /api/v1/owner/announcements": { body: announcementListResponse([announcementFixture(), announcementFixture({ id: "0193a5e1-0000-7000-8000-0000000003a9" }), readAnnouncementFixture({ id: "0193a5e1-0000-7000-8000-0000000003a8" })]) },
    });

    await mountShell();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    const link = await within(side).findByRole("link", { name: /Annonces/ });
    expect(link.getAttribute("href")).toBe("/confie/annonces");
    await waitFor(() => { expect(link.textContent).toContain("2"); });
    expect(api.calls.find((call) => call.path === "/api/v1/owner/announcements")?.query).toEqual({ per_page: "50" });
  });

  it("n’invente aucun compteur quand le serveur ne répond pas", async () => {
    const api = stubApi({ "GET /api/v1/me": { body: ME_RESPONSE }, [UNREAD]: { status: 503, body: { code: "service_unavailable", title: "x", status: 503 } } });

    await mountShell();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    const link = await within(side).findByRole("link", { name: /Messages/ });
    await waitFor(() => { expect(api.count("GET", "/api/v1/owner/conversations/unread")).toBe(1); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(link.textContent.trim()).toBe("Messages");
  });

  it("affiche dans la navigation le nombre de réponses du support à lire, avec le lien vers l’espace Support", async () => {
    stubApi({
      "GET /api/v1/me": { body: ME_RESPONSE },
      [UNREAD]: { body: unreadResponse(0) },
      "GET /api/v1/support/tickets": {
        body: {
          data: [
            {
              id: "0193a5e1-0000-7000-8000-0000000001a1",
              reference: "SUP-2026-0001",
              subject: "Reversement introuvable",
              organization: null,
              space: "owner",
              requester: { id: "0193a5e1-0000-7000-8000-0000000001c1", name: "Jeanne Dupont" },
              assignee: null,
              priority: "normal",
              status: "waiting",
              category: "billing",
              created_at: "2026-11-19T09:00:00+00:00",
              updated_at: "2026-11-19T10:00:00+00:00",
              requester_last_read_at: "2026-11-19T09:00:00+00:00",
              support_last_read_at: null,
              message_count: 2,
            },
          ],
        },
      },
    });

    await mountShell();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    const link = await within(side).findByRole("link", { name: /Support/ });
    expect(link.getAttribute("href")).toBe("/confie/support");
    await waitFor(() => { expect(link.textContent).toContain("1"); });
  });

  it("ouvre une demande de l’espace propriétaire, sans organisation, avec un client_id", async () => {
    const api = stubApi({
      "GET /api/v1/me": { body: ME_RESPONSE },
      [UNREAD]: { body: unreadResponse(0) },
      "GET /api/v1/support/tickets": { body: { data: [] } },
      "POST /api/v1/support/tickets": { status: 422, body: { type: "x", title: "Invalide", status: 422, code: "validation_failed", detail: "Invalide." } },
    });
    setLocation("/confie/support/nouvelle");
    const { SupportNewRequestPage } = await import("@eguardimmo/messagerie");
    const { ConfieProviders } = await import("@/confie-config/ConfieProviders");
    const user = userEvent.setup();
    render(
      <ConfieProviders>
        <SupportNewRequestPage />
      </ConfieProviders>,
    );

    expect(await screen.findByPlaceholderText("Ex. Je ne vois pas mon dernier compte rendu")).toBeTruthy();
    await user.type(screen.getByLabelText("Sujet"), "Reversement introuvable");
    await user.type(screen.getByLabelText("Message"), "Je ne vois pas le reversement.");
    await user.click(screen.getByRole("button", { name: "Envoyer au support" }));

    await waitFor(() => { expect(api.count("POST", "/api/v1/support/tickets")).toBe(1); });
    const post = api.calls.find((call) => call.method === "POST" && call.path === "/api/v1/support/tickets");
    expect(post?.json).toMatchObject({ space: "owner", subject: "Reversement introuvable" });
    expect(post?.json).not.toHaveProperty("organization_id");
    expect(typeof (post?.json as { client_id?: unknown }).client_id).toBe("string");
  });
});

