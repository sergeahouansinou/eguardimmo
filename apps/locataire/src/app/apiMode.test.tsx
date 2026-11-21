import { screen, waitFor, within } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEASE_ID, leasePage, summary } from "@/tenant/responses.fixtures";
import { resetNavigation } from "../../test/navigation";
import { stubApi } from "../../test/api";
import { supportTicketFixture as supportTicket } from "@eguardimmo/messagerie/support-testing";
import { installmentsAll } from "@/tenant/rentResponses.fixtures";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "http://api.test", NEXT_PUBLIC_AUTH_URL: "http://auth.test", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
}));

const DEMO_TEXTS = ["Koffi", "Adjovi", "Les Tilleuls", "Apt A1", "Mutuelle Horizon", "Cabinet Delmas", "gestion@example.com", "01 00 00 00 10", "31/03/2027"];

async function mountApp(pathname: string, page: "home" | "aide" | "gated" | "loyers" | "notifications" | "toutes" | "messages" | "supportNew" | "supportBoard") {
  resetNavigation(pathname);
  const { Providers } = await import("./providers");
  const { EspaceShell } = await import("./(espace)/EspaceShell");
  const Home = (await import("./(espace)/page")).default;
  const Aide = (await import("./(espace)/aide/page")).default;
  const Loyers = (await import("./(espace)/loyers/page")).default;
  const Prelevement = (await import("./(espace)/loyers/prelevement/page")).default;
  const Preferences = (await import("./(espace)/notifications/page")).default;
  const Toutes = (await import("./(espace)/notifications/toutes/page")).default;
  const Messages = (await import("./(espace)/messages/page")).default;
  const SupportBoard = (await import("./(espace)/support/page")).default;
  const SupportNew = (await import("./(espace)/support/nouvelle/page")).default;
  const Page = { home: Home, aide: Aide, gated: Prelevement, loyers: Loyers, notifications: Preferences, toutes: Toutes, messages: Messages, supportNew: SupportNew, supportBoard: SupportBoard }[page];
  return render(
    <Providers>
      <EspaceShell>
        <Page />
      </EspaceShell>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("application locataire en mode api", () => {
  it("ouvre la coquille avec l’identité du compte et les baux réels, sans donnée de démonstration", async () => {
    const api = stubApi({
      "GET /api/v1/tenant/leases": { body: leasePage([summary()]) },
      "GET /api/v1/support/tickets": { body: { data: [] } },
      "GET /api/v1/tenant/conversations/unread": { body: { data: { unread: 0 } } },
    });

    await mountApp("/", "home");

    expect(await screen.findByRole("heading", { level: 2, name: "BAIL-2026-001" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Compte, espace de travail Espace locataire/ })).toBeTruthy();
    const navigation = screen.getAllByRole("navigation").map((node) => node.textContent).join(" ");
    expect(navigation).toContain("Mes baux");
    expect(navigation).toContain("Mes accès");
    expect(navigation).toContain("Aide et support");
    expect(document.body.textContent).not.toContain("Bonjour Koffi");
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    const paths = new Set(api.calls.map((call) => call.path));
    expect(paths).toContain("/api/v1/me/profiles");
    expect(paths).toContain("/api/v1/me");
    expect(paths).toContain("/api/v1/tenant/leases");
    expect([...paths].filter((path) => path.includes("/conversations"))).toEqual(["/api/v1/tenant/conversations/unread"]);
  });

  it("affiche dans la navigation le nombre de messages non lus servi par le serveur", async () => {
    stubApi({
      "GET /api/v1/tenant/leases": { body: leasePage([summary()]) },
      "GET /api/v1/support/tickets": { body: { data: [] } },
      "GET /api/v1/tenant/conversations/unread": { body: { data: { unread: 3 } } },
    });

    await mountApp("/", "home");

    const link = await screen.findByRole("link", { name: /Messages/ });
    expect(link.getAttribute("href")).toBe("/messages");
    await waitFor(() => { expect(link.textContent).toContain("3"); });
  });

  it("sert la boîte de messages sans « Bientôt disponible » ni donnée de démonstration", async () => {
    const api = stubApi({
      "GET /api/v1/support/tickets": { body: { data: [] } },
      "GET /api/v1/tenant/conversations": { body: { data: [], meta: { has_more: false, next_cursor: null } } },
      "GET /api/v1/tenant/conversations/unread": { body: { data: { unread: 0 } } },
      "GET /api/v1/tenant/conversations/options": { body: { data: [] } },
    });

    await mountApp("/messages", "messages");

    expect(await screen.findByText("Aucune conversation")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(api.calls.some((call) => call.path === "/api/v1/tenant/conversations")).toBe(true);
  });

  it("garde une page non reliée derrière « Bientôt disponible » dans la coquille réelle", async () => {
    stubApi();

    await mountApp("/loyers/prelevement", "gated");

    expect(await screen.findByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Prélèvement automatique" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Payer mon loyer" }).getAttribute("href")).toBe("/loyers/payer");
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("sert Mes loyers dans la coquille réelle, avec la navigation des loyers et sans donnée de démonstration", async () => {
    const api = stubApi({
      "GET /api/v1/tenant/leases": { body: leasePage([summary()]) },
      "GET /api/v1/tenant/rent/installments": { body: installmentsAll },
      "GET /api/v1/support/tickets": { body: { data: [] } },
    });

    await mountApp("/loyers", "loyers");

    expect(await screen.findByRole("heading", { level: 1, name: "Mes loyers" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Novembre 2026" })).toBeTruthy();
    const navigation = screen.getAllByRole("navigation").map((node) => node.textContent).join(" ");
    expect(navigation).toContain("Mes quittances");
    expect(navigation).toContain("Mes paiements");
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(api.calls.filter((call) => call.path === "/api/v1/tenant/rent/installments")).toHaveLength(1);
  });

  it("branche la cloche et « Toutes les notifications » sur le serveur, sans organisation", async () => {
    const api = stubApi({
      "GET /api/v1/notifications/unread-count": { body: { data: { unread: 1 } } },
      "GET /api/v1/notifications": {
        body: {
          data: [
            {
              id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9aa643",
              type: "tenant.receipt_issued",
              tone: "success",
              title: "Quittance émise",
              detail: "Votre quittance est disponible.",
              unread: true,
              href: "/loyers",
              organization_id: "01a1ee5a-0b9c-728d-8775-faf0fdebd2c4",
              created_at: "2026-11-16T10:00:00+00:00",
              read_at: null,
            },
          ],
          meta: { next_cursor: null },
        },
      },
    });

    await mountApp("/notifications/toutes", "toutes");

    expect(await screen.findByRole("button", { name: "Notifications, 1 non lues" })).toBeTruthy();
    expect((await screen.findByRole("link", { name: /Quittance émise/ })).getAttribute("href")).toBe("/loyers");
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    expect(api.calls.filter((call) => call.path.startsWith("/api/v1/notifications")).every((call) => !("organization" in call.query))).toBe(true);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("sert les préférences de notification du locataire depuis le serveur", async () => {
    stubApi({
      "GET /api/v1/notifications/unread-count": { body: { data: { unread: 0 } } },
      "GET /api/v1/notifications/preferences": {
        body: {
          data: {
            types: [
              {
                type: "tenant.receipt_issued",
                label: "Quittance émise",
                group: "Loyers",
                audience: "tenant",
                channels: [
                  { channel: "in_app", label: "Application", enabled: true, locked: false },
                  { channel: "email", label: "E-mail", enabled: true, locked: false },
                  { channel: "push", label: "Mobile", enabled: true, locked: false },
                ],
              },
            ],
          },
        },
      },
    });

    await mountApp("/notifications", "notifications");

    expect(await screen.findByRole("switch", { name: "Quittance émise, E-mail" })).toBeTruthy();
    expect(screen.queryByRole("switch", { name: /Mobile/ })).toBeNull();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
  });

  it("sert l’aide avec le support eGuardImmo et un contenu éditorial sans gestionnaire fictif", async () => {
    stubApi({ "GET /api/v1/support/tickets": { body: { data: [] } } });
    const user = userEvent.setup();

    await mountApp("/aide", "aide");

    expect(await screen.findByRole("heading", { level: 1, name: "Aide" })).toBeTruthy();
    expect(await screen.findByText("Contacter le support eGuardImmo")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Écrire un message" })).toBeNull();
    expect(screen.queryByText("Contacter le gestionnaire")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Écrire au support/ })[0]?.getAttribute("href")).toBe("/support/nouvelle");
    await user.click(screen.getByText("Comment obtenir l’accès à mon bail ?"));
    expect(await screen.findByRole("link", { name: "Ouvrir mes baux" })).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("bloque tout l’espace sans profil locataire : ni coquille ni données", async () => {
    stubApi({ "GET /api/v1/me/profiles": { body: { data: [] } } });

    await mountApp("/", "home");

    expect(await screen.findByText("Aucun accès locataire")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Sections disponibles" })).toBeNull();
    await waitFor(() => { expect(screen.queryByText("Mes baux")).toBeNull(); });
    expect(within(document.body).queryByText("BAIL-2026-001")).toBeNull();
  });
});

describe("support du locataire en mode api", () => {
  it("affiche le statut du support lu sur le serveur et le nombre de réponses à lire dans la navigation", async () => {
    stubApi({
      "GET /api/v1/support/status": { body: { data: { online: false, hours_label: "Lun–ven 9 h – 18 h (Europe/Paris)", response_label: "Réponse sous 1 jour ouvré", timezone: "Europe/Paris", hours: [] } } },
      "GET /api/v1/support/tickets": { body: { data: [supportTicket({ status: "waiting", updated_at: "2026-11-19T10:00:00+00:00", requester_last_read_at: "2026-11-19T09:00:00+00:00" })] } },
      "GET /api/v1/tenant/conversations/unread": { body: { data: { unread: 0 } } },
    });
    const user = userEvent.setup();

    await mountApp("/", "home");

    const link = await screen.findByRole("link", { name: /Support/ });
    expect(link.getAttribute("href")).toBe("/support");
    await waitFor(() => { expect(link.textContent).toContain("1"); });
    await user.click(await screen.findByRole("button", { name: /Aide et support/ }));
    expect(await screen.findByText("Hors ligne")).toBeTruthy();
  });

  it("ouvre une demande de l’espace locataire, sans organisation, avec un client_id", async () => {
    const api = stubApi({
      "GET /api/v1/support/tickets": { body: { data: [] } },
      "POST /api/v1/support/tickets": { status: 422, body: { type: "x", title: "Invalide", status: 422, code: "validation_failed", detail: "Certains champs sont invalides." } },
    });
    const user = userEvent.setup();

    await mountApp("/support/nouvelle", "supportNew");
    expect(await screen.findByPlaceholderText("Ex. Je ne retrouve pas ma quittance de novembre")).toBeTruthy();
    await user.type(await screen.findByLabelText("Sujet"), "Je ne vois pas mon bail");
    await user.type(screen.getByLabelText("Message"), "Mon bail n’apparaît pas dans Mes baux.");
    await user.click(screen.getByRole("button", { name: "Envoyer au support" }));

    await waitFor(() => { expect(api.count("POST", "/api/v1/support/tickets")).toBe(1); });
    const post = api.calls.find((call) => call.method === "POST" && call.path === "/api/v1/support/tickets");
    expect(post?.json).toMatchObject({ space: "tenant", category: "other", subject: "Je ne vois pas mon bail" });
    expect(post?.json).not.toHaveProperty("organization_id");
    expect(typeof (post?.json as { client_id?: unknown } | undefined)?.client_id).toBe("string");
    expect(await screen.findByText("Envoi impossible")).toBeTruthy();
  });

  it("sert la liste des demandes sans donnée de démonstration", async () => {
    stubApi({ "GET /api/v1/support/tickets": { body: { data: [supportTicket()] } } });

    await mountApp("/support", "supportBoard");

    expect(await screen.findByRole("heading", { level: 1, name: "Mes demandes au support" })).toBeTruthy();
    expect(await screen.findByText("Quittance de novembre introuvable")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });
});

describe("mode démo inchangé", () => {
  it("garde l’accueil de démonstration et ne contacte pas le serveur", async () => {
    state.mode = "demo";
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("Aucun appel réseau attendu")));
    vi.stubGlobal("fetch", fetchMock);

    await mountApp("/", "home");

    expect(await screen.findByText(/Koffi/)).toBeTruthy();
    expect(screen.queryByText("Aucun accès locataire")).toBeNull();
    expect(LEASE_ID).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
