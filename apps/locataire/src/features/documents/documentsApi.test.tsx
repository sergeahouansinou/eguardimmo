import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ID, LEASE_ID, inspection, insurance, leaseDocument, page, problem, submission } from "@/tenant/complementsResponses.fixtures";
import { receiptsList } from "@/tenant/rentResponses.fixtures";
import { leasePage, summary } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { captureDownloads } from "../rent/testKit";
import { ApiDocumentsScreen } from "./ApiDocumentsScreen";

const DOCUMENTS = `GET /api/v1/tenant/leases/${LEASE_ID}/documents`;
const INSURANCE = `GET /api/v1/tenant/leases/${LEASE_ID}/insurance`;
const DEMO_TEXTS = ["Koffi Adjovi", "Les Tilleuls", "Apt A1"];
const stubs = (overrides: Record<string, unknown> = {}) => ({
  "GET /api/v1/tenant/leases": { body: leasePage([summary()]) },
  [DOCUMENTS]: { body: page([leaseDocument()]) },
  "GET /api/v1/tenant/rent/receipts": { body: { ...receiptsList, data: receiptsList.data.map((item) => ({ ...item, lease: { ...item.lease, id: LEASE_ID } })) } },
  "GET /api/v1/tenant/inspections": { body: page([inspection(), inspection({ id: ID.inspectionExit, kind: "exit", published_at: null })]) },
  [INSURANCE]: { body: insurance("valid", [submission({ status: "accepted" })], "2027-10-31") },
  ...overrides,
});
const rows = async () => within(await screen.findByRole("table", { name: "Documents" })).getAllByRole("row").slice(1);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("documents du bail", () => {
  it("réunit pièces partagées, quittances, états des lieux publiés et attestations", async () => {
    stubApi(stubs());

    const { container } = renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });

    const all = await rows();
    const text = all.map((row) => row.textContent).join(" | ");
    expect(all).toHaveLength(4);
    expect(text).toContain("Diagnostic énergétique.pdf");
    expect(text).toContain("Quittance QT-2026-0001");
    expect(text).toContain("État des lieux d’entrée");
    expect(text).toContain("Attestation Mutuelle Horizon");
    expect(text).not.toContain("État des lieux de sortie");
    for (const demo of DEMO_TEXTS) expect(document.body.textContent).not.toContain(demo);
    await expectNoA11yViolations(container);
  });

  it("télécharge une pièce partagée par son chemin d’API", async () => {
    const saved = captureDownloads();
    const api = stubApi(stubs({ [`GET /api/v1/tenant/leases/${LEASE_ID}/documents/${ID.document}/download`]: { pdf: "%PDF-1.4" } }));

    const { user } = renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });
    await user.click(await screen.findByRole("button", { name: "Télécharger Diagnostic énergétique.pdf" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(api.count("GET", `/api/v1/tenant/leases/${LEASE_ID}/documents/${ID.document}/download`)).toBe(1);
    expect(saved[0]?.download).toBe("Diagnostic-energetique.pdf");
  });

  it("filtre par catégorie", async () => {
    stubApi(stubs());

    const { user } = renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });
    await rows();
    await user.click(screen.getByRole("tab", { name: /^Quittances/ }));

    const filtered = await rows();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.textContent).toContain("Quittance QT-2026-0001");
  });

  it("n’offre pas de téléchargement quand le fichier est indisponible", async () => {
    stubApi(stubs({ [DOCUMENTS]: { body: page([leaseDocument({ file: null })]) } }));

    renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });

    const all = await rows();
    const unavailable = all.find((row) => row.textContent.includes("fichier indisponible"));
    expect(unavailable).toBeDefined();
    if (unavailable === undefined) return;
    expect(within(unavailable).queryByRole("button")).toBeNull();
  });

  it("signale la source en panne sans masquer les autres documents", async () => {
    stubApi(stubs({ [INSURANCE]: { status: 500, body: problem(500, "server_error", "Boom") } }));

    renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });

    expect(await screen.findByText("Les attestations d’assurance n’ont pas pu être chargées")).toBeTruthy();
    expect((await rows()).length).toBe(3);
  });

  it("traduit le refus d’un fichier de pièce invalide au téléchargement", async () => {
    const saved = captureDownloads();
    stubApi(stubs({ [`GET /api/v1/tenant/leases/${LEASE_ID}/documents/${ID.document}/download`]: { status: 409, body: problem(409, "lease_document_invalid", "x") } }));

    const { user } = renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });
    await user.click(await screen.findByRole("button", { name: "Télécharger Diagnostic énergétique.pdf" }));

    expect(await screen.findByText(/Ce document n’est plus utilisable : son fichier est absent ou illisible/)).toBeTruthy();
    expect(saved).toHaveLength(0);
  });

  it("annonce l’absence de document", async () => {
    stubApi(stubs({
      [DOCUMENTS]: { body: page([]) },
      "GET /api/v1/tenant/rent/receipts": { body: { ...receiptsList, data: [] } },
      "GET /api/v1/tenant/inspections": { body: page([]) },
      [INSURANCE]: { body: insurance("missing") },
    }));

    renderApi(<ApiDocumentsScreen />, { pathname: "/documents" });

    expect(await screen.findByText("Aucun document")).toBeTruthy();
  });
});
