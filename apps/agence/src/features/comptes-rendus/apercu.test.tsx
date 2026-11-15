import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";
import { ApercuPage } from "./ApercuPage";
import { reportDetailSchema } from "./schemas";
import { fakeSource } from "./testSupport";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

async function openMarc() {
  const rendered = renderScreen(<ApercuPage id="marc-chevalier-2026-11" />, fakeSource());
  await screen.findByRole("heading", { level: 1, name: "Compte rendu, novembre 2026" });
  return rendered;
}

function inToolbar(text: string): HTMLElement {
  return within(screen.getByRole("toolbar", { name: "Barre d'outils de l'aperçu" })).getByText(text);
}

function currentPage(container: HTMLElement): string | null {
  return container.querySelector('[data-current="true"]')?.getAttribute("data-page") ?? null;
}

describe("aperçu du compte rendu", () => {
  it("affiche le document A4 de Marc Chevalier avec les chiffres du serveur", async () => {
    const { container } = await openMarc();
    expect(screen.getByText("Brouillon")).toBeTruthy();
    expect(screen.getByText("Marc Chevalier, SCI Chevalier · aperçu avant publication dans son espace propriétaire.")).toBeTruthy();
    const paper = screen.getByRole("article", { name: "Compte rendu de gestion" });
    const first = within(paper).getByRole("region", { name: "Page 1 sur 2" });
    expect(within(first).getByText("COMPTE RENDU DE GESTION")).toBeTruthy();
    expect(within(first).getByText("Mandat M-2025-0142")).toBeTruthy();
    expect(within(first).getByText("Cabinet Delmas Immobilier")).toBeTruthy();
    expect(within(first).getAllByText("700,00 €").length).toBeGreaterThan(0);
    expect(within(first).getAllByText("651,00 €").length).toBeGreaterThan(0);
    expect(within(first).getByText("1 150,00 €")).toBeTruthy();
    expect(within(first).getByText("Studio 4 : loyer de 450,00 € impayé depuis le 01/11/2026, deux relances envoyées. Il sera reversé après encaissement.")).toBeTruthy();
    expect(within(first).getByText("Virement de 651,00 € prévu le 05/12/2026 sur le compte •••• 2031.")).toBeTruthy();
    expect(within(first).getByText("Cabinet Delmas Immobilier, document généré le 13/11/2026 à 10:02")).toBeTruthy();
    const sidebar = screen.getByRole("region", { name: "Contenu" });
    expect(within(sidebar).getByText("Pages").nextSibling?.textContent).toBe("2");
    expect(within(sidebar).getByText("Lots").nextSibling?.textContent).toBe("2");
    expect(within(sidebar).getByText("Quittances").nextSibling?.textContent).toBe("1");
    expect(screen.getByRole("link", { name: "Comptes rendus" }).getAttribute("href")).toBe("/comptes-rendus");
    expect(container.querySelector("[data-print-area]")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("navigue entre les pages et change le zoom", async () => {
    const { container } = await openMarc();
    expect(inToolbar("Page 1 sur 2")).toBeTruthy();
    expect(currentPage(container)).toBe("1");
    expect(screen.getByRole("button", { name: "Page précédente" }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(inToolbar("Page 2 sur 2")).toBeTruthy();
    expect(currentPage(container)).toBe("2");
    expect(screen.getByText("Quittances jointes", { selector: "b" })).toBeTruthy();
    expect(screen.getByText("Q-2026-11-APT-12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Page suivante" }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Page précédente" }));
    expect(currentPage(container)).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Agrandir" }));
    expect(screen.getByText("125 %")).toBeTruthy();
    expect(container.querySelector<HTMLElement>("[data-print-area]")?.style.zoom).toBe("1.25");
    await userEvent.click(screen.getByRole("button", { name: "Réduire" }));
    await userEvent.click(screen.getByRole("button", { name: "Réduire" }));
    expect(screen.getByText("75 %")).toBeTruthy();
  });

  it("applique réellement les options du PDF à l'aperçu", async () => {
    await openMarc();
    expect(screen.getByText("Agence de gestion locative, Paris")).toBeTruthy();
    await userEvent.click(screen.getByRole("switch", { name: "Papier à en-tête" }));
    await waitFor(() => {
      expect(screen.queryByText("Agence de gestion locative, Paris")).toBeNull();
    });
    await userEvent.click(screen.getByRole("switch", { name: "Détail des relances" }));
    expect(await screen.findByText("Détail des relances", { selector: "b" })).toBeTruthy();
    expect(screen.getAllByText("n° 1").length).toBe(1);
    expect(screen.getByText("n° 2")).toBeTruthy();
    await userEvent.click(screen.getByRole("switch", { name: "Quittances jointes" }));
    await waitFor(() => {
      expect(screen.queryByText("Quittances jointes", { selector: "b" })).toBeNull();
    });
    expect(inToolbar("Page 1 sur 2")).toBeTruthy();
    await userEvent.click(screen.getByRole("switch", { name: "Détail des relances" }));
    await waitFor(() => {
      expect(inToolbar("Page 1 sur 1")).toBeTruthy();
    });
    const sidebar = screen.getByRole("region", { name: "Contenu" });
    expect(within(sidebar).getByText("Quittances").nextSibling?.textContent).toBe("0");
  });

  it("publie le compte rendu après confirmation", async () => {
    const { source } = await openMarc();
    await userEvent.click(screen.getByRole("button", { name: "Publier le compte rendu" }));
    const dialog = await screen.findByRole("dialog", { name: "Publier le compte rendu ?" });
    expect(within(dialog).getByText(/Cette action est définitive/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publier" }));
    expect(await screen.findByText("Compte rendu publié")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Publier le compte rendu" })).toBeNull();
    });
    expect(screen.getByText("Publié")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Modifier" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Papier à en-tête" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Publié le 13/11/2026")).toBeTruthy();
    const detail = reportDetailSchema.parse(await source.comptesRendus.get("marc-chevalier-2026-11"));
    expect(detail).toMatchObject({ state: "publie", publishedOn: "2026-11-13" });
  });

  it("ouvre le formulaire de génération pour modifier les paramètres", async () => {
    await openMarc();
    expect(screen.getByRole("link", { name: "Modifier" }).getAttribute("href")).toBe("/comptes-rendus/nouveau?reprise=marc-chevalier-2026-11");
  });

  it("génère un compte rendu qui n'existait pas encore", async () => {
    const { source } = renderScreen(<ApercuPage id="famille-bernard-2026-11" />, fakeSource());
    expect(await screen.findByText("À générer", { selector: "span" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publier le compte rendu" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Quittances jointes" }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Générer le compte rendu" }));
    expect(await screen.findByRole("button", { name: "Publier le compte rendu" })).toBeTruthy();
    expect(reportDetailSchema.parse(await source.comptesRendus.get("famille-bernard-2026-11")).state).toBe("genere");
  });

  it("imprime uniquement la zone papier grâce à une feuille d'impression statique", async () => {
    const print = vi.fn<() => void>();
    vi.stubGlobal("print", print);
    const { container } = await openMarc();
    await userEvent.click(screen.getByRole("button", { name: "Télécharger le PDF" }));
    await userEvent.click(screen.getByRole("button", { name: "Imprimer" }));
    expect(print).toHaveBeenCalledTimes(2);
    const style = container.querySelector("style")?.textContent ?? "";
    expect(style).toContain("@media print");
    expect(style).toContain("[data-print-area]");
    vi.unstubAllGlobals();
  });

  it("affiche l'état introuvable pour un identifiant inconnu", async () => {
    const { container } = renderScreen(<ApercuPage id="inconnu-2026-11" />, fakeSource());
    expect(await screen.findByRole("heading", { name: "Compte rendu introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux comptes rendus" }).getAttribute("href")).toBe("/comptes-rendus");
    await expectNoA11yViolations(container);
  });

  it("annonce l'erreur de chargement", async () => {
    renderScreen(<ApercuPage id="marc-chevalier-2026-11" />, fakeSource(() => Promise.reject(new Error("panne"))));
    expect(await screen.findByText("Le compte rendu n'a pas pu être chargé")).toBeTruthy();
  });
});
