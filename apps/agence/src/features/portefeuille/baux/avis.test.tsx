import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation, router } from "../../../../test/navigation";
import { avisLines, avisMonths, defaultAvisMonth, dueIsoOf, monthLabel } from "../avis";
import { indexPortefeuille } from "../selectors";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, pickOption, renderPortefeuille } from "../testing";
import { AvisEcheancePage } from "./AvisEcheancePage";
import { BailDetailPage } from "./BailDetailPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
  vi.unstubAllGlobals();
});

function table(): HTMLElement {
  return screen.getByRole("table", { name: "Avis d'échéance du mois" });
}

function rowOf(number: string): HTMLElement {
  const row = within(table()).getByText(number).closest("tr");
  if (!row) throw new Error(`Ligne introuvable : ${number}`);
  return row;
}

async function avisOf(source: ReturnType<typeof createDemoSource>, month: string) {
  return parsePortefeuille(await source.load()).avis.filter((item) => item.month === month);
}

describe("sélecteurs d'avis", () => {
  it("propose du mois précédent à trois mois plus tard et ouvre sur le mois suivant", () => {
    expect(avisMonths("2026-11-13")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(defaultAvisMonth("2026-11-13")).toBe("2026-12");
    expect(monthLabel("2026-12")).toBe("Décembre 2026");
  });
});

describe("liste des avis du mois", () => {
  it("ouvre sur décembre avec les avis déjà envoyés", async () => {
    const { container } = renderPortefeuille(<AvisEcheancePage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Avis d'échéance" })).toBeTruthy();
    expect(within(table()).getAllByRole("row")).toHaveLength(15);
    expect(within(rowOf("B-2024-018")).getByText("Envoyé le 10/11/2026")).toBeTruthy();
    expect(within(rowOf("B-2026-007")).getByText("À émettre")).toBeTruthy();
    expect(within(rowOf("B-2024-018")).getByText("01/12/2026")).toBeTruthy();
    expect(within(rowOf("B-2026-004")).getByText("19/12/2026")).toBeTruthy();
    expect(within(rowOf("B-2024-018")).getByText("700,00 €")).toBeTruthy();
    expect(screen.getByText("Avis de décembre 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Envoyer les avis sélectionnés" }).hasAttribute("disabled")).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("affiche novembre entièrement envoyé quand le mois est demandé", async () => {
    resetNavigation("mois=2026-11");
    renderPortefeuille(<AvisEcheancePage />);
    expect(await screen.findByText("Avis de novembre 2026")).toBeTruthy();
    expect(within(rowOf("B-2026-007")).getByText("Envoyé le 25/10/2026")).toBeTruthy();
    const button = screen.getByRole("button", { name: /Sélectionner les avis à émettre, 0/ });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("retombe sur le mois suivant quand le mois demandé est invalide", async () => {
    resetNavigation("mois=1999-01");
    renderPortefeuille(<AvisEcheancePage />);
    expect(await screen.findByText("Avis de décembre 2026")).toBeTruthy();
  });

  it("change de mois via le sélecteur", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<AvisEcheancePage />);
    await screen.findByText("Avis de décembre 2026");
    await pickOption(user, /^Mois/, "Novembre 2026");
    expect(router.replace).toHaveBeenCalledWith("/baux/avis-echeance?mois=2026-11");
  });

  it("filtre par recherche, mandant et avis à émettre", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<AvisEcheancePage />);
    const search = await screen.findByRole("searchbox", { name: "Rechercher un avis" });
    await user.type(search, "roux");
    expect(within(table()).getByText("B-2026-007")).toBeTruthy();
    expect(within(table()).queryByText("B-2024-018")).toBeNull();
    await user.clear(search);
    await user.type(search, "zzzz");
    expect(screen.getByText("Aucun avis ne correspond")).toBeTruthy();
    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "À émettre" }));
    expect(within(table()).queryByText("B-2024-018")).toBeNull();
    expect(within(table()).getByText("B-2026-007")).toBeTruthy();
    await pickOption(user, /^Mandant/, "Famille Bernard");
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<AvisEcheancePage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});

describe("envoi des avis", () => {
  it("envoie en groupe les avis à émettre après confirmation", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<AvisEcheancePage />, source);
    await user.click(await screen.findByRole("button", { name: "Sélectionner les avis à émettre, 11" }));
    const send = screen.getByRole("button", { name: "Envoyer les avis sélectionnés, 11" });
    expect(within(rowOf("B-2024-018")).getByRole("checkbox").hasAttribute("disabled")).toBe(true);
    expect(within(rowOf("B-2026-007")).getByRole("checkbox")).toHaveProperty("checked", true);
    await user.click(send);
    const dialog = await screen.findByRole("dialog");
    expect(await avisOf(source, "2026-12")).toHaveLength(3);
    await user.click(within(dialog).getByRole("button", { name: "Envoyer les avis" }));
    await waitFor(async () => { expect(await avisOf(source, "2026-12")).toHaveLength(14); });
    expect(await screen.findByText("11 avis envoyés")).toBeTruthy();
    await waitFor(() => { expect(within(rowOf("B-2026-007")).getByText("Envoyé le 13/11/2026")).toBeTruthy(); });
    expect(screen.getByRole("button", { name: "Envoyer les avis sélectionnés" }).hasAttribute("disabled")).toBe(true);
  });

  it("n'envoie que les lignes cochées", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<AvisEcheancePage />, source);
    await screen.findByRole("heading", { level: 1, name: "Avis d'échéance" });
    await user.click(within(rowOf("B-2026-007")).getByRole("checkbox"));
    await user.click(within(rowOf("B-2026-004")).getByRole("checkbox"));
    await user.click(within(rowOf("B-2026-004")).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Envoyer les avis sélectionnés, 1" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Envoyer les avis" }));
    await waitFor(async () => { expect(await avisOf(source, "2026-12")).toHaveLength(4); });
    expect((await avisOf(source, "2026-12")).some((item) => item.bailId === "b-2026-007")).toBe(true);
    expect(await screen.findByText("Avis envoyé")).toBeTruthy();
  });

  it("annule l'envoi groupé sans rien écrire", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<AvisEcheancePage />, source);
    await user.click(await screen.findByRole("button", { name: "Sélectionner les avis à émettre, 11" }));
    await user.click(screen.getByRole("button", { name: "Envoyer les avis sélectionnés, 11" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler" }));
    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(await avisOf(source, "2026-12")).toHaveLength(3);
  });

  it("envoie ou renvoie un avis depuis le menu de la ligne", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<AvisEcheancePage />, source);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'avis B-2026-007" }));
    await user.click(await screen.findByRole("menuitem", { name: "Envoyer l'avis" }));
    await waitFor(async () => { expect(await avisOf(source, "2026-12")).toHaveLength(4); });
    await user.click(screen.getByRole("button", { name: "Actions pour l'avis B-2024-018" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renvoyer l'avis" }));
    await waitFor(async () => { expect((await avisOf(source, "2026-12")).find((item) => item.bailId === "b-2024-018")?.sentIso).toBe("2026-11-13"); });
    expect(await avisOf(source, "2026-12")).toHaveLength(4);
  });

  it("affiche l'échec de l'envoi sans marquer l'avis envoyé", async () => {
    const user = userEvent.setup();
    const source = { ...createDemoSource(), sendAvis: () => Promise.reject(new Error("Messagerie indisponible")) };
    renderPortefeuille(<AvisEcheancePage />, source);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'avis B-2026-007" }));
    await user.click(await screen.findByRole("menuitem", { name: "Envoyer l'avis" }));
    expect(await screen.findByText("Envoi impossible")).toBeTruthy();
    expect(screen.getByText("Messagerie indisponible")).toBeTruthy();
    expect(within(rowOf("B-2026-007")).getByText("À émettre")).toBeTruthy();
  });
});

describe("aperçu imprimable", () => {
  it("affiche l'avis A4 du bail choisi", async () => {
    const user = userEvent.setup();
    const { container } = renderPortefeuille(<AvisEcheancePage />);
    await user.click(await screen.findByRole("button", { name: "Voir l'aperçu de l'avis B-2024-018" }));
    const paper = await screen.findByRole("article", { name: "Avis d'échéance Décembre 2026, Thomas Girard" });
    expect(paper.hasAttribute("data-print-area")).toBe(true);
    expect(paper.className).toContain("avis-paper");
    expect(within(paper).getByText("Référence AE-2026-12-B-2024-018")).toBeTruthy();
    expect(within(paper).getByText("Loyer hors charges")).toBeTruthy();
    expect(within(paper).getByText("640,00 €")).toBeTruthy();
    expect(within(paper).getByText("60,00 €")).toBeTruthy();
    expect(within(paper).getByText("700,00 €")).toBeTruthy();
    expect(within(paper).getByText("Marc Chevalier")).toBeTruthy();
    expect(within(paper).getByText("Virement")).toBeTruthy();
    expect(within(paper).getByText(/n'est pas une quittance/)).toBeTruthy();
    expect(document.querySelector("style")?.textContent).toContain("@media print");
    await expectNoA11yViolations(container);
  });

  it("imprime et ferme l'aperçu", async () => {
    const user = userEvent.setup();
    const print = vi.fn<() => void>();
    vi.stubGlobal("print", print);
    renderPortefeuille(<AvisEcheancePage />);
    await user.click(await screen.findByRole("button", { name: "Voir l'aperçu de l'avis B-2024-018" }));
    await user.click(await screen.findByRole("button", { name: "Imprimer" }));
    expect(print).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));
    expect(screen.queryByRole("region", { name: "Aperçu de l'avis" })).toBeNull();
  });

  it("envoie l'avis affiché depuis l'aperçu", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<AvisEcheancePage />, source);
    await user.click(await screen.findByRole("button", { name: "Voir l'aperçu de l'avis B-2026-007" }));
    const preview = await screen.findByRole("region", { name: "Aperçu de l'avis" });
    await user.click(within(preview).getByRole("button", { name: "Envoyer l'avis" }));
    await waitFor(async () => { expect(await avisOf(source, "2026-12")).toHaveLength(4); });
    await waitFor(() => { expect(within(preview).getByRole("button", { name: "Renvoyer l'avis" })).toBeTruthy(); });
  });

  it("ouvre directement l'avis d'un bail passé dans l'adresse", async () => {
    resetNavigation("bail=b-2026-007&mois=2026-11");
    renderPortefeuille(<AvisEcheancePage />);
    expect(await screen.findByRole("article", { name: "Avis d'échéance Novembre 2026, Anaïs Roux" })).toBeTruthy();
    expect(screen.getByText("Référence AE-2026-11-B-2026-007")).toBeTruthy();
  });

  it("explique l'absence d'avis pour un bail inconnu", async () => {
    resetNavigation("bail=inconnu");
    renderPortefeuille(<AvisEcheancePage />);
    expect(await screen.findByText(/Aucun avis décembre 2026 pour le bail « inconnu »/)).toBeTruthy();
  });
});

describe("accès depuis un bail", () => {
  it("le lien de la fiche bail cible son propre avis", async () => {
    renderPortefeuille(<BailDetailPage id="b-2024-018" />);
    const link = await screen.findByRole("link", { name: "Émettre l'avis d'échéance" });
    expect(link.getAttribute("href")).toBe("/baux/avis-echeance?bail=b-2024-018");
  });
});

describe("calcul des lignes", () => {
  it("ne retient que les baux en cours dont l'échéance tombe dans la durée du bail", async () => {
    const source = createDemoSource();
    const index = indexPortefeuille(parsePortefeuille(await source.load()));
    expect(avisLines(index, "2026-12")).toHaveLength(14);
    expect(avisLines(index, "2027-02").map((line) => line.bail.number)).not.toContain("B-2024-003");
    expect(avisLines(index, "2027-02")).toHaveLength(13);
    const bail = index.bail("b-2026-004");
    expect(bail && dueIsoOf(bail, "2026-12")).toBe("2026-12-19");
  });
});
