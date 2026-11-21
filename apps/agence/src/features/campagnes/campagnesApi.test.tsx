import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import { ApiCampaignDetail, ApiCampaignEditor, ApiCampaignsList } from "./CampaignsScreens";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const CAMPAIGN = "01934f6e-0000-7000-8000-0000000002a1";
const BUILDING = "01934f6e-0000-7000-8000-0000000002c1";
const CAMPAIGNS = `/api/v1/org/${ORG}/campaigns`;

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
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/campagnes",
}));

const metrics = { queued: 0, sending: 0, sent: 8, unknown: 0, bounced: 1, failed: 0, suppressed: 0, skipped_no_email: 1, read: 4, unsubscribed: 0 };

const campaign = {
  id: CAMPAIGN,
  subject: "Coupure d’eau lundi",
  body: "Bonjour {{ Prénom }}, coupure lundi.",
  audience: "tenants",
  audience_label: "Tous les locataires",
  building_ids: [],
  status: "sent",
  copy_to_history: true,
  scheduled_at: null,
  sending_started_at: "2026-11-19T09:00:00+00:00",
  sent_at: "2026-11-19T09:05:00+00:00",
  cancelled_at: null,
  content_purged: false,
  recipient_count: 10,
  failed_count: 1,
  metrics,
  attachments: [],
  created_by_user_id: "01934f6e-0000-7000-8000-0000000002b1",
  lock_version: 2,
  created_at: "2026-11-19T08:00:00+00:00",
  updated_at: "2026-11-19T09:05:00+00:00",
};

const draft = { ...campaign, status: "draft", sending_started_at: null, sent_at: null, recipient_count: 0, failed_count: 0, lock_version: 1 };

const audiences = {
  data: [
    {
      audience: "tenants",
      label: "Tous les locataires",
      detail: "Locataires des baux signés en cours, par immeuble au choix",
      count: 12,
      without_email: 0,
      buildings: [{ id: BUILDING, name: "Résidence Les Palmiers", count: 7, without_email: 0 }],
    },
    { audience: "mandants", label: "Tous les mandants", detail: "Mandants des mandats actifs", count: 5, without_email: 0, buildings: [] },
  ],
};

interface Call {
  method: string;
  path: string;
}

function stubApi({ role = "owner", sendOutcomes = [200] }: { role?: string; sendOutcomes?: number[] } = {}) {
  const calls: Call[] = [];
  const outcomes = [...sendOutcomes];
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const method = init?.method ?? "GET";
      calls.push({ method, path: url.pathname });
      const key = `${method} ${url.pathname}`;
      if (key === "GET /api/v1/me/profiles") {
        return json({ data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] });
      }
      if (key === "GET /api/v1/me") return json({ data: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont", email: "jeanne@example.com", email_verified_at: null, last_login_at: null, previous_login_at: null } });
      if (key === `GET ${CAMPAIGNS}`) return json({ data: [campaign], meta: { path: "x", per_page: 25, next_cursor: null, prev_cursor: null }, counts: { all: 1, draft: 0, scheduled: 0, sending: 0, sent: 1, cancelled: 0 }, stats: { this_month: 1, scheduled: 0, sent_count: 8, read_count: 4, read_rate_percent: 50, failures: 1 } });
      if (key === `GET ${CAMPAIGNS}/audiences`) return json(audiences);
      if (key === `GET ${CAMPAIGNS}/${CAMPAIGN}`) return json({ data: campaign });
      if (key === `POST ${CAMPAIGNS}`) return json({ data: draft }, 201);
      if (key === `PATCH ${CAMPAIGNS}/${CAMPAIGN}`) return json({ data: { ...draft, lock_version: 2 } });
      if (key === `POST ${CAMPAIGNS}/${CAMPAIGN}/send`) {
        const status = outcomes.shift() ?? 200;
        return status === 200 ? json({ data: { ...campaign, status: "sending" } }) : json({ type: "about:blank", title: "Preuve requise", status, code: "reauthentication_required" }, status);
      }
      if (key === "POST /auth/reauthenticate/two-factor") return json({ data: { reauthenticated: true } });
      return json({ type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" }, 500);
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

describe("campagnes de l'agence, branchées sur l'API", () => {
  it("liste les campagnes de l'organisation lues sur le serveur, sans donnée de démonstration", async () => {
    const calls = stubApi();
    renderWith(<ApiCampaignsList />);

    const list = await screen.findByRole("list", { name: "Campagnes" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("link", { name: "Voir le suivi de Coupure d’eau lundi" }).getAttribute("href")).toBe(`/campagnes/${CAMPAIGN}`);
    expect(calls.some((call) => call.method === "GET" && call.path === CAMPAIGNS)).toBe(true);
    expect(screen.queryByText(/Assemblée générale/)).toBeNull();
  });

  it("refuse l'écran à un comptable sans interroger les campagnes", async () => {
    const calls = stubApi({ role: "accountant" });
    renderWith(<ApiCampaignsList />);

    expect(await screen.findByText("Accès réservé")).toBeTruthy();
    expect(calls.filter((call) => call.path.startsWith(CAMPAIGNS))).toEqual([]);
  });

  it("affiche le suivi d'une campagne envoyée depuis le serveur", async () => {
    stubApi();
    renderWith(<ApiCampaignDetail id={CAMPAIGN} />);

    const region = await screen.findByRole("region", { name: "Suivi de l’envoi" });
    expect(within(region).getByText("10 sur 10 traités")).toBeTruthy();
  });

  it("envoie une campagne : brouillon créé, code 2FA demandé, puis envoi rejoué avec la même campagne", async () => {
    const user = userEvent.setup();
    const calls = stubApi({ sendOutcomes: [403, 200] });
    renderWith(<ApiCampaignEditor />);

    await user.type(await screen.findByRole("textbox", { name: /Objet/ }), "Coupure d’eau lundi");
    await user.click(screen.getByRole("textbox", { name: /Message/ }));
    await user.paste("Bonjour {{ Prénom }}, coupure lundi.");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await user.click(await screen.findByRole("button", { name: "Envoyer maintenant" }));

    const proof = await screen.findByRole("dialog", { name: "Confirmez votre identité" });
    expect(state.push).not.toHaveBeenCalled();
    await user.type(within(proof).getByRole("textbox", { name: /Code de double authentification/ }), "123456");
    await user.click(within(proof).getByRole("button", { name: "Confirmer" }));

    await waitFor(() => { expect(state.push).toHaveBeenCalledWith(`/campagnes/${CAMPAIGN}`); });
    const sequence = calls.filter((call) => call.method !== "GET").map((call) => `${call.method} ${call.path.replace(CAMPAIGNS, "").replace(CAMPAIGN, ":id")}`);
    expect(sequence).toEqual(["POST ", "POST /:id/send", "POST /auth/reauthenticate/two-factor", "PATCH /:id", "POST /:id/send"]);
  });
});
