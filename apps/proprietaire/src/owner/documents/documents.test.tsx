import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { setLocation } from "../../../test/navigation";
import { problem } from "../responses.fixtures";
import { page } from "../shared/fixtures";
import { BARE_DOCUMENT, DOCUMENT_ID, MANDATE_DOCUMENT, PHOTO_DOCUMENT, PHOTO_ID } from "./fixtures";
import { DocumentsScreen } from "./DocumentsScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/documents";

beforeEach(() => {
  setLocation("/confie/documents");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("documents partagés en mode api", () => {
  it("liste les pièces partagées sans chemin de stockage", async () => {
    stubApi({ [LIST]: { body: page([MANDATE_DOCUMENT, PHOTO_DOCUMENT, BARE_DOCUMENT]) } });
    const { container } = renderApi(<DocumentsScreen />);

    const table = await screen.findByRole("table", { name: "Documents partagés par votre agence" });
    expect(within(table).getByText("Mandat de gestion signé")).toBeTruthy();
    expect(within(table).getByText("PDF · 471 Ko")).toBeTruthy();
    expect(within(table).getByText("Image JPEG · 900 o")).toBeTruthy();
    expect(within(table).getAllByText("Autre document").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("L’agence").length).toBe(2);
    expect(within(table).getByText("Vous")).toBeTruthy();
    expect(within(table).getAllByRole("button", { name: /^Télécharger / })).toHaveLength(3);
    expect(document.body.innerHTML).not.toMatch(/stored_file|storage|\/var\//);
    await expectNoA11yViolations(container);
  });

  it("télécharge une pièce par la route du serveur avec la session", async () => {
    const downloads = captureDownloads();
    const stub = stubApi({
      [LIST]: { body: page([MANDATE_DOCUMENT]) },
      [`GET /api/v1/owner/documents/${DOCUMENT_ID}/download`]: { file: { type: "application/pdf", content: "%PDF-1.4" } },
    });
    const { user } = renderApi(<DocumentsScreen />);

    await user.click(await screen.findByRole("button", { name: "Télécharger Mandat de gestion signé" }));

    await waitFor(() => {
      expect(downloads.names).toEqual(["Mandat-de-gestion-signe.pdf"]);
    });
    const call = stub.calls.find((entry) => entry.path.endsWith("/download"));
    expect(call?.init?.credentials).toBe("include");
  });

  it("ajoute l'extension d'une image téléchargée", async () => {
    const downloads = captureDownloads();
    stubApi({
      [LIST]: { body: page([PHOTO_DOCUMENT]) },
      [`GET /api/v1/owner/documents/${PHOTO_ID}/download`]: { file: { type: "image/jpeg", content: "jpeg" } },
    });
    const { user } = renderApi(<DocumentsScreen />);

    await user.click(await screen.findByRole("button", { name: "Télécharger Diagnostic électrique" }));

    await waitFor(() => {
      expect(downloads.names).toEqual(["Diagnostic-electrique.jpg"]);
    });
  });

  it("explique qu'une pièce n'est plus partagée (404)", async () => {
    const downloads = captureDownloads();
    stubApi({ [LIST]: { body: page([MANDATE_DOCUMENT]) }, [`GET /api/v1/owner/documents/${DOCUMENT_ID}/download`]: problem(404, "owner_document_not_found") });
    const { user } = renderApi(<DocumentsScreen />);

    await user.click(await screen.findByRole("button", { name: "Télécharger Mandat de gestion signé" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Ce document n’existe pas ou n’est plus partagé avec vous.");
    expect(downloads.names).toEqual([]);
  });

  it("refuse une réponse JSON à la place d'un fichier", async () => {
    const downloads = captureDownloads();
    stubApi({ [LIST]: { body: page([MANDATE_DOCUMENT]) }, [`GET /api/v1/owner/documents/${DOCUMENT_ID}/download`]: { body: { data: [] } } });
    const { user } = renderApi(<DocumentsScreen />);

    await user.click(await screen.findByRole("button", { name: "Télécharger Mandat de gestion signé" }));

    expect((await screen.findByRole("alert")).textContent).toContain("de façon inattendue");
    expect(downloads.names).toEqual([]);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<DocumentsScreen />);

    expect(await screen.findByText("Aucun document partagé")).toBeTruthy();
  });
});
