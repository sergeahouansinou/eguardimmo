import { SupportAccessPage, SupportNewRequestPage, SupportRequestsPage, SupportTicketPage } from "@eguardimmo/messagerie";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
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
  organization: "Agence Soleil",
  space: "organization",
  requester: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont" },
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
  reason: "Diagnostiquer l’erreur d’affichage des rôles.",
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

function stubApi({ role = "owner", extra = {} }: { role?: string; extra?: Record<string, (call: Recorded) => Promise<Response>> } = {}) {
  const calls: Recorded[] = [];
  const routes: Record<string, (call: Recorded) => Promise<Response>> = {
    "GET /api/v1/me/profiles": () => reply(200, { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] }),
    "GET /api/v1/me": () => reply(200, { data: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont", email: "jeanne@example.com", email_verified_at: null, last_login_at: null, previous_login_at: null } }),
    "GET /api/v1/support/status": () => reply(200, { data: { online: true, hours_label: "Lun–ven 9 h – 18 h", response_label: "Réponse sous 1 jour ouvré", timezone: "Europe/Paris", hours: [] } }),
    "GET /api/v1/support/tickets": () => reply(200, { data: [ticket] }),
    [`GET /api/v1/support/tickets/${TICKET}`]: () => reply(200, { data: { ...ticket, first_response_at: null, messages: [] } }),
    [`GET ${ACCESS}`]: () => reply(200, { data: [grant], meta: { has_more: false, next_cursor: null } }),
    ...extra,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const method = init?.method ?? "GET";
      const raw = init?.body;
      const call: Recorded = { method, path: url.pathname, body: typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw };
      calls.push(call);
      const handler = routes[`${method} ${url.pathname}`];
      return handler === undefined ? reply(500, { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" }) : handler(call);
    }),
  );
  return calls;
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

beforeEach(() => {
  state.push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("support de l'agence, branché sur l'API", () => {
  it("liste les demandes de l'organisation et lie chaque ligne à son fil", async () => {
    stubApi();

    renderWith(<SupportRequestsPage />);

    const row = await screen.findByRole("link", { name: /Reversement introuvable/ });
    expect(row.getAttribute("href")).toBe(`/support/${TICKET}`);
    expect(await screen.findByText("Support en ligne")).toBeTruthy();
  });

  it("ouvre une demande avec l'espace et l'organisation déduits de la session, jamais saisis", async () => {
    const calls = stubApi({
      extra: { "POST /api/v1/support/tickets": () => reply(201, { data: { ...ticket, first_response_at: null, messages: [] } }) },
    });
    const user = userEvent.setup();

    renderWith(<SupportNewRequestPage />);
    expect(screen.queryByLabelText(/organisation/i)).toBeNull();
    await user.type(await screen.findByRole("textbox", { name: "Sujet" }), "Reversement introuvable");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Je ne vois pas le reversement de novembre.");
    await user.click(screen.getByRole("button", { name: "Envoyer au support" }));

    await waitFor(() => { expect(state.push).toHaveBeenCalledWith(`/support/${TICKET}`); });
    const post = calls.find((call) => call.method === "POST" && call.path === "/api/v1/support/tickets");
    expect(post?.body).toMatchObject({ space: "organization", organization_id: ORG, category: "other", subject: "Reversement introuvable" });
    expect(typeof (post?.body as { client_id?: unknown }).client_id).toBe("string");
  });

  it("lit le fil sans mettre de contenu dans l'URL", async () => {
    const calls = stubApi();

    renderWith(<SupportTicketPage ticketId={TICKET} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Reversement introuvable" })).toBeTruthy();
    expect(calls.some((call) => call.path.includes("Reversement") || call.path.includes("novembre"))).toBe(false);
  });
});

describe("accès du support aux données de l'organisation, branchés sur l'API", () => {
  it("accepte avec une durée et un périmètre réduits, sur la route de l'organisation, après preuve 2FA", async () => {
    let accepted = 0;
    const calls = stubApi({
      extra: {
        [`POST ${ACCESS}/${GRANT}/accept`]: () => {
          accepted += 1;
          return accepted === 1
            ? reply(403, { type: "about:blank", title: "Confirmation requise", status: 403, code: "reauthentication_required" })
            : reply(200, { data: { ...grant, status: "active" } });
        },
        "POST /auth/reauthenticate/two-factor": () => reply(200, {}),
      },
    });
    const user = userEvent.setup();

    renderWith(<SupportAccessPage />);
    await user.click(await screen.findByRole("button", { name: "Accepter" }));
    const dialog = await screen.findByRole("dialog", { name: "Accepter l’accès du support ?" });
    const hours = within(dialog).getByRole("spinbutton", { name: /Durée de l’accès/ });
    await user.clear(hours);
    await user.type(hours, "12");
    await user.click(within(dialog).getByRole("checkbox", { name: /Équipe/i }));
    await user.click(within(dialog).getByRole("button", { name: "Accepter l’accès" }));

    const proof = await screen.findByRole("dialog", { name: "Confirmez votre identité" });
    await user.type(within(proof).getByLabelText(/Code de double authentification/), "123456");
    await user.click(within(proof).getByRole("button", { name: /Confirmer/ }));

    await waitFor(() => { expect(accepted).toBe(2); });
    const posts = calls.filter((call) => call.path === `${ACCESS}/${GRANT}/accept`);
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toEqual({ duration_hours: 12, scopes: ["settings"] });
  });

  it.each(["manager", "accountant"])("ne contacte pas les accès du support pour le rôle %s", async (role) => {
    const calls = stubApi({ role });

    renderWith(<SupportAccessPage />);

    expect(await screen.findByText("Réservé au propriétaire et aux administrateurs")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accepter" })).toBeNull();
    expect(calls.some((call) => call.path === ACCESS)).toBe(false);
  });
});
