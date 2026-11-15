import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation, router } from "../../../../test/navigation";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, renderPortefeuille } from "../testing";
import { BailDetailPage } from "./BailDetailPage";
import { BailFormPage } from "./BailFormPage";
import { BauxPage } from "./BauxPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("liste des baux", () => {
  it("affiche les baux en cours avec leurs indicateurs", async () => {
    const { container } = renderPortefeuille(<BauxPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Baux" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Liste des baux" });
    expect(within(table).getByText("B-2024-018")).toBeTruthy();
    expect(within(table).queryByText("B-2021-011")).toBeNull();
    expect(screen.getByText("13 850 €")).toBeTruthy();
    expect(screen.getByText("10 vides, 4 meublés")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("alerte sur les préavis et filtre au clic", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BauxPage />);
    expect(await screen.findByText(/Léa Vidal \(Apt 6\) quitte le lot le 31\/01\/2027/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Voir les préavis" }));
    const table = screen.getByRole("table", { name: "Liste des baux" });
    expect(within(table).getByText("B-2024-003")).toBeTruthy();
    expect(within(table).queryByText("B-2024-018")).toBeNull();
  });

  it("sépare terminés et brouillons", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BauxPage />);
    await user.click(await screen.findByRole("tab", { name: /Terminés/ }));
    expect(within(screen.getByRole("table", { name: "Liste des baux" })).getByText("B-2021-011")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /Brouillons/ }));
    const table = screen.getByRole("table", { name: "Liste des baux" });
    expect(within(table).getByText("B-2026-022")).toBeTruthy();
    expect(within(table).queryByText("B-2021-011")).toBeNull();
  });

  it("annonce l'état vide d'un onglet sans bail à venir", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BauxPage />);
    await user.click(await screen.findByRole("tab", { name: /À venir/ }));
    expect(screen.getByText("Aucun bail à venir")).toBeTruthy();
  });

  it("recherche par locataire et signale l'absence de résultat", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BauxPage />);
    const search = await screen.findByRole("searchbox", { name: "Rechercher un bail" });
    await user.type(search, "roux");
    const table = screen.getByRole("table", { name: "Liste des baux" });
    expect(within(table).getByText("B-2026-007")).toBeTruthy();
    expect(within(table).queryByText("B-2024-018")).toBeNull();
    await user.clear(search);
    await user.type(search, "zzzz");
    expect(screen.getByText("Aucun bail en cours")).toBeTruthy();
  });

  it("exporte la liste filtrée en CSV", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:demo");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    renderPortefeuille(<BauxPage />);
    await user.click(await screen.findByRole("button", { name: "Exporter" }));
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toContain("text/csv");
    const text = await blob?.text();
    expect(text).toContain("B-2024-018");
    expect(text).not.toContain("B-2021-011");
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<BauxPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});

describe("fiche bail", () => {
  it("présente les conditions et les montants du bail", async () => {
    const { container } = renderPortefeuille(<BailDetailPage id="b-2024-018" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Bail B-2024-018" })).toBeTruthy();
    expect(screen.getByText("700 € par mois")).toBeTruthy();
    expect(screen.getByText("Conditions du bail")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Émettre l'avis d'échéance" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("alerte sur un impayé et liste les échéances", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BailDetailPage id="b-2026-007" />);
    expect(await screen.findByText(/Loyer impayé depuis le 01\/11\/2026/)).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /Échéances/ }));
    const table = within(screen.getByRole("tabpanel")).getByRole("table", { name: "Échéances du bail" });
    expect(within(table).getByText("Novembre 2026")).toBeTruthy();
    expect(within(table).getAllByText("Impayé")).toHaveLength(1);
    expect(within(table).getAllByText("Payé")).toHaveLength(7);
  });

  it("traite un brouillon sans échéance ni avis", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BailDetailPage id="b-2026-022" />);
    expect(await screen.findByText("Bail en brouillon")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Émettre l'avis d'échéance" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: /Échéances/ }));
    expect(screen.getByText("Aucune échéance appelée pour le moment.")).toBeTruthy();
  });

  it("signale un bail introuvable", async () => {
    renderPortefeuille(<BailDetailPage id="inconnu" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Bail introuvable" })).toBeTruthy();
  });

  it("enregistre un préavis après confirmation", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<BailDetailPage id="b-2024-018" />);
    await user.click(await screen.findByRole("button", { name: "Autres actions pour le bail B-2024-018" }));
    await user.click(await screen.findByRole("menuitem", { name: "Enregistrer un préavis" }));
    const dialog = await screen.findByRole("dialog");
    expect(parsePortefeuille(await source.load()).baux.find((item) => item.id === "b-2024-018")?.noticeGiven).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer le préavis" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).baux.find((item) => item.id === "b-2024-018")?.noticeGiven).toBe(true);
    });
    expect(await screen.findByText(/Préavis donné, départ le 31\/08\/2027/)).toBeTruthy();
  });

  it("modifie le jour d'échéance et refuse une valeur invalide", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<BailDetailPage id="b-2024-018" />);
    await user.click((await screen.findAllByRole("button", { name: "Modifier" }))[0] ?? document.body);
    const dialog = await screen.findByRole("dialog");
    const day = within(dialog).getByRole("textbox", { name: "Jour d'échéance" });
    await user.clear(day);
    await user.type(day, "31");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/entre 1 et 28/)).toBeTruthy();
    await user.clear(day);
    await user.type(day, "10");
    await user.type(within(dialog).getByRole("textbox", { name: "Note interne" }), "Virement permanent");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      const bail = parsePortefeuille(await source.load()).baux.find((item) => item.id === "b-2024-018");
      expect(bail?.dueDay).toBe(10);
      expect(bail?.note).toBe("Virement permanent");
    });
  });
});

describe("nouveau bail", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, start: string, rent: string, deposit: string) {
    await user.type(await screen.findByLabelText(/Date de début/), start);
    await user.type(screen.getByRole("textbox", { name: /Loyer hors charges/ }), rent);
    await user.type(screen.getByRole("textbox", { name: /Provisions/ }), "60");
    await user.type(screen.getByRole("textbox", { name: /Dépôt de garantie/ }), deposit);
  }

  it("signale les champs obligatoires", async () => {
    const user = userEvent.setup();
    const { container } = renderPortefeuille(<BailFormPage />);
    await user.click(await screen.findByRole("button", { name: "Créer le bail" }));
    expect(await screen.findByText("Choisissez le lot.")).toBeTruthy();
    expect(screen.getByText("Choisissez le locataire.")).toBeTruthy();
    expect(screen.getByText("Indiquez la date de début.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("refuse un lot occupé à la date de début", async () => {
    const user = userEvent.setup();
    resetNavigation("bien=apt-12&locataire=chloe-martin");
    const source = createDemoSource();
    renderPortefeuille(<BailFormPage />, source);
    await fill(user, "2027-08-31", "700", "700");
    await user.click(screen.getByRole("button", { name: "Créer le bail" }));
    expect(await screen.findByText(/Ce lot est occupé jusqu'au 31\/08\/2027. Le bail commence après cette date./, { selector: "p" })).toBeTruthy();
    expect(parsePortefeuille(await source.load()).baux).toHaveLength(24);
  });

  it("plafonne le dépôt de garantie", async () => {
    const user = userEvent.setup();
    resetNavigation("bien=apt-12&locataire=chloe-martin");
    renderPortefeuille(<BailFormPage />);
    await fill(user, "2027-09-01", "700", "900");
    await user.click(screen.getByRole("button", { name: "Créer le bail" }));
    expect(await screen.findByText(/ne dépasse pas 1 mois de loyer/, { selector: "p" })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("crée un bail à venir et ouvre sa fiche", async () => {
    const user = userEvent.setup();
    resetNavigation("bien=apt-12&locataire=chloe-martin");
    const source = createDemoSource();
    renderPortefeuille(<BailFormPage />, source);
    await fill(user, "2027-09-01", "700", "700");
    await user.click(screen.getByRole("button", { name: "Créer le bail" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/baux/b-2026-032"); });
    const created = parsePortefeuille(await source.load()).baux.find((item) => item.id === "b-2026-032");
    expect(created).toMatchObject({ status: "a_venir", rentMinor: 70_000, chargesMinor: 6_000, depositMinor: 70_000, endIso: "2030-08-31", bienId: "apt-12", locataireId: "chloe-martin" });
  });

  it("enregistre un brouillon", async () => {
    const user = userEvent.setup();
    resetNavigation("bien=apt-12&locataire=chloe-martin");
    const source = createDemoSource();
    renderPortefeuille(<BailFormPage />, source);
    await fill(user, "2027-09-01", "700", "700");
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledTimes(1); });
    expect(parsePortefeuille(await source.load()).baux.filter((item) => item.status === "brouillon")).toHaveLength(2);
  });

  it("affiche l'échec de la source sans naviguer", async () => {
    const user = userEvent.setup();
    resetNavigation("bien=apt-12&locataire=chloe-martin");
    const source = { ...createDemoSource(), createBail: () => Promise.reject(new Error("Écriture refusée")) };
    renderPortefeuille(<BailFormPage />, source);
    await fill(user, "2027-09-01", "700", "700");
    await user.click(screen.getByRole("button", { name: "Créer le bail" }));
    expect(await screen.findByText("Écriture refusée")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
