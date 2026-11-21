import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { setLocation } from "../../../test/navigation";
import { problem } from "../responses.fixtures";
import { one } from "../shared/fixtures";
import { ApercuScreen } from "./ApercuScreen";
import { REPORT_DETAIL, REPORT_ID } from "./fixtures";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const DETAIL = `GET /api/v1/owner/management-reports/${REPORT_ID}`;
const PDF = `GET /api/v1/owner/management-reports/${REPORT_ID}/pdf`;
const PDF_FILE = { file: { type: "application/pdf", content: "%PDF-1.7" } };

beforeEach(() => {
  setLocation(`/confie/comptes-rendus/${REPORT_ID}/apercu`);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("aperçu du compte rendu en mode api", () => {
  it("charge le PDF du serveur dans le visualiseur et le télécharge sans second appel", async () => {
    const downloads = captureDownloads();
    const stub = stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: PDF_FILE });
    const { user } = renderApi(<ApercuScreen id={REPORT_ID} />);

    const frame = await screen.findByTitle("Compte rendu de gestion CRG-2026-0012");
    expect(frame.getAttribute("src")).toBe("blob:test");
    expect(screen.getByRole("heading", { level: 1, name: "Compte rendu CRG-2026-0012" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir le détail du compte rendu" }).getAttribute("href")).toBe(`/confie/comptes-rendus/${REPORT_ID}`);
    await user.click(screen.getByRole("button", { name: "Télécharger le PDF" }));

    expect(downloads.names).toEqual(["compte-rendu-CRG-2026-0012.pdf"]);
    expect(stub.count("GET", `/api/v1/owner/management-reports/${REPORT_ID}/pdf`)).toBe(1);
    expect(new Headers(stub.calls.find((call) => call.path.endsWith("/pdf"))?.init?.headers).get("Accept")).toBe("application/pdf");
    await expectNoA11yViolations(screen.getByRole("region", { name: "Document" }));
  });

  it("libère l'URL du PDF quand l'aperçu est fermé", async () => {
    captureDownloads();
    const revoke = vi.fn<(url: string) => void>();
    URL.revokeObjectURL = revoke;
    stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: PDF_FILE });
    const { unmount } = renderApi(<ApercuScreen id={REPORT_ID} />);
    await screen.findByTitle("Compte rendu de gestion CRG-2026-0012");
    expect(revoke).not.toHaveBeenCalled();

    unmount();

    expect(revoke).toHaveBeenCalledWith("blob:test");
  });

  it("imprime le contenu du visualiseur", async () => {
    captureDownloads();
    stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: PDF_FILE });
    const { user } = renderApi(<ApercuScreen id={REPORT_ID} />);

    const frame = await screen.findByTitle("Compte rendu de gestion CRG-2026-0012");
    const print = vi.fn();
    Object.defineProperty(frame, "contentWindow", { value: { print } });
    await user.click(screen.getByRole("button", { name: "Imprimer" }));

    expect(print).toHaveBeenCalledOnce();
  });

  it("traduit un PDF indisponible et relance la lecture", async () => {
    captureDownloads();
    const stub = stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: problem(503, "report_pdf_unavailable") });
    const { user } = renderApi(<ApercuScreen id={REPORT_ID} />);

    expect(await screen.findByText("Le PDF n’a pas pu être chargé")).toBeTruthy();
    expect(screen.getByText(/Le PDF de ce compte rendu n’est pas disponible pour le moment/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Télécharger le PDF" }).disabled).toBe(true);
    expect(screen.queryByTitle("Compte rendu de gestion CRG-2026-0012")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => {
      expect(stub.count("GET", `/api/v1/owner/management-reports/${REPORT_ID}/pdf`)).toBe(2);
    });
  });

  it("refuse un contenu qui n'est pas un PDF", async () => {
    captureDownloads();
    stubApi({ [DETAIL]: { body: one(REPORT_DETAIL) }, [PDF]: { file: { type: "text/html", content: "<html></html>" } } });
    renderApi(<ApercuScreen id={REPORT_ID} />);

    expect(await screen.findByText("Le serveur a répondu de façon inattendue. Réessayez dans un instant.")).toBeTruthy();
    expect(screen.queryByTitle("Compte rendu de gestion CRG-2026-0012")).toBeNull();
  });

  it("traduit un compte rendu introuvable sans appeler le PDF", async () => {
    const stub = stubApi({ [DETAIL]: problem(404, "owner_report_not_found") });
    renderApi(<ApercuScreen id={REPORT_ID} />);

    expect(await screen.findByText("Ce compte rendu n’existe pas ou n’est pas publié.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux comptes rendus" }).getAttribute("href")).toBe("/confie/comptes-rendus");
    expect(stub.count("GET", `/api/v1/owner/management-reports/${REPORT_ID}/pdf`)).toBe(0);
  });
});
