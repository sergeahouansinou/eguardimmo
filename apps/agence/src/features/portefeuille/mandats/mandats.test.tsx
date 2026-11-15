import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation, router } from "../../../../test/navigation";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, renderPortefeuille } from "../testing";
import { MandatDetailPage } from "./MandatDetailPage";
import { MandatFormPage } from "./MandatFormPage";
import { MandatsPage } from "./MandatsPage";
import { MandatTerminationPage } from "./MandatTerminationPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("liste des mandats", () => {
  it("affiche les mandats actifs par défaut", async () => {
    const { container } = renderPortefeuille(<MandatsPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mandats" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Liste des mandats" });
    expect(within(table).getByText("M-2025-0142")).toBeTruthy();
    expect(within(table).queryByText("M-2021-0044")).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("montre les mandats terminés dans leur onglet", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<MandatsPage />);
    await user.click(await screen.findByRole("tab", { name: /Terminés/ }));
    const table = screen.getByRole("table", { name: "Liste des mandats" });
    expect(within(table).getByText("M-2021-0044")).toBeTruthy();
    expect(within(table).queryByText("M-2025-0142")).toBeNull();
  });

  it("annonce l'état vide quand la recherche ne trouve rien", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<MandatsPage />);
    await user.type(await screen.findByRole("searchbox", { name: "Rechercher un mandat" }), "zzzz");
    expect(screen.queryByRole("table", { name: "Liste des mandats" })).toBeNull();
    expect(screen.getByText(/Aucun mandat/i)).toBeTruthy();
  });

  it("n'affiche l'onglet Brouillons qu'à partir d'un brouillon", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    const first = renderPortefeuille(<MandatsPage />, source);
    await screen.findByRole("tab", { name: /Actifs/ });
    expect(screen.queryByRole("tab", { name: /Brouillons/ })).toBeNull();
    first.unmount();
    const draft = await source.createMandat({
      mandantId: "marc-chevalier",
      lots: [{ name: "Apt 8", kind: "T3", surfaceM2: 40, street: "40 rue de Brest", postalCode: "69002", city: "Lyon" }],
      feeBasisPoints: 700,
      payoutDay: 5,
      worksLimitMinor: 50_000,
      renewal: "aucune",
      startIso: "2026-12-01",
      endIso: "2029-11-30",
      signed: false,
    });
    renderPortefeuille(<MandatsPage />, source);
    await user.click(await screen.findByRole("tab", { name: /Brouillons/ }));
    expect(within(screen.getByRole("table", { name: "Liste des mandats" })).getByText(draft.number)).toBeTruthy();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<MandatsPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});

describe("fiche mandat", () => {
  it("présente les conditions du mandat", async () => {
    const { container } = renderPortefeuille(<MandatDetailPage id="m-2025-0142" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mandat M-2025-0142" })).toBeTruthy();
    expect(screen.getByText("Conditions du mandat")).toBeTruthy();
    expect(screen.getAllByText(/7 %/).length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("signale un mandat introuvable", async () => {
    renderPortefeuille(<MandatDetailPage id="inconnu" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mandat introuvable" })).toBeTruthy();
  });

  it("renouvelle un mandat à renouveler après confirmation", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<MandatDetailPage id="m-2023-0071" />);
    await user.click(await screen.findByRole("button", { name: "Autres actions pour le mandat M-2023-0071" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renouveler le mandat" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Renouveler le mandat" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).mandats.find((item) => item.id === "m-2023-0071")?.endIso).toBe("2029-12-31");
    });
    expect(await screen.findByText(/renouvelé/)).toBeTruthy();
  });

  it("modifie le jour de reversement et refuse une valeur invalide", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<MandatDetailPage id="m-2025-0142" />);
    await user.click((await screen.findAllByRole("button", { name: "Modifier" }))[0] ?? document.body);
    const dialog = await screen.findByRole("dialog");
    const day = within(dialog).getByRole("textbox", { name: /Jour de reversement/ });
    await user.clear(day);
    await user.type(day, "40");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/entre 1 et 28/)).toBeTruthy();
    await user.clear(day);
    await user.type(day, "12");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).mandats.find((item) => item.id === "m-2025-0142")?.payoutDay).toBe(12);
    });
  });
});

describe("nouveau mandat", () => {
  async function fillLot(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByRole("textbox", { name: /Nom du lot/ }), "Apt 8");
    await user.type(screen.getByRole("textbox", { name: /^Type/ }), "T3");
    await user.type(screen.getByRole("textbox", { name: /Surface/ }), "40");
    await user.type(screen.getByRole("textbox", { name: /Adresse/ }), "40 rue de Brest");
    await user.type(screen.getByRole("textbox", { name: /Code postal/ }), "69002");
    await user.type(screen.getByRole("textbox", { name: /Ville/ }), "Lyon");
    await user.type(screen.getByLabelText(/Prise d'effet/), "2026-12-01");
    await user.type(screen.getByLabelText(/Échéance/), "2029-11-30");
  }

  it("signale les champs obligatoires", async () => {
    const user = userEvent.setup();
    const { container } = renderPortefeuille(<MandatFormPage />);
    await user.click(await screen.findByRole("button", { name: "Créer le mandat" }));
    expect(await screen.findByText("Choisissez le mandant.")).toBeTruthy();
    expect(screen.getByText("Nommez le lot, par exemple Apt 8.")).toBeTruthy();
    expect(screen.getByText("Indiquez la date de prise d'effet.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("enregistre un brouillon sans mandat signé", async () => {
    const user = userEvent.setup();
    resetNavigation("mandant=marc-chevalier");
    const source = createDemoSource();
    renderPortefeuille(<MandatFormPage />, source);
    await fillLot(user);
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledTimes(1); });
    const data = parsePortefeuille(await source.load());
    const created = data.mandats.find((item) => item.status === "brouillon");
    expect(created?.mandantId).toBe("marc-chevalier");
    expect(data.biens.some((bien) => bien.id === "apt-8" && bien.mandatId === created?.id)).toBe(true);
  });

  it("exige le mandat signé pour créer un mandat actif", async () => {
    const user = userEvent.setup();
    resetNavigation("mandant=marc-chevalier");
    const source = createDemoSource();
    renderPortefeuille(<MandatFormPage />, source);
    await fillLot(user);
    await user.click(screen.getByRole("button", { name: "Créer le mandat" }));
    expect(await screen.findByText(/Joignez le mandat signé/)).toBeTruthy();
    expect(parsePortefeuille(await source.load()).mandats).toHaveLength(9);
    await user.upload(screen.getByLabelText("Joindre le mandat signé"), new File(["%PDF"], "mandat.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Créer le mandat" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledTimes(1); });
    expect(parsePortefeuille(await source.load()).mandats.filter((item) => item.status === "actif")).toHaveLength(5);
  });

  it("refuse un nom de lot déjà utilisé", async () => {
    const user = userEvent.setup();
    resetNavigation("mandant=marc-chevalier");
    renderPortefeuille(<MandatFormPage />);
    await fillLot(user);
    const name = screen.getByRole("textbox", { name: /Nom du lot/ });
    await user.clear(name);
    await user.type(name, "Apt 12");
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    expect(await screen.findByText(/existe déjà/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("fin de mandat", () => {
  it("impose le préavis de 3 mois", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    const { container } = renderPortefeuille(<MandatTerminationPage id="m-2025-0142" />, source);
    expect(await screen.findByRole("heading", { level: 1, name: "Mettre fin au mandat M-2025-0142" })).toBeTruthy();
    await user.type(screen.getByLabelText(/Date d'effet/), "2027-01-01");
    await user.click(screen.getByRole("button", { name: "Mettre fin au mandat" }));
    expect(await screen.findByText(/Le préavis est de 3 mois/)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(parsePortefeuille(await source.load()).mandats.find((item) => item.id === "m-2025-0142")?.termination).toBeUndefined();
    await expectNoA11yViolations(container);
  });

  it("demande confirmation puis programme la fin du mandat", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<MandatTerminationPage id="m-2025-0142" />, source);
    await user.type(await screen.findByLabelText(/Date d'effet/), "2027-02-13");
    await user.click(screen.getByRole("button", { name: "Mettre fin au mandat" }));
    const dialog = await screen.findByRole("dialog");
    expect(parsePortefeuille(await source.load()).mandats.find((item) => item.id === "m-2025-0142")?.termination).toBeUndefined();
    await user.click(within(dialog).getByRole("button", { name: "Confirmer la fin du mandat" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mandats/m-2025-0142"); });
    const termination = parsePortefeuille(await source.load()).mandats.find((item) => item.id === "m-2025-0142")?.termination;
    expect(termination?.effectIso).toBe("2027-02-13");
    expect(termination?.noticeIso).toBe("2026-11-13");
  });

  it("refuse un mandat déjà terminé ou introuvable", async () => {
    renderPortefeuille(<MandatTerminationPage id="m-2021-0044" />);
    expect(await screen.findByText(/ne peut pas être résilié/)).toBeTruthy();
  });

  it("signale un mandat introuvable", async () => {
    renderPortefeuille(<MandatTerminationPage id="inconnu" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mandat introuvable" })).toBeTruthy();
  });
});
