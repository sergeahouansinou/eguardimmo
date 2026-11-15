import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";
import { downloadCsv } from "@/lib/csv";
import { ComptesRendusPage } from "./ComptesRendusPage";
import { GenerationPage } from "./GenerationPage";
import { overviewSchema, reportDetailSchema } from "./schemas";
import type { GenerateRequest } from "./schemas";
import { fakeSource } from "./testSupport";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());
vi.mock("@/lib/csv", async (original) => ({ ...(await original<typeof import("@/lib/csv")>()), downloadCsv: vi.fn<(name: string, content: string) => void>() }));

beforeEach(() => {
  resetNavigation();
  vi.mocked(downloadCsv).mockReset();
});

function rowNames(): string[] {
  return screen.getAllByRole("rowheader").map((cell) => cell.textContent);
}

describe("liste des comptes rendus", () => {
  it("affiche les six comptes rendus de novembre avec les montants de la maquette", async () => {
    const { container } = renderScreen(<ComptesRendusPage />, fakeSource());
    expect(await screen.findByRole("rowheader", { name: /Marc Chevalier/ })).toBeTruthy();
    expect(rowNames()).toEqual(["Famille BernardIndivision", "Hélène RousselParticulier", "Marc ChevalierSCI Chevalier", "Nadia BenaliParticulier", "Paul LemoineParticulier", "SCI Les AcaciasSociété civile"]);
    const marc = screen.getByRole("rowheader", { name: /Marc Chevalier/ }).closest("tr");
    expect(marc && within(marc).getByText("700,00 €")).toBeTruthy();
    expect(marc && within(marc).getByText("49,00 €")).toBeTruthy();
    expect(marc && within(marc).getByText("651,00 €")).toBeTruthy();
    expect(marc && within(marc).getByText("Brouillon")).toBeTruthy();
    expect(marc && within(marc).getByText("05/11/2026, octobre")).toBeTruthy();
    expect(marc && within(marc).getByRole("link", { name: "Reprendre le compte rendu de Marc Chevalier" }).getAttribute("href")).toBe("/comptes-rendus/marc-chevalier-2026-11/apercu");
    const total = screen.getByRole("row", { name: /Total/ });
    expect(within(total).getByText("11 940,00 €")).toBeTruthy();
    expect(within(total).getByText("835,80 €")).toBeTruthy();
    expect(within(total).getByText("11 104,20 €")).toBeTruthy();
    expect(screen.getByText("comptes rendus de novembre")).toBeTruthy();
    expect(screen.getByText("6 comptes rendus d'octobre, lus 5 sur 6")).toBeTruthy();
    expect(screen.getByText("avec les reversements")).toBeTruthy();
    expect(screen.getByText("05/12/2026")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /À générer/ }).textContent).toContain("6");
    expect(screen.getByRole("tab", { name: /Envoyés/ }).textContent).toContain("24");
    expect(screen.getByRole("link", { name: "Générer les comptes rendus" }).getAttribute("href")).toBe("/comptes-rendus/nouveau");
    await expectNoA11yViolations(container);
  });

  it("filtre par brouillon et par mandant puis affiche l'état vide", async () => {
    renderScreen(<ComptesRendusPage />, fakeSource());
    await screen.findByRole("rowheader", { name: /Marc Chevalier/ });
    await userEvent.click(screen.getByRole("button", { name: "Brouillon" }));
    expect(rowNames()).toEqual(["Marc ChevalierSCI Chevalier"]);
    await userEvent.click(screen.getByRole("button", { name: "Brouillon" }));
    await userEvent.click(screen.getByRole("combobox", { name: /Mandant/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Nadia Benali" }));
    expect(rowNames()).toEqual(["Nadia BenaliParticulier"]);
    await userEvent.click(screen.getByRole("button", { name: "Brouillon" }));
    expect(screen.getByText("Aucun compte rendu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exporter" }).hasAttribute("disabled")).toBe(true);
  });

  it("parcourt les envoyés avec pagination", async () => {
    renderScreen(<ComptesRendusPage />, fakeSource());
    await screen.findByRole("rowheader", { name: /Marc Chevalier/ });
    await userEvent.click(screen.getByRole("tab", { name: /Envoyés/ }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(10);
    expect(screen.getByText("1 à 10 sur 24")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(screen.getByText("11 à 20 sur 24")).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox", { name: /Période/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Juillet 2026" }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(6);
    expect(screen.getByText("1 à 6 sur 6")).toBeTruthy();
    expect(screen.getAllByText("Publié").length).toBeGreaterThan(0);
  });

  it("génère un compte rendu depuis la ligne et ouvre son aperçu", async () => {
    const { source } = renderScreen(<ComptesRendusPage />, fakeSource());
    await userEvent.click(await screen.findByRole("button", { name: "Générer le compte rendu de Famille Bernard" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/comptes-rendus/famille-bernard-2026-11/apercu");
    });
    const detail = reportDetailSchema.parse(await source.comptesRendus.get("famille-bernard-2026-11"));
    expect(detail.state).toBe("genere");
    expect(detail.statement.netMinor).toBe(265050);
  });

  it("exporte réellement un CSV des lignes filtrées", async () => {
    renderScreen(<ComptesRendusPage />, fakeSource());
    await screen.findByRole("rowheader", { name: /Marc Chevalier/ });
    await userEvent.click(screen.getByRole("button", { name: "Exporter" }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [name, content] = vi.mocked(downloadCsv).mock.calls[0] ?? ["", ""];
    expect(name).toBe("comptes-rendus.csv");
    expect(content.split("\r\n")).toHaveLength(7);
    expect(content).toContain("Marc Chevalier;SCI Chevalier;Novembre 2026;700,00;49,00;651,00;05/11/2026, octobre;Brouillon");
    expect(await screen.findByText("Export prêt")).toBeTruthy();
  });

  it("affiche l'erreur quand les chiffres de gestion sont indisponibles", async () => {
    renderScreen(<ComptesRendusPage />, fakeSource(() => Promise.reject(new Error("finances en panne"))));
    expect(await screen.findByText("Les comptes rendus n'a pas pu être chargé")).toBeTruthy();
  });

  it("accepte une réponse de finances non conforme comme une panne, pas comme une liste vide", async () => {
    const { source } = renderScreen(<ComptesRendusPage />, fakeSource(() => Promise.resolve({ inattendu: true })));
    await expect(source.comptesRendus.list()).rejects.toMatchObject({ code: "finances" });
  });
});

describe("génération des comptes rendus", () => {
  it("génère les six comptes rendus avec le récapitulatif calculé", async () => {
    const { container, source } = renderScreen(<GenerationPage />, fakeSource());
    expect(await screen.findByRole("button", { name: "Générer 6 comptes rendus" })).toBeTruthy();
    const recap = screen.getByRole("region", { name: "Récapitulatif" });
    expect(within(recap).getByText("14")).toBeTruthy();
    expect(within(recap).getByText("11 104,20 €")).toBeTruthy();
    expect(within(recap).getByText("11")).toBeTruthy();
    expect(screen.getByText("Famille Bernard")).toBeTruthy();
    expect(screen.getByText("2 650,50 €")).toBeTruthy();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole("button", { name: "Générer 6 comptes rendus" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/comptes-rendus?onglet=generes");
    });
    expect(await screen.findByText("6 comptes rendus générés")).toBeTruthy();
    const overview = overviewSchema.parse(await source.comptesRendus.list());
    const november = overview.rows.filter((row) => row.periodKey === "2026-11");
    expect(november).toHaveLength(6);
    expect(november.every((row) => row.state === "genere")).toBe(true);
  });

  it("met à jour le récapitulatif quand on décoche un mandant ou la case quittances", async () => {
    renderScreen(<GenerationPage />, fakeSource());
    await screen.findByRole("button", { name: "Générer 6 comptes rendus" });
    await userEvent.click(screen.getByRole("checkbox", { name: /Famille Bernard/ }));
    expect(screen.getByRole("button", { name: "Générer 5 comptes rendus" })).toBeTruthy();
    const recap = screen.getByRole("region", { name: "Récapitulatif" });
    expect(within(recap).getByText("8 453,70 €")).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: /Quittances jointes/ }));
    expect(within(recap).getAllByText("0").length).toBeGreaterThan(0);
  });

  it("refuse une sélection vide et une période incohérente", async () => {
    renderScreen(<GenerationPage />, fakeSource());
    await screen.findByRole("button", { name: "Générer 6 comptes rendus" });
    await userEvent.click(screen.getByRole("radio", { name: "Personnalisé" }));
    const to = screen.getByLabelText("Au *");
    await userEvent.clear(to);
    await userEvent.type(to, "2026-10-01");
    for (const name of ["Marc Chevalier", "Famille Bernard", "Hélène Roussel", "SCI Les Acacias", "Paul Lemoine", "Nadia Benali"]) {
      await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(name) }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Générer 0 compte rendu" }));
    expect(await screen.findByText("Sélectionnez au moins un mandant.")).toBeTruthy();
    expect(screen.getByText("La date de fin doit suivre la date de début.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("enregistre un brouillon et publie immédiatement si demandé", async () => {
    const { source } = renderScreen(<GenerationPage />, fakeSource());
    await screen.findByRole("button", { name: "Générer 6 comptes rendus" });
    await userEvent.click(screen.getByRole("checkbox", { name: /Famille Bernard/ }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/comptes-rendus");
    });
    expect(await screen.findByText("Brouillon enregistré")).toBeTruthy();
    const afterDraft = overviewSchema.parse(await source.comptesRendus.list());
    expect(afterDraft.rows.filter((row) => row.periodKey === "2026-11" && row.state === "brouillon")).toHaveLength(5);
    await userEvent.click(screen.getByRole("radio", { name: /Publier maintenant/ }));
    await userEvent.click(screen.getByRole("button", { name: "Générer 5 comptes rendus" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenLastCalledWith("/comptes-rendus?onglet=envoyes");
    });
    const afterPublish = overviewSchema.parse(await source.comptesRendus.list());
    expect(afterPublish.rows.filter((row) => row.periodKey === "2026-11" && row.state === "publie")).toHaveLength(5);
    expect(afterPublish.lastSend).toMatchObject({ on: "2026-11-13", count: 5, unknownReads: true });
  });

  it("calcule un trimestre à partir des mois disponibles", async () => {
    renderScreen(<GenerationPage />, fakeSource());
    await screen.findByRole("button", { name: "Générer 6 comptes rendus" });
    await userEvent.click(screen.getByRole("radio", { name: "Trimestriel" }));
    expect(screen.getByLabelText<HTMLInputElement>("Du *").value).toBe("2026-10-01");
    expect(screen.getByLabelText<HTMLInputElement>("Au *").value).toBe("2026-12-31");
    expect(await screen.findByRole("button", { name: "Générer 6 comptes rendus" })).toBeTruthy();
    const recap = screen.getByRole("region", { name: "Récapitulatif" });
    expect(await within(recap).findByText("23 380,20 €")).toBeTruthy();
    expect(within(recap).getAllByText("14")).toHaveLength(2);
  });
});

describe("serveur de démonstration des comptes rendus", () => {
  const request: GenerateRequest = { kind: "mensuel", from: "2026-11-01", to: "2026-11-30", mandantIds: ["marc-chevalier"], content: ["loyers"], publication: "planifiee", notify: true, draft: false };

  it("est idempotent : régénérer remplace au lieu de dupliquer", async () => {
    const { comptesRendus } = fakeSource();
    await comptesRendus.generate(request);
    await comptesRendus.generate(request);
    const overview = overviewSchema.parse(await comptesRendus.list());
    expect(overview.rows.filter((row) => row.id === "marc-chevalier-2026-11")).toHaveLength(1);
    expect(overview.rows.filter((row) => row.periodKey === "2026-11")).toHaveLength(6);
  });

  it("refuse les mandants sans encaissement, les mois multiples en mensuel et les republications", async () => {
    const { comptesRendus } = fakeSource();
    await expect(comptesRendus.generate({ ...request, mandantIds: ["inconnu"] })).rejects.toMatchObject({ code: "validation" });
    await expect(comptesRendus.generate({ ...request, to: "2026-12-31" })).rejects.toMatchObject({ fieldErrors: { to: "Un compte rendu mensuel couvre un seul mois." } });
    await expect(comptesRendus.generate({ ...request, mandantIds: [] })).rejects.toMatchObject({ fieldErrors: { mandantIds: "Sélectionnez au moins un mandant." } });
    await comptesRendus.generate(request);
    await comptesRendus.publish("marc-chevalier-2026-11");
    await expect(comptesRendus.generate(request)).rejects.toMatchObject({ code: "validation" });
    await expect(comptesRendus.publish("marc-chevalier-2026-11")).rejects.toMatchObject({ code: "already_published" });
    await expect(comptesRendus.publish("famille-bernard-2026-11")).rejects.toMatchObject({ code: "not_found" });
    await expect(comptesRendus.setOptions({ id: "marc-chevalier-2026-11", receiptsAttached: false, letterhead: true, reminderDetail: false })).rejects.toMatchObject({ code: "locked" });
  });

  it("n'invente pas de chiffres quand finances ne connaît pas la période", async () => {
    const { comptesRendus } = fakeSource(() => Promise.resolve([]));
    const overview = overviewSchema.parse(await comptesRendus.list());
    expect(overview.rows.filter((row) => row.periodKey === "2026-11")).toHaveLength(0);
    await expect(comptesRendus.generate(request)).rejects.toMatchObject({ fieldErrors: { mandantIds: "Aucun encaissement pour Marc Chevalier sur cette période." } });
    expect(await comptesRendus.get("marc-chevalier-2026-11")).toBeNull();
  });
});
