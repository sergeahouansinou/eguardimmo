import { SupportAccessPage, SupportNewRequestPage } from "@eguardimmo/messagerie";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EspaceShell } from "@/app/(espace)/EspaceShell";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000a";
const TICKET = "01934f6e-0000-7000-8000-0000000001a1";
const GRANT = "01934f6e-0000-7000-8000-0000000001f1";
const ACCESS = `/api/v1/org/${ORG}/support-access`;

const state = vi.hoisted((): { push: ReturnType<typeof vi.fn> } => ({ push: vi.fn() }));

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
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/support",
}));

const ticket = {
  id: TICKET,
  reference: "SUP-2026-0001",
  subject: "Reversement introuvable",
  organization: "Dupont Gestion",
  space: "organization",
  requester: { id: "01934f6e-0000-7000-8000-0000000000a1", name: "Jeanne Dupont" },
  assignee: null,
  priority: "normal",
  status: "open",
  category: "billing",
  created_at: "2026-11-19T09:00:00+00:00",
  updated_at: "2026-11-19T09:00:00+00:00",
  requester_last_read_at: "2026-11-19T09:00:00+00:00",
  support_last_read_at: null,
  message_count: 1,
};

const grant = {
  id: GRANT,
  kind: "consent",
  status: "requested",
  scopes: ["settings", "team"],
  reason: "Diagnostic",
  emergency_basis: null,
  ticket_reference: "SUP-2026-0001",
  operator: "Camille M.",
  duration_hours: 48,
  requested_at: "2026-11-19T09:30:00+00:00",
  decided_at: null,
  granted_at: null,
  expires_at: null,
  revoked_at: null,
  reviewed: false,
  read_count: 0,
};

interface Recorded {
  method: string;
  path: string;
  body: unknown;
}

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function stubApi({ role = "owner", extra = {} }: { role?: string; extra?: Record<string, () => Promise<Response>> } = {}) {
  const calls: Recorded[] = [];
  const routes: Record<string, () => Promise<Response>> = {
    "GET /api/v1/me/profiles": () => reply(200, { data: [{ space: "organization", label: "Dupont Gestion", meta: { organization: ORG, kind: "individual", role } }] }),
    "GET /api/v1/me": () => reply(200, { data: { id: "01934f6e-0000-7000-8000-0000000000a1", name: "Jeanne Dupont", email: "jeanne@example.com", email_verified_at: null, last_login_at: null, previous_login_at: null } }),
    "GET /api/v1/support/status": () => reply(200, { data: { online: true, hours_label: "Lun–ven 9 h – 18 h", response_label: "Réponse sous 1 jour ouvré", timezone: "Europe/Paris", hours: [] } }),
    "GET /api/v1/support/tickets": () => reply(200, { data: [ticket] }),
    [`GET ${ACCESS}`]: () => reply(200, { data: [grant], meta: { has_more: false, next_cursor: null } }),
    ...extra,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const method = init?.method ?? "GET";
      const raw = init?.body;
      calls.push({ method, path: url.pathname, body: typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw });
      const handler = routes[`${method} ${url.pathname}`];
      return handler === undefined ? reply(500, { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" }) : handler();
    }),
  );
  return calls;
}

function renderEspace(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Providers>
      <QueryClientProvider client={client}>
        <EspaceShell>{children}</EspaceShell>
      </QueryClientProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("support du bailleur autonome, branché sur l'API", () => {
  it("ouvre une demande avec l'espace organisation et l'organisation de la session, jamais saisis", async () => {
    const calls = stubApi({ extra: { "POST /api/v1/support/tickets": () => reply(201, { data: { ...ticket, first_response_at: null, messages: [] } }) } });
    const user = userEvent.setup();

    renderEspace(<SupportNewRequestPage />);
    await user.type(await screen.findByRole("textbox", { name: "Sujet" }), "Reversement introuvable");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Je ne vois pas le reversement.");
    await user.click(screen.getByRole("button", { name: "Envoyer au support" }));

    await waitFor(() => { expect(state.push).toHaveBeenCalledWith(`/support/${TICKET}`); });
    const post = calls.find((call) => call.method === "POST" && call.path === "/api/v1/support/tickets");
    expect(post?.body).toMatchObject({ space: "organization", organization_id: ORG, subject: "Reversement introuvable" });
  });

  it("propose les accès du support au titulaire et refuse sans appel les rôles sans droit", async () => {
    const owner = stubApi();
    renderEspace(<SupportAccessPage />);
    expect(await screen.findByRole("button", { name: "Accepter" })).toBeTruthy();
    expect(owner.some((call) => call.path === ACCESS)).toBe(true);
  });

  it.each(["manager", "accountant"])("ne contacte pas les accès du support pour le rôle %s", async (role) => {
    const calls = stubApi({ role });

    renderEspace(<SupportAccessPage />);

    expect(await screen.findByText("Réservé au propriétaire et aux administrateurs")).toBeTruthy();
    expect(within(document.body).queryByRole("button", { name: "Accepter" })).toBeNull();
    expect(calls.some((call) => call.path === ACCESS)).toBe(false);
  });
});
