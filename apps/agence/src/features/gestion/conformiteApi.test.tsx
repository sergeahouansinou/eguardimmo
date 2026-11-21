import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConformitePage from "@/app/(espace)/conformite/page";
import DocumentsPage from "@/app/(espace)/documents/page";
import { Providers } from "@/app/providers";
import { PieceConformiteApiScreen } from "./screens";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const CERTIFICATE = "01a1e9ab-9be5-7020-a050-08d26f2db94d";
const documents = (path: string) => `/api/v1/org/${ORG}/documents${path}`;
const terms = `/api/v1/org/${ORG}/catalog/vocabularies/certificate_type/terms`;

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "https://auth.test", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/conformite",
}));

const certificate = {
  id: CERTIFICATE,
  subject: { type: "organization", id: ORG },
  type: { id: "01a1e9ab-9b9e-7301-8a1b-10b4a0711928", key: "energy_performance", label: "Diagnostic de performance énergétique (DPE)", semantic_key: "energy_performance" },
  reference: "DPE-2026-001",
  issuer_party_id: null,
  issued_on: "2026-01-10",
  expires_on: "2036-01-10",
  state: "valid",
  values: { energy_class: "C" },
  stored_file_id: "01a1e9ab-9bdf-7132-b1c7-7bc12bcead09",
  replaces_id: null,
  replaced_by_id: null,
};
const links = { first: null, last: null, prev: null, next: null };

function stubApi(role = "owner", extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [documents("/certificates")]: { data: [certificate], links, meta: { per_page: 25, next_cursor: null, prev_cursor: null } },
    [documents(`/certificates/${CERTIFICATE}`)]: { data: certificate },
    [terms]: { data: [] },
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

function renderWith(children: ReactNode) {
  return render(
    <Providers>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </Providers>,
  );
}

const DEMO_TEXTS = ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "Anaïs Roux", "Apt 12"];

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Conformité et Documents de l'agence en mode api", () => {
  it("liste les pièces lues sur l'API de l'agence, sans donnée de démonstration", async () => {
    const calls = stubApi();

    renderWith(<ConformitePage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("DPE-2026-001")).toBeTruthy();
    expect(calls).toContain(documents("/certificates"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("propose l'ajout d'une pièce au titulaire et le masque au comptable", async () => {
    stubApi("owner");
    const owner = renderWith(<ConformitePage />);
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Ajouter/ })).toBeTruthy();
    owner.unmount();
    vi.unstubAllGlobals();

    stubApi("accountant");
    renderWith(<ConformitePage />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /Ajouter/ })).toBeNull();
  });

  it("affiche le détail d'une pièce", async () => {
    const calls = stubApi();

    renderWith(<PieceConformiteApiScreen id={CERTIFICATE} />);

    expect(await screen.findByRole("heading", { level: 1, name: /Diagnostic de performance énergétique/ })).toBeTruthy();
    expect(calls).toContain(documents(`/certificates/${CERTIFICATE}`));
  });

  it("sert les justificatifs sur /documents", async () => {
    const calls = stubApi();

    renderWith(<DocumentsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Documents" })).toBeTruthy();
    expect(calls).toContain(documents("/certificates"));
  });

  it("signale l'échec du chargement sans afficher de pièce de démonstration", async () => {
    stubApi("owner", { [documents("/certificates")]: undefined });

    renderWith(<ConformitePage />);

    expect((await screen.findAllByText(/chargement impossible|Route non prévue/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });
});

describe("Conformité et Documents de l'agence en mode démo", () => {
  it("garde les écrans de démonstration, sans appel réseau", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderWith(<ConformitePage />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });
});
