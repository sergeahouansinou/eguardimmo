import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { setLocation } from "../../../test/navigation";
import { problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { CREDIT_NOTE, INVOICE, INVOICE_DETAIL, INVOICE_ID } from "./fixtures";
import { InvoiceScreen } from "./InvoiceScreen";
import { InvoicesScreen } from "./InvoicesScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/invoices";
const DETAIL = `GET /api/v1/owner/invoices/${INVOICE_ID}`;
const PDF = `GET /api/v1/owner/invoices/${INVOICE_ID}/download`;

beforeEach(() => {
  setLocation("/confie/factures");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("factures d'honoraires en mode api", () => {
  it("liste les factures et les avoirs avec les totaux du serveur", async () => {
    stubApi({ [LIST]: { body: page([INVOICE, CREDIT_NOTE]) } });
    const { container } = renderApi(<InvoicesScreen />);

    const table = await screen.findByRole("table", { name: "Factures d’honoraires et avoirs" });
    expect(within(table).getByRole("link", { name: "Facture FA-2026-0031" }).getAttribute("href")).toBe(`/confie/factures/${INVOICE_ID}`);
    expect(within(table).getByRole("link", { name: "Avoir AV-2026-0002" })).toBeTruthy();
    expect(within(table).getByText("Émise")).toBeTruthy();
    expect(within(table).getByText("Réglée")).toBeTruthy();
    expect(within(table).getAllByText("67,20 €")).toHaveLength(2);
    await expectNoA11yViolations(container);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<InvoicesScreen />);

    expect(await screen.findByText("Aucune facture")).toBeTruthy();
  });

  it("détaille lignes, taxes et totaux sans les recalculer", async () => {
    stubApi({ [DETAIL]: { body: one(INVOICE_DETAIL) } });
    const { container } = renderApi(<InvoiceScreen id={INVOICE_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Facture FA-2026-0031" })).toBeTruthy();
    const lines = screen.getByRole("table", { name: "Lignes de la facture" });
    expect(within(lines).getByText("Honoraires de gestion d’octobre 2026")).toBeTruthy();
    expect(within(lines).getByText("Taux normal · 20 %")).toBeTruthy();
    expect(within(lines).getByText("1")).toBeTruthy();
    const taxes = screen.getByRole("table", { name: "Taxes de la facture" });
    expect(within(taxes).getByText("11,20 €")).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Facture" });
    expect(within(summary).getByText("Du 01/10/2026 au 31/10/2026")).toBeTruthy();
    expect(within(summary).getByText("67,20 €")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("renvoie un avoir vers la facture corrigée et signale l'absence de PDF", async () => {
    stubApi({ [DETAIL]: { body: one({ ...INVOICE_DETAIL, kind: "credit_note", number: "AV-2026-0002", credited_invoice_id: "0193a5e1-0000-7000-8000-000000000299", has_pdf: false }) } });
    renderApi(<InvoiceScreen id={INVOICE_ID} />);

    expect(await screen.findByRole("link", { name: "Voir la facture corrigée par cet avoir" }).then((link) => link.getAttribute("href"))).toBe("/confie/factures/0193a5e1-0000-7000-8000-000000000299");
    expect(screen.getByText("Le PDF de cette facture n’est pas disponible.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Télécharger le PDF" })).toBeNull();
  });

  it("télécharge le PDF de la facture", async () => {
    const downloads = captureDownloads();
    stubApi({ [DETAIL]: { body: one(INVOICE_DETAIL) }, [PDF]: { file: { type: "application/pdf", content: "%PDF" } } });
    const { user } = renderApi(<InvoiceScreen id={INVOICE_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    await waitFor(() => {
      expect(downloads.names).toEqual(["facture-FA-2026-0031.pdf"]);
    });
  });

  it("explique qu'un PDF est indisponible (503)", async () => {
    stubApi({ [DETAIL]: { body: one(INVOICE_DETAIL) }, [PDF]: problem(503, "invoice_pdf_unavailable") });
    const { user } = renderApi(<InvoiceScreen id={INVOICE_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Le PDF de cette facture n’est pas disponible pour le moment.");
  });

  it("signale une facture hors de vos accès", async () => {
    stubApi({ [DETAIL]: problem(404, "owner_invoice_not_found") });
    renderApi(<InvoiceScreen id={INVOICE_ID} />);

    expect(await screen.findByText("Cette facture n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux factures" }).getAttribute("href")).toBe("/confie/factures");
  });
});
