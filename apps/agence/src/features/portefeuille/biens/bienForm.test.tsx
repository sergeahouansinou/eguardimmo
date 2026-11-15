import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation, router } from "../../../../test/navigation";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, pickOption, renderPortefeuille } from "../testing";
import { BienDetailPage } from "./BienDetailPage";
import { BiensPage } from "./BiensPage";
import { BienFormPage } from "./BienFormPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

type User = ReturnType<typeof userEvent.setup>;

async function fill(user: User, overrides: Partial<Record<"name" | "kind" | "surface" | "street" | "postal" | "city" | "rent" | "charges", string>> = {}) {
  const values = { name: "Apt 8", kind: "T3", surface: "40", street: "40 rue de Brest", postal: "69002", city: "Lyon", rent: "620", charges: "60", ...overrides };
  await user.type(await screen.findByRole("textbox", { name: /Nom du lot/ }), values.name);
  await user.type(screen.getByRole("textbox", { name: /^Type/ }), values.kind);
  await user.type(screen.getByRole("textbox", { name: /Surface/ }), values.surface);
  await user.type(screen.getByRole("textbox", { name: /^Adresse/ }), values.street);
  await user.type(screen.getByRole("textbox", { name: /Code postal/ }), values.postal);
  await user.type(screen.getByRole("textbox", { name: /Ville/ }), values.city);
  await user.type(screen.getByRole("textbox", { name: /Loyer hors charges/ }), values.rent);
  await user.type(screen.getByRole("textbox", { name: /Provisions/ }), values.charges);
}

describe("nouveau bien", () => {
  it("signale les champs obligatoires sans rien créer", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    const { container } = renderPortefeuille(<BienFormPage />, source);
    await user.click(await screen.findByRole("button", { name: "Créer le bien" }));
    expect(await screen.findByText("Choisissez le mandat.")).toBeTruthy();
    expect(screen.getByText("Nommez le lot, par exemple Apt 8.")).toBeTruthy();
    expect(screen.getByText("Indiquez l'adresse, par exemple 40 rue de Brest.")).toBeTruthy();
    expect(screen.getByText(/Le code postal comporte 5 chiffres/)).toBeTruthy();
    expect(screen.getByText(/Saisissez le loyer hors charges visé/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(parsePortefeuille(await source.load()).biens).toHaveLength(14);
    await expectNoA11yViolations(container);
  });

  it("refuse une surface nulle et un loyer nul", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    renderPortefeuille(<BienFormPage />);
    await fill(user, { surface: "0", rent: "0" });
    await user.click(screen.getByRole("button", { name: "Créer le bien" }));
    expect(await screen.findByText("La surface est supérieure à 0 m².")).toBeTruthy();
    expect(screen.getByText("Le loyer est supérieur à 0 €.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("crée le bien sous le mandat choisi et ouvre sa fiche", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<BienFormPage />, source);
    await pickOption(user, /Mandat/, /M-2025-0142, Marc Chevalier/);
    await fill(user);
    await user.type(screen.getByRole("textbox", { name: "Étage" }), "2e sur 4");
    expect(screen.getByText("680 € par mois")).toBeTruthy();
    expect(screen.getByText("47,60 € par mois (7 %)")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Créer le bien" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/biens/apt-8"); });
    const created = parsePortefeuille(await source.load()).biens.find((item) => item.id === "apt-8");
    expect(created).toMatchObject({ name: "Apt 8", kind: "T3", surfaceM2: 40, mandatId: "m-2025-0142", floor: "2e sur 4", targetRentMinor: 62_000, targetChargesMinor: 6_000 });
  });

  it("préremplit le mandat depuis l'adresse et enchaîne sur un bail", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2024-0058");
    const source = createDemoSource();
    renderPortefeuille(<BienFormPage />, source);
    expect((await screen.findByRole("combobox", { name: /Mandat/ })).textContent).toContain("M-2024-0058, Famille Bernard");
    await fill(user, { name: "Apt 10", rent: "900", charges: "80,50" });
    await user.click(screen.getByRole("button", { name: "Créer et ajouter un bail" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/baux/nouveau?bien=apt-10"); });
    expect(parsePortefeuille(await source.load()).biens.find((item) => item.id === "apt-10")?.targetChargesMinor).toBe(8_050);
  });

  it("n'accepte pas un mandat terminé dans la liste", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BienFormPage />);
    await user.click(await screen.findByRole("combobox", { name: /Mandat/ }));
    const list = await screen.findByRole("listbox", { name: /Mandat/ });
    expect(within(list).getAllByRole("option")).toHaveLength(6);
    expect(within(list).queryByText(/M-2021-0044/)).toBeNull();
  });

  it("signale un nom de lot déjà utilisé", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    renderPortefeuille(<BienFormPage />);
    await fill(user, { name: "Apt 12" });
    await user.click(screen.getByRole("button", { name: "Créer le bien" }));
    expect(await screen.findByText(/Un lot nommé « Apt 12 » existe déjà/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("affiche l'échec de la source sans naviguer", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = { ...createDemoSource(), createBien: () => Promise.reject(new Error("Écriture refusée")) };
    renderPortefeuille(<BienFormPage />, source);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Créer le bien" }));
    expect(await screen.findByText("Écriture refusée")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<BienFormPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });

  it("fait apparaître le lot créé comme vacant dans la liste des biens", async () => {
    const source = createDemoSource();
    await source.createBien({
      mandatId: "m-2025-0142",
      name: "Apt 8",
      kind: "T3",
      surfaceM2: 40,
      street: "40 rue de Brest",
      postalCode: "69002",
      city: "Lyon",
      floor: "",
      dpe: "",
      heating: "",
      syndic: "",
      propertyTax: "",
      targetRentMinor: 62_000,
      targetChargesMinor: 6_000,
    });
    renderPortefeuille(<BiensPage />, source);
    const table = await screen.findByRole("table", { name: "Liste des biens sous mandat" });
    const row = within(table).getByText("Apt 8").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Vacant")).toBeTruthy();
    expect(screen.getByText("14 loués, 1 vacant")).toBeTruthy();
  });

  it("met à jour le récapitulatif au fil de la saisie", async () => {
    renderPortefeuille(<BienFormPage />);
    const recap = await screen.findByRole("group", { name: "Récapitulatif" });
    expect(within(recap).getAllByText("—").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("textbox", { name: /Nom du lot/ }), { target: { value: "Cave 8" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Ville/ }), { target: { value: "Lyon" } });
    expect(within(recap).getByText("Cave 8")).toBeTruthy();
    expect(within(recap).getByText("Lyon")).toBeTruthy();
  });

  it("ouvre la fiche du lot créé avec son loyer visé et un lien vers le bail", async () => {
    const source = createDemoSource();
    await source.createBien({
      mandatId: "m-2025-0142",
      name: "Apt 8",
      kind: "T3",
      surfaceM2: 40,
      street: "40 rue de Brest",
      postalCode: "69002",
      city: "Lyon",
      floor: "",
      dpe: "",
      heating: "",
      syndic: "",
      propertyTax: "",
      targetRentMinor: 62_000,
      targetChargesMinor: 6_000,
    });
    renderPortefeuille(<BienDetailPage id="apt-8" />, source);
    expect(await screen.findByRole("heading", { level: 1, name: "Apt 8" })).toBeTruthy();
    expect(screen.getByText("loyer visé, aucun bail en cours")).toBeTruthy();
    expect(screen.getByText("680,00 €")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Créer un bail" }).getAttribute("href")).toBe("/baux/nouveau?bien=apt-8");
  });
});
