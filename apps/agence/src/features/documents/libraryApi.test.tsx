import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentsPage from "@/app/(espace)/documents/page";
import DocumentAjoutPage from "@/app/(espace)/documents/ajout/page";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";

const documents = (path: string) => `/api/v1/org/${ORG}/documents${path}`;

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

const library = `/api/v1/org/${ORG}/documents/library`;
const links = { first: null, last: null, prev: null, next: null };
const meta = { per_page: 25, next_cursor: null, prev_cursor: null };

const entry = {
  id: "01a1e9ab-9bc0-7000-8000-000000000501",
  kind: "mandate",
  archived_at: null,
  filed_by_user_id: "01a1e9ab-9bb7-7000-8000-000000000301",
  lock_version: 1,
  created_at: "2026-11-18T09:30:00+00:00",
  file: {
    id: "01a1e9ab-9bd0-7000-8000-000000000601",
    name: "Mandat de gestion M-2026-0012.pdf",
    mime_type: "application/pdf",
    size_bytes: 48213,
    scan_status: "pending",
    subject: { type: "mandate", id: "01a1e9ab-9bb8-7000-8000-000000000401" },
    retention_until: null,
  },
};

function stubApi(role = "owner", extra: Record<string, unknown> = {}) {
  const calls: { method: string; path: string; form: FormData | null }[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [library]: { data: [entry], links, meta },
    [documents("/certificates")]: { data: [], links, meta },
    ...extra,
  };
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push({ method: init?.method ?? "GET", path: url.pathname, form: init?.body instanceof FormData ? init.body : null });
    const known = routes[url.pathname];
    const created = init?.method === "POST" && url.pathname === library;
    const body = created ? { data: entry } : known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
    const status = created ? 201 : known === undefined ? 500 : 200;
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
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

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Documents de l'agence en mode api", () => {
  it("lit la bibliothèque et les justificatifs, avec l'état d'analyse du serveur", async () => {
    const calls = stubApi();

    renderWith(<DocumentsPage />);

    const table = await screen.findByRole("table", { name: "Documents de la bibliothèque" });
    expect(within(table).getByText("Mandat de gestion M-2026-0012.pdf")).toBeTruthy();
    expect(within(table).getByText("Analyse en cours")).toBeTruthy();
    expect(calls.map((call) => call.path)).toEqual(expect.arrayContaining([library, documents("/certificates")]));
    expect(screen.getByRole("link", { name: "Ajouter un document" }).getAttribute("href")).toBe("/documents/ajout");
  });

  it("signale l'échec de la bibliothèque avec Réessayer, sans document de démonstration", async () => {
    stubApi("owner", { [library]: undefined });

    renderWith(<DocumentsPage />);

    expect(await screen.findByText("La bibliothèque n’a pas pu être chargée")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Documents de la bibliothèque" })).toBeNull();
    for (const text of ["Contrat de gestion", "Sophie Delmas"]) expect(document.body.textContent).not.toContain(text);
  });

  it("dépose un document par le formulaire de l'API et non par le jeu de démonstration", async () => {
    const calls = stubApi();

    renderWith(<DocumentAjoutPage />);

    await userEvent.upload(await screen.findByLabelText("Fichier *"), new File(["%PDF-1.4"], "Facade.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("combobox", { name: /^Nature/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Autre" }));
    await userEvent.click(screen.getByRole("button", { name: "Déposer le document" }));

    await waitFor(() => { expect(calls.filter((call) => call.method === "POST" && call.path === library)).toHaveLength(1); });
    const form = calls.find((call) => call.method === "POST")?.form;
    expect(form?.get("kind")).toBe("other");
    expect((form?.get("file") as File).name).toBe("Facade.pdf");
  });
});

describe("Documents de l'agence en mode démo", () => {
  it("garde la page de démonstration, sans appel réseau", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderWith(<DocumentsPage />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });
});
