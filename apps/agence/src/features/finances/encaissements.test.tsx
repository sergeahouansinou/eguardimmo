import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderScreen } from "../../../test/render";
import { resetNavigation, router } from "../../../test/navigation";
import { formatMoney, formatMoneyExact } from "@/features/shared/money";
import { createDemoSource } from "@/features/source";
import { EncaissementsPage } from "./encaissements/EncaissementsPage";
import { PaymentFormPage } from "./encaissements/PaymentFormPage";
import { ImpayesPage } from "./impayes/ImpayesPage";
import { encaissementsSchema, impayesSchema } from "./schemas";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

const plain = (value: string): string => value.replace(/[\u00a0\u202f]/g, " ");

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("rowheader", { name: new RegExp(name) }).closest("tr");
  if (!row) throw new Error(`Ligne introuvable : ${name}`);
  return row;
}

describe("Encaissements", () => {
  it("affiche les totaux et les lignes de la maquette", async () => {
    const { container } = renderScreen(<EncaissementsPage />);
    expect(await screen.findByRole("heading", { name: "Encaissements" })).toBeTruthy();
    expect(await screen.findByText(plain(formatMoney(1_194_000)))).toBeTruthy();
    expect(screen.getAllByText(plain(formatMoneyExact(83_580))).length).toBeGreaterThan(0);
    expect(screen.getByText(plain(formatMoney(126_000)))).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Reçus/ }).textContent).toContain("11");
    expect(screen.getByRole("tab", { name: /À rapprocher/ }).textContent).toContain("1");
    expect(within(rowOf("Inès Laurent")).getByText("À rapprocher")).toBeTruthy();
    expect(within(rowOf("Olivier Blanc")).getByText(plain(formatMoneyExact(122_000)))).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filtre par recherche et affiche l'état vide", async () => {
    const user = userEvent.setup();
    renderScreen(<EncaissementsPage />);
    await screen.findByRole("rowheader", { name: /Olivier Blanc/ });
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un locataire ou un lot" }), "zzzz");
    expect((await screen.findAllByText(/Aucun/)).length).toBeGreaterThan(0);
  });

  it("rapproche un chèque à rapprocher", async () => {
    const user = userEvent.setup();
    const { source } = renderScreen(<EncaissementsPage />);
    const row = await screen.findByRole("rowheader", { name: /Inès Laurent/ }).then((cell) => cell.closest("tr"));
    if (!row) throw new Error("Ligne introuvable");
    await user.click(within(row).getByRole("button", { name: "Ouvrir" }));
    await user.click(await screen.findByRole("button", { name: /Rapprocher/ }));
    await waitFor(async () => {
      const data = encaissementsSchema.parse(await source.finances.encaissements("2026-11"));
      expect(JSON.stringify(data)).not.toContain("a_rapprocher");
    });
  });
});

describe("Saisie d'un paiement", () => {
  it("enregistre le paiement, clôt l'impayé et met à jour le reversement", async () => {
    resetNavigation("lot=studio-4");
    const user = userEvent.setup();
    const source = createDemoSource();
    const before = impayesSchema.parse(await source.finances.impayes()).rows.length;
    const { container } = renderScreen(<PaymentFormPage />, source);
    expect(await screen.findByText(/L'impayé de Studio 4 sera clos/)).toBeTruthy();
    expect(screen.getByText(plain(formatMoneyExact(3_150)))).toBeTruthy();
    expect(screen.getByText(plain(formatMoneyExact(41_850)))).toBeTruthy();
    expect(screen.getByPlaceholderText("450,00")).toBeTruthy();
    expect(screen.getByPlaceholderText("VIR 13/11 ROUX STUDIO 4")).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Enregistrer le paiement" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/finances/encaissements");
    });
    expect(impayesSchema.parse(await source.finances.impayes()).rows.length).toBe(before - 1);
    const march = encaissementsSchema.parse(await source.finances.encaissements("2026-11"));
    expect(march.collectedMinor).toBe(1_194_000 + 45_000);
    expect(march.feeMinor).toBe(83_580 + 3_150);
  });

  it("refuse un montant supérieur au reste dû", async () => {
    resetNavigation("lot=studio-4");
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<PaymentFormPage />, source);
    const amount = await screen.findByRole("textbox", { name: /Montant reçu/ });
    await user.clear(amount);
    await user.type(amount, "500");
    expect(await screen.findByText(/Le montant dépasse le reste dû/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Enregistrer le paiement" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(encaissementsSchema.parse(await source.finances.encaissements("2026-11")).collectedMinor).toBe(1_194_000);
  });
});

describe("Impayés listés", () => {
  it("affiche les trois impayés de la maquette", async () => {
    const { container } = renderScreen(<ImpayesPage />);
    expect(await screen.findByRole("heading", { name: "Impayés" })).toBeTruthy();
    expect((await screen.findAllByText(/Louis Petit/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /Tous/ }).textContent).toContain("3");
    expect(screen.getByRole("tab", { name: /Plus de 15 jours/ }).textContent).toContain("1");
    expect(screen.getAllByText("Mise en demeure à envoyer").length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });
});

