import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation, router } from "../../../../test/navigation";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, renderPortefeuille } from "../testing";
import { MandantDetailPage } from "./MandantDetailPage";
import { MandantFormPage } from "./MandantFormPage";
import { MandantsPage } from "./MandantsPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("liste des mandants", () => {
  it("affiche les mandants et leurs mandats", async () => {
    const { container } = renderPortefeuille(<MandantsPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mandants" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Liste des mandants" });
    expect(within(table).getByText("Marc Chevalier")).toBeTruthy();
    expect(within(table).getByText("SCI Les Acacias")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("annonce le chargement puis l'erreur de la source", async () => {
    renderPortefeuille(<MandantsPage />, failingSource());
    expect(screen.getByRole("status", { name: /Chargement/ })).toBeTruthy();
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });

  it("filtre par recherche et signale l'absence de résultat", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<MandantsPage />);
    const search = await screen.findByRole("searchbox", { name: "Rechercher un mandant" });
    await user.type(search, "chevalier");
    const table = screen.getByRole("table", { name: "Liste des mandants" });
    expect(within(table).getByText("Marc Chevalier")).toBeTruthy();
    expect(within(table).queryByText("Famille Bernard")).toBeNull();
    await user.clear(search);
    await user.type(search, "zzzz");
    expect(screen.getByText(/Aucun mandant/i)).toBeTruthy();
  });

  it("limite la liste aux mandats à renouveler", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<MandantsPage />);
    await user.click(await screen.findByRole("tab", { name: /À renouveler/ }));
    const table = screen.getByRole("table", { name: "Liste des mandants" });
    expect(within(table).getByText("Hélène Roussel")).toBeTruthy();
    expect(within(table).getByText("Paul Lemoine")).toBeTruthy();
    expect(within(table).queryByText("Marc Chevalier")).toBeNull();
  });
});

describe("fiche mandant", () => {
  it("présente le mandant, ses lots et son mandat", async () => {
    const { container } = renderPortefeuille(<MandantDetailPage id="marc-chevalier" />);
    expect(await screen.findByRole("heading", { level: 1, name: /Marc Chevalier/ })).toBeTruthy();
    expect(screen.getAllByText(/Apt 12/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/M-2025-0142/).length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("signale un mandant introuvable", async () => {
    renderPortefeuille(<MandantDetailPage id="inconnu" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mandant introuvable" })).toBeTruthy();
  });

  it("modifie les coordonnées dans les données", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<MandantDetailPage id="marc-chevalier" />);
    const edit = (await screen.findAllByRole("button", { name: "Modifier" }))[0];
    if (!edit) throw new Error("Bouton Modifier absent");
    await user.click(edit);
    const dialog = await screen.findByRole("dialog");
    const email = within(dialog).getByRole("textbox", { name: /E-mail/ });
    await user.clear(email);
    await user.type(email, "pas-un-email");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/adresse e-mail valide/)).toBeTruthy();
    await user.clear(email);
    await user.type(email, "marc.nouveau@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      const data = parsePortefeuille(await source.load());
      expect(data.mandants.find((item) => item.id === "marc-chevalier")?.email).toBe("marc.nouveau@example.com");
    });
    expect(await screen.findByText("marc.nouveau@example.com")).toBeTruthy();
  });
});

describe("nouveau mandant", () => {
  it("signale les champs obligatoires sans rien créer", async () => {
    const user = userEvent.setup();
    const { source, container } = renderPortefeuille(<MandantFormPage />);
    await user.click(await screen.findByRole("button", { name: "Enregistrer le mandant" }));
    expect(await screen.findByText("Indiquez le prénom.")).toBeTruthy();
    expect(screen.getByText("Indiquez le nom.")).toBeTruthy();
    expect(screen.getByText("Indiquez le titulaire du compte.")).toBeTruthy();
    expect(screen.getByText(/Cet IBAN n'est pas valide/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(parsePortefeuille(await source.load()).mandants).toHaveLength(6);
    await expectNoA11yViolations(container);
  });

  it("crée le mandant et ouvre sa fiche", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<MandantFormPage />, source);
    await user.type(await screen.findByRole("textbox", { name: /Prénom/ }), "Claire");
    await user.type(screen.getByRole("textbox", { name: /^Nom/ }), "Vasseur");
    await user.type(screen.getByRole("textbox", { name: /E-mail/ }), "claire.vasseur@example.com");
    await user.type(screen.getByRole("textbox", { name: /Titulaire du compte/ }), "Claire Vasseur");
    await user.type(screen.getByRole("textbox", { name: /IBAN/ }), "FR76 3000 6000 0112 3456 7890 189");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mandant" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mandants/claire-vasseur"); });
    const data = parsePortefeuille(await source.load());
    const created = data.mandants.find((item) => item.id === "claire-vasseur");
    expect(created?.name).toBe("Claire Vasseur");
    expect(created?.ibanLast4).toBe("0189");
  });

  it("enchaîne vers le mandat avec « Enregistrer et créer le mandat »", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<MandantFormPage />);
    await user.type(await screen.findByRole("textbox", { name: /Prénom/ }), "Claire");
    await user.type(screen.getByRole("textbox", { name: /^Nom/ }), "Vasseur");
    await user.type(screen.getByRole("textbox", { name: /E-mail/ }), "claire.vasseur@example.com");
    await user.type(screen.getByRole("textbox", { name: /Titulaire du compte/ }), "Claire Vasseur");
    await user.type(screen.getByRole("textbox", { name: /IBAN/ }), "FR76 3000 6000 0112 3456 7890 189");
    await user.click(screen.getByRole("button", { name: "Enregistrer et créer le mandat" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mandats/nouveau?mandant=claire-vasseur"); });
  });

  it("affiche l'échec de la source sans naviguer", async () => {
    const user = userEvent.setup();
    const source = { ...createDemoSource(), createMandant: () => Promise.reject(new Error("Écriture refusée")) };
    renderPortefeuille(<MandantFormPage />, source);
    await user.type(await screen.findByRole("textbox", { name: /Prénom/ }), "Claire");
    await user.type(screen.getByRole("textbox", { name: /^Nom/ }), "Vasseur");
    await user.type(screen.getByRole("textbox", { name: /E-mail/ }), "claire.vasseur@example.com");
    await user.type(screen.getByRole("textbox", { name: /Titulaire du compte/ }), "Claire Vasseur");
    await user.type(screen.getByRole("textbox", { name: /IBAN/ }), "FR76 3000 6000 0112 3456 7890 189");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mandant" }));
    expect(await screen.findByText("Écriture refusée")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
