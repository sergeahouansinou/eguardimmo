import { StaffWriteButton } from "@eguardimmo/messagerie";
import { useGestionNavigation } from "@eguardimmo/gestion";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import { bindLot } from "@/features/gestion/bind";
import { ApiMessagesHome, ApiTeamInbox, ApiThreadScreen } from "./MessagesScreens";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const THREAD = "01934f6e-0000-7000-8000-0000000001a1";
const TENANT = "01934f6e-0000-7000-8000-0000000001b1";
const LEASE = "01934f6e-0000-7000-8000-0000000001c1";
const CONVERSATIONS = `/api/v1/org/${ORG}/conversations`;

const state = vi.hoisted((): { search: string; push: ReturnType<typeof vi.fn> } => ({ search: "", push: vi.fn() }));

vi.mock("@/lib/env", () => ({
  dataSource: "api",
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040", NEXT_PUBLIC_DATA_SOURCE: "api" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(state.search),
  usePathname: () => "/messages",
}));

const thread = {
  id: THREAD,
  kind: "tenant",
  subject: "Quittance de novembre",
  status: "open",
  closed_at: null,
  party: { id: TENANT, name: "Awa Koffi" },
  lease: { id: LEASE, reference: "BAIL-2026-001" },
  mandate: null,
  assignee: null,
  preview: "Bonjour, pouvez-vous m’envoyer ma quittance ?",
  last_message_at: "2026-11-19T09:00:00+00:00",
  last_author_side: "tenant",
  last_author_name: "Awa Koffi",
  unread: false,
  archived: false,
  awaiting_reply: true,
  message_count: 1,
  has_attachments: false,
  counterpart_last_read_at: null,
  muted_until: null,
  muted_reason: null,
};

const message = {
  id: "01934f6e-0000-7000-8000-0000000001f1",
  client_id: null,
  author: { id: TENANT, name: "Awa Koffi", side: "tenant" },
  mine: false,
  body: "Bonjour, pouvez-vous m’envoyer ma quittance ?",
  sent_at: "2026-11-19T09:00:00+00:00",
  redacted: false,
  redaction_reason: null,
  attachments: [],
};

function stubApi({ role = "owner" }: { role?: string } = {}) {
  const urls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    "/api/v1/me": { data: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont", email: "jeanne@example.com", email_verified_at: null, last_login_at: null, previous_login_at: null } },
    [`${CONVERSATIONS}/unread`]: { data: { internal: 0, tenant: 1, owner: 2 } },
    [`${CONVERSATIONS}/recipients`]: { data: [] },
    [CONVERSATIONS]: { data: [thread], meta: { has_more: false, next_cursor: null, counts: { all: 1, awaiting: 1, unread: 0, sent: 0, archived: 0 } } },
    [`${CONVERSATIONS}/${THREAD}`]: { data: { ...thread, messages: [message], messages_meta: { has_more: false, next_cursor: null } } },
    [`${CONVERSATIONS}/${THREAD}/messages`]: { data: [], meta: { has_more: false, next_cursor: null, status: "open", counterpart_last_read_at: null } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      urls.push(`${url.pathname}${url.search}`);
      const known = routes[url.pathname];
      const body = known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
      return Promise.resolve(new Response(JSON.stringify(body), { status: known === undefined ? 500 : 200, headers: { "Content-Type": "application/json" } }));
    }),
  );
  return urls;
}

function renderWith(children: React.ReactNode) {
  return render(
    <Providers>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </Providers>,
  );
}

const staffCalls = (urls: string[]) => urls.filter((url) => /[?&]kind=(tenant|owner)\b/.test(url));

beforeEach(() => {
  state.search = "";
  state.push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("boîte des conversations externes de l'agence, branchée sur l'API", () => {
  it("lit les conversations locataires par défaut sous l'organisation et lie chaque ligne au fil externe", async () => {
    const urls = stubApi();

    renderWith(<ApiMessagesHome />);

    const row = await screen.findByRole("link", { name: /Quittance de novembre/ });
    expect(row.getAttribute("href")).toBe(`/messages/fil/${THREAD}`);
    expect(urls).toContain(`${CONVERSATIONS}?kind=tenant&tab=all&search=&per_page=25`.replace("&search=", ""));
    const nav = await screen.findByRole("navigation", { name: "Types de conversation" });
    expect(within(nav).getByRole("link", { name: /Mandants/ }).getAttribute("href")).toBe("/messages?section=mandants");
    expect(await within(nav).findByRole("link", { name: /Mandants/ })).toHaveProperty("textContent", expect.stringContaining("2"));
    expect(within(nav).getByRole("link", { name: /Équipe/ }).getAttribute("href")).toBe("/messages/equipe");
  });

  it("lit les conversations mandants avec ?section=mandants", async () => {
    state.search = "section=mandants";
    const urls = stubApi();

    renderWith(<ApiMessagesHome />);

    await waitFor(() => { expect(urls.some((url) => url.startsWith(`${CONVERSATIONS}?kind=owner`))).toBe(true); });
    expect(urls.some((url) => url.includes("kind=tenant"))).toBe(false);
  });

  it("n'offre aucune entrée externe à un comptable : ni requête, ni section", async () => {
    const urls = stubApi({ role: "accountant" });

    renderWith(<ApiMessagesHome />);

    await waitFor(() => { expect(urls).toContain("/api/v1/me/profiles"); });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("navigation", { name: "Types de conversation" })).toBeNull();
    expect(staffCalls(urls)).toEqual([]);
    expect(urls.some((url) => url.startsWith(`${CONVERSATIONS}/unread`))).toBe(false);
  });

  it("garde la boîte interne sous « Équipe », avec la navigation des sections", async () => {
    stubApi();

    renderWith(<ApiTeamInbox />);

    const nav = await screen.findByRole("navigation", { name: "Types de conversation" });
    expect(within(nav).getByRole("link", { name: /Équipe/ }).getAttribute("aria-current")).toBe("page");
  });
});

describe("fil externe de l'agence, branché sur l'API", () => {
  it("lit le fil sous l'organisation, sans mettre de contenu de message dans l'URL", async () => {
    const urls = stubApi();

    renderWith(<ApiThreadScreen id={THREAD} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Quittance de novembre" })).toBeTruthy();
    expect(urls).toContain(`${CONVERSATIONS}/${THREAD}`);
    expect(urls.some((url) => url.includes("quittance") || url.includes("Bonjour"))).toBe(false);
  });

  it("offre restreindre et retirer à un administrateur", async () => {
    stubApi({ role: "admin" });
    renderWith(<ApiThreadScreen id={THREAD} />);
    expect(await screen.findByRole("button", { name: "Restreindre l’envoi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirer ce message" })).toBeTruthy();
  });

  it("masque la restriction et le retrait d'un message de la contrepartie à un gestionnaire", async () => {
    stubApi({ role: "manager" });
    renderWith(<ApiThreadScreen id={THREAD} />);
    await screen.findByRole("log");
    expect(screen.queryByRole("button", { name: "Restreindre l’envoi" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retirer ce message" })).toBeNull();
    expect(screen.getByRole("button", { name: "Fermer la conversation" })).toBeTruthy();
  });

  it("refuse un comptable sans aucune requête sur le fil", async () => {
    const urls = stubApi({ role: "accountant" });
    renderWith(<ApiThreadScreen id={THREAD} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Votre rôle ne donne pas accès");
    expect(urls.some((url) => url.startsWith(`${CONVERSATIONS}/${THREAD}`))).toBe(false);
  });
});

describe("ouverture d'une conversation depuis une fiche", () => {
  const target = { kind: "tenant", partyId: TENANT, partyName: "Awa Koffi", links: [{ id: LEASE, label: "Bail BAIL-2026-001" }] } as const;

  it("propose « Écrire » à un gestionnaire, pas à un comptable", async () => {
    stubApi({ role: "manager" });
    const first = renderWith(<StaffWriteButton target={target} />);
    expect(await screen.findByRole("button", { name: "Écrire" })).toBeTruthy();
    first.unmount();

    stubApi({ role: "accountant" });
    renderWith(<StaffWriteButton target={target} />);
    await waitFor(() => { expect(screen.queryByRole("button", { name: "Écrire" })).toBeNull(); });
  });

  it("fournit le bouton « Écrire » aux fiches locataire et bail par la navigation de gestion, avec le bail de la fiche", async () => {
    stubApi();
    const Probe = bindLot(function Probe() {
      return <>{useGestionNavigation().writeToTenant?.({ partyId: TENANT, partyName: "Awa Koffi", leases: [{ id: LEASE, label: "Bail BAIL-2026-001" }], defaultLeaseId: LEASE })}</>;
    });
    renderWith(<Probe />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Écrire" }));

    expect(await screen.findByRole("dialog", { name: "Écrire à Awa Koffi" })).toBeTruthy();
    expect(screen.getByDisplayValue("Bail BAIL-2026-001")).toBeTruthy();
  });
});
