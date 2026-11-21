import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "../providers";
import { EspaceShell } from "./EspaceShell";

const ORG = "01934f6e-0000-7000-8000-00000000000b";

const state = vi.hoisted((): { mode: "demo" | "api"; pathname: string } => ({ mode: "api", pathname: "/" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => state.pathname,
}));

const FORBIDDEN = ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "Anaïs Roux", "Apt 12"];

function agencyProfile(role: string) {
  return { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] };
}

function stubApi(extra: Record<string, unknown> = {}, role = "owner") {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": agencyProfile(role),
    "/api/v1/me": {
      data: {
        id: "01934f6e-0000-7000-8000-0000000000b1",
        name: "Jeanne Dupont",
        email: "jeanne.dupont@example.com",
        email_verified_at: "2026-11-01T09:00:00+00:00",
        last_login_at: "2026-11-16T08:30:00+00:00",
        previous_login_at: null,
      },
    },
    [`/api/v1/org/${ORG}`]: { data: { id: ORG, kind: "agency", name: "Agence Soleil", country: "FR", currency: "EUR", timezone: "Europe/Paris", two_factor_required: false } },
    [`/api/v1/org/${ORG}/conversations/unread`]: { data: { internal: 1, tenant: 1, owner: 1 } },
    "/api/v1/notifications/unread-count": { data: { unread: 0 } },
    "/api/v1/notifications": { data: [], meta: { next_cursor: null } },
    ...extra,
  };
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

function renderEspace(children: React.ReactNode = <p>Contenu réel</p>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Providers>
      <QueryClientProvider client={client}>
        <EspaceShell>{children}</EspaceShell>
      </QueryClientProvider>
    </Providers>,
  );
}

const ACCOUNT = "Compte, espace de travail Agence Soleil";

beforeEach(() => {
  state.mode = "api";
  state.pathname = "/biens";
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coquille de l'espace agence en mode api", () => {
  it("affiche l'utilisateur et l'agence du serveur, sans aucune donnée de démonstration", async () => {
    stubApi();

    renderEspace();

    await userEvent.click(await screen.findByRole("button", { name: ACCOUNT }));
    const menu = await screen.findByRole("menu", { name: "Menu du compte" });
    expect(within(menu).getByText("Jeanne Dupont")).toBeTruthy();
    expect(within(menu).getByText("jeanne.dupont@example.com")).toBeTruthy();
    expect(within(menu).getByText("Titulaire")).toBeTruthy();
    expect(within(menu).queryByText(/membres/)).toBeNull();
    expect(within(menu).queryByText("Gratuit")).toBeNull();
    expect(screen.getByText("Contenu réel")).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it.each([
    ["admin", "Administrateur"],
    ["manager", "Gestionnaire"],
    ["accountant", "Comptable"],
  ])("traduit le rôle serveur %s", async (role, label) => {
    stubApi({}, role);

    renderEspace();

    await userEvent.click(await screen.findByRole("button", { name: ACCOUNT }));
    expect(within(await screen.findByRole("menu", { name: "Menu du compte" })).getByText(label)).toBeTruthy();
  });

  it("n'affiche que le compteur de messages non lus réel, sans compteur inventé", async () => {
    stubApi();

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    expect(await within(side).findByRole("link", { name: /Messages\s*3$/ })).toBeTruthy();
    for (const label of ["Mandats", "Biens sous mandat", "Impayés", "Reversements", "Comptes rendus", "Interventions"]) {
      expect(within(side).queryByRole("link", { name: new RegExp(`${label}\\s*\\d`) }), label).toBeNull();
    }
  });

  describe("support", () => {
    const TICKET = {
      id: "0193a5e1-0000-7000-8000-0000000001a1",
      reference: "SUP-2026-0001",
      subject: "Reversement introuvable",
      organization: "Agence Soleil",
      space: "organization",
      requester: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont" },
      assignee: null,
      priority: "normal",
      status: "waiting",
      category: "billing",
      created_at: "2026-11-19T09:00:00+00:00",
      updated_at: "2026-11-19T10:00:00+00:00",
      requester_last_read_at: "2026-11-19T09:00:00+00:00",
      support_last_read_at: null,
      message_count: 2,
    };
    const GRANT = {
      id: "0193a5e1-0000-7000-8000-0000000001f1",
      kind: "consent",
      status: "requested",
      scopes: ["settings"],
      reason: "Diagnostic",
      emergency_basis: null,
      ticket_reference: "SUP-2026-0001",
      operator: "Camille M.",
      duration_hours: 24,
      requested_at: "2026-11-19T09:30:00+00:00",
      decided_at: null,
      granted_at: null,
      expires_at: null,
      revoked_at: null,
      reviewed: false,
      read_count: 0,
    };
    const routes = {
      "/api/v1/support/tickets": { data: [TICKET] },
      "/api/v1/support/status": { data: { online: true, hours_label: "Lun–ven 9 h – 18 h", response_label: "Réponse sous 1 jour ouvré", timezone: "Europe/Paris", hours: [] } },
      [`/api/v1/org/${ORG}/support-access`]: { data: [GRANT], meta: { has_more: false, next_cursor: null } },
    };

    it("affiche le nombre de réponses à lire et celui des accès en attente à un titulaire, et branche le widget", async () => {
      const calls = stubApi(routes);

      renderEspace();

      const side = await screen.findByRole("navigation", { name: "Navigation principale" });
      expect(await within(side).findByRole("link", { name: /Support\s*1$/ })).toBeTruthy();
      await waitFor(() => { expect(within(side).getByRole("button", { name: /Réglages\s*1$/ })).toBeTruthy(); });
      expect(await screen.findByRole("button", { name: "Aide et support, 1 réponse non lue" })).toBeTruthy();
      expect(calls).toContain(`/api/v1/org/${ORG}/support-access`);
    });

    it.each(["manager", "accountant"])("masque l’entrée des accès du support et n’interroge pas le serveur pour le rôle %s", async (role) => {
      const calls = stubApi(routes, role);

      renderEspace();

      const side = await screen.findByRole("navigation", { name: "Navigation principale" });
      expect(await within(side).findByRole("link", { name: /Support\s*1$/ })).toBeTruthy();
      expect(within(side).queryByRole("button", { name: /Réglages/ })).toBeNull();
      expect(within(side).getByRole("link", { name: "Réglages" })).toBeTruthy();
      expect(calls).not.toContain(`/api/v1/org/${ORG}/support-access`);
    });
  });

  it("n'a aucune notification et le dit", async () => {
    stubApi();

    renderEspace();

    await screen.findByRole("button", { name: ACCOUNT });
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    expect(within(panel).getByText("Aucune notification.")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Tout marquer comme lu" }).hasAttribute("disabled")).toBe(true);
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("affiche la cloche du serveur : compteur, notifications et lien profond relatif", async () => {
    stubApi({
      "/api/v1/notifications/unread-count": { data: { unread: 1 } },
      "/api/v1/notifications": {
        data: [
          {
            id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9aa643",
            type: "rent.overdue",
            tone: "danger",
            title: "Loyer en retard",
            detail: "L'échéance du 05/11/2026 du bail BL-2026-001 n'est pas soldée.",
            unread: true,
            href: "/finances/impayes",
            organization_id: ORG,
            created_at: "2026-11-16T10:00:00+00:00",
            read_at: null,
          },
        ],
        meta: { next_cursor: null },
      },
    });

    renderEspace();

    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 1 non lues" }));
    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    expect((await within(panel).findByRole("link", { name: /Loyer en retard/ })).getAttribute("href")).toBe("/finances/impayes");
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("recherche seulement parmi les pages, sans mandant, lot ni locataire de démonstration", async () => {
    stubApi();

    renderEspace();

    await screen.findByRole("button", { name: ACCOUNT });
    const [search] = screen.getAllByRole("button", { name: "Rechercher" });
    if (!search) throw new Error("Bouton de recherche introuvable");
    await userEvent.click(search);
    const input = await screen.findByRole("combobox", { name: "Rechercher une page" });
    expect(input.getAttribute("placeholder")).toBe("Rechercher une page, ex. : Impayés");
    await userEvent.type(input, "Marc Chevalier");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    await userEvent.clear(input);
    await userEvent.type(input, "lieux");
    const labels = within(screen.getByRole("listbox", { name: "Pages" })).getAllByRole("option").map((option) => option.textContent);
    expect(labels.some((label) => label.includes("États des lieux"))).toBe(true);
    expect(labels.some((label) => /^(Mandant|Lot|Locataire), /.test(label))).toBe(false);
  });

  it("signale l'échec du chargement du compte au lieu d'afficher un compte de démonstration", async () => {
    stubApi({ "/api/v1/me": undefined });

    renderEspace();

    expect(await screen.findByText("Le compte n’a pas pu être chargé")).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("remplace une famille sans source par « Bientôt disponible » sans exécuter l'écran de démonstration", async () => {
    stubApi();
    state.pathname = "/finances";

    renderEspace();

    expect(await screen.findByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Finances" })).toBeTruthy();
    expect(screen.queryByText("Contenu réel")).toBeNull();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("n'ouvre pas la coquille sans agence : le compte d'un bailleur autonome ne passe pas", async () => {
    stubApi({ "/api/v1/me/profiles": { data: [{ space: "organization", label: "Dupont Gestion", meta: { organization: ORG, kind: "individual", role: "owner" } }] } });

    renderEspace();

    expect(await screen.findByText("Aucune organisation")).toBeTruthy();
    expect(screen.queryByText("Contenu réel")).toBeNull();
  });

  it("garde la coquille de démonstration inchangée en mode démo", async () => {
    state.mode = "demo";
    state.pathname = "/";
    const calls = stubApi();

    renderEspace();

    expect(await screen.findByRole("button", { name: "Compte, espace de travail Cabinet Delmas Immobilier" })).toBeTruthy();
    expect(screen.getByText("Contenu réel")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    await waitFor(() => { expect(calls.some((path) => path.includes("/api/v1/me"))).toBe(false); });
  });
});
