import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { OLD_REPORT_ID, REPORT, REPORT_DETAIL, REPORT_ID, SUPERSEDED_REPORT } from "./fixtures";
import { ReportScreen } from "./ReportScreen";
import { ReportsScreen } from "./ReportsScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/management-reports";
const DETAIL = `GET /api/v1/owner/management-reports/${REPORT_ID}`;
const PDF = `GET /api/v1/owner/management-reports/${REPORT_ID}/pdf`;

beforeEach(() => {
  setLocation("/confie/comptes-rendus");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("liste des comptes rendus en mode api", () => {
  it("affiche les comptes rendus publiés et remplacés avec les chiffres du serveur", async () => {
    stubApi({ [LIST]: { body: page([REPORT, SUPERSEDED_REPORT]) } });
    const { container } = renderApi(<ReportsScreen />);

    const table = await screen.findByRole("table", { name: "Comptes rendus de gestion publiés" });
    expect(within(table).getByRole("link", { name: "CRG-2026-0012" }).getAttribute("href")).toBe(`/confie/comptes-rendus/${REPORT_ID}`);
    expect(within(table).getByText("Publié")).toBeTruthy();
    expect(within(table).getByText("Remplacé")).toBeTruthy();
    expect(within(table).getByText("Mensuel du 01/10/2026 au 31/10/2026")).toBeTruthy();
    expect(within(table).getAllByText("700 €")).toHaveLength(2);
    expect(within(table).getAllByText("644 €")).toHaveLength(2);
    await expectNoA11yViolations(container);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<ReportsScreen />);

    expect(await screen.findByText("Aucun compte rendu")).toBeTruthy();
  });

  it("traduit une session expirée", async () => {
    stubApi({ [LIST]: problem(401, "unauthenticated") });
    renderApi(<ReportsScreen />);

    expect(await screen.findByText("Votre session a expiré. Reconnectez-vous pour continuer.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href")).toContain("/connexion?return_to=");
  });
});

describe("compte rendu en mode api", () => {
  it("détaille la synthèse, les lots, les écritures et les quittances", async () => {
    stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) } });
    const { container } = renderApi(<ReportScreen id={REPORT_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" })).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Synthèse" });
    expect(within(summary).getByText("700 €")).toBeTruthy();
    expect(within(summary).getByText("Non renseigné")).toBeTruthy();
    expect(within(summary).getByText("Loyers, Honoraires, Reversement")).toBeTruthy();
    const units = screen.getByRole("table", { name: "Lots concernés par le compte rendu" });
    expect(within(units).getByText("Awa Diallo")).toBeTruthy();
    const lines = screen.getByRole("table", { name: "Écritures du compte rendu" });
    expect(within(lines).getByText("Loyer encaissé")).toBeTruthy();
    expect(within(lines).getByText("Remplacement du robinet (INT-2026-0031)")).toBeTruthy();
    expect(within(lines).getAllByText("Débit")).toHaveLength(2);
    expect(screen.getByText(/QT-2026-0101 · émise le 08\/10\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir la version remplacée" }).getAttribute("href")).toBe(`/confie/comptes-rendus/${OLD_REPORT_ID}`);
    await expectNoA11yViolations(container);
  });

  it("avertit qu'un compte rendu a été remplacé", async () => {
    stubApi({ [DETAIL]: { body: one({ ...REPORT_DETAIL, status: "superseded", supersedes_id: null }) } });
    renderApi(<ReportScreen id={REPORT_ID} />);

    expect(await screen.findByText("Compte rendu remplacé")).toBeTruthy();
  });

  it("télécharge le PDF avec la session, sans lien public", async () => {
    const downloads = captureDownloads();
    const stub = stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: { file: { type: "application/pdf", content: "%PDF-1.4 test" } } });
    const { user } = renderApi(<ReportScreen id={REPORT_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    await waitFor(() => {
      expect(downloads.names).toEqual(["compte-rendu-CRG-2026-0012.pdf"]);
    });
    expect(await downloads.blobs[0]?.text()).toBe("%PDF-1.4 test");
    const call = stub.calls.find((entry) => entry.path.endsWith("/pdf"));
    expect(call?.init?.credentials).toBe("include");
    expect(new Headers(call?.init?.headers).get("Accept")).toBe("application/pdf");
  });

  it("explique qu'un PDF n'est pas disponible (503)", async () => {
    const downloads = captureDownloads();
    stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: problem(503, "report_pdf_unavailable") });
    const { user } = renderApi(<ReportScreen id={REPORT_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Le PDF de ce compte rendu n’est pas disponible pour le moment.");
    expect(downloads.names).toEqual([]);
  });

  it("refuse un fichier qui n'est pas un PDF", async () => {
    const downloads = captureDownloads();
    stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: { file: { type: "text/html", content: "<html></html>" } } });
    const { user } = renderApi(<ReportScreen id={REPORT_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Le serveur a répondu de façon inattendue");
    expect(downloads.names).toEqual([]);
  });

  it("signale un compte rendu non publié ou hors de vos accès", async () => {
    stubApi({ [DETAIL]: problem(404, "owner_report_not_found") });
    renderApi(<ReportScreen id={REPORT_ID} />);

    expect(await screen.findByText("Ce compte rendu n’existe pas ou n’est pas publié.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux comptes rendus" }).getAttribute("href")).toBe("/confie/comptes-rendus");
  });
});

describe("marquage « lu » à l'ouverture du compte rendu", () => {
  const READ = `POST /api/v1/owner/management-reports/${REPORT_ID}/read`;
  const readCalls = (stub: ReturnType<typeof stubApi>) => stub.calls.filter((call) => call.method === "POST" && call.path.endsWith("/read"));

  it("appelle le serveur une seule fois, sans corps ni message, et met le détail à jour", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [READ]: { body: one({ ...REPORT, first_read_at: "2026-11-19T10:00:00+00:00" }) } });
    renderApi(<ReportScreen id={REPORT_ID} />);

    await screen.findByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" });
    await waitFor(() => {
      expect(readCalls(stub)).toHaveLength(1);
    });
    expect(readCalls(stub)[0]?.json).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("n'appelle pas le serveur pour un compte rendu déjà lu", async () => {
    const stub = stubApi({ [DETAIL]: { body: one({ ...REPORT_DETAIL, first_read_at: "2026-11-03T09:00:00+00:00" }) }, [READ]: { body: one(REPORT) } });
    renderApi(<ReportScreen id={REPORT_ID} />);

    await screen.findByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" });

    expect(readCalls(stub)).toHaveLength(0);
  });

  it("n'appelle pas le serveur pour un co-indivisaire", async () => {
    const stub = stubApi({
      "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } },
      [DETAIL]: { body: one(REPORT_DETAIL) },
      [READ]: { body: one(REPORT) },
    });
    renderApi(<ReportScreen id={REPORT_ID} />);

    await screen.findByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" });

    expect(readCalls(stub)).toHaveLength(0);
  });

  it("n'appelle pas le serveur pendant la période de grâce", async () => {
    const stub = stubApi({
      "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, read_only: true, in_grace: true, access_until: "2027-03-31" }] } },
      [DETAIL]: { body: one(REPORT_DETAIL) },
      [READ]: { body: one(REPORT) },
    });
    renderApi(<ReportScreen id={REPORT_ID} />);

    await screen.findByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" });

    expect(readCalls(stub)).toHaveLength(0);
  });

  it("reste silencieux et n'empêche pas la lecture quand le marquage échoue", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [READ]: problem(403, "owner_role_forbidden") });
    renderApi(<ReportScreen id={REPORT_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" })).toBeTruthy();
    await waitFor(() => {
      expect(readCalls(stub)).toHaveLength(1);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("region", { name: "Synthèse" })).toBeTruthy();
  });
});
