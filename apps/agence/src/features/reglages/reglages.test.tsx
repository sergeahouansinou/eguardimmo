import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderScreen } from "../../../test/render";
import { resetNavigation } from "../../../test/navigation";
import { createDemoSource } from "@/features/source";
import { FinancesPage } from "./FinancesPage";
import { IdentityPage } from "./IdentityPage";
import { formatPercent } from "./logic";
import { financesSchema, identitySchema } from "./schemas";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

const plain = (text: string) => text.replace(/\u00a0/g, " ");

const identityOf = async (source: ReturnType<typeof createDemoSource>) => identitySchema.parse(await source.reglages.identity());
const financesOf = async (source: ReturnType<typeof createDemoSource>) => financesSchema.parse(await source.reglages.finances());

describe("réglages : identité de l’agence", () => {
  it("affiche l’identité, la carte professionnelle en lecture seule et le menu des réglages", async () => {
    const { container } = renderScreen(<IdentityPage />);
    expect(await screen.findByDisplayValue("Cabinet Delmas Immobilier")).toBeTruthy();
    expect(screen.getByDisplayValue("912 345 675")).toBeTruthy();
    expect(screen.getByDisplayValue("20 000")).toBeTruthy();
    expect(screen.getByDisplayValue("24 avenue de la République")).toBeTruthy();
    expect(screen.getByDisplayValue("75011")).toBeTruthy();
    expect(await screen.findByDisplayValue("CPI 7501 2025 000 048 117")).toBeTruthy();
    expect(screen.getByDisplayValue("30/06/2028")).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Numéro" }).readOnly).toBe(true);
    expect(screen.getByRole("link", { name: "Voir la conformité" }).getAttribute("href")).toBe("/conformite");
    expect(screen.getByRole("link", { name: "Finances et honoraires" }).getAttribute("href")).toBe("/reglages/finances");
    expect(screen.getByRole("link", { name: "Identité de l’agence" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("logo-delmas.png")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("active Enregistrer à la modification et Annuler remet les valeurs", async () => {
    const user = userEvent.setup();
    renderScreen(<IdentityPage />);
    const city = await screen.findByLabelText("Ville *");
    await user.clear(city);
    await user.type(city, "Lyon");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByDisplayValue("Paris")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(true);
  });

  it("enregistre une modification dans les données et prévient", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<IdentityPage />, source);
    const city = await screen.findByLabelText("Ville *");
    await user.clear(city);
    await user.type(city, "Lyon");
    await user.clear(screen.getByLabelText("Capital social (€)"));
    await user.type(screen.getByLabelText("Capital social (€)"), "25 500,50");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Identité de l’agence enregistrée")).toBeTruthy();
    expect(await identityOf(source)).toMatchObject({ city: "Lyon", capitalMinor: 2_550_050, siren: "912345675" });
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(true);
    });
  });

  it("refuse un SIREN invalide, un code postal et un e-mail erronés sans rien enregistrer", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<IdentityPage />, source);
    const siren = await screen.findByLabelText("SIREN *");
    await user.clear(siren);
    await user.type(siren, "912 345 678");
    await user.clear(screen.getByLabelText("Code postal *"));
    await user.type(screen.getByLabelText("Code postal *"), "7501");
    await user.clear(screen.getByLabelText("E-mail de contact *"));
    await user.type(screen.getByLabelText("E-mail de contact *"), "pas-un-email");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Ce SIREN n’est pas valide (clé de contrôle).")).toBeTruthy();
    expect(screen.getByText("Le code postal comporte 5 chiffres.")).toBeTruthy();
    expect(screen.getByText("Saisissez une adresse e-mail valide.")).toBeTruthy();
    expect(await identityOf(source)).toMatchObject({ siren: "912345675", postalCode: "75011" });
  });

  it("remplace le logo par une image valide et refuse un format interdit", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const source = createDemoSource();
    renderScreen(<IdentityPage />, source);
    const input = await screen.findByLabelText("Remplacer le logo");
    await user.upload(input, new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    expect(await screen.findByText(/Format non accepté/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(true);
    await user.upload(input, new File([new Uint8Array(2048)], "../nouveau logo.png", { type: "image/png" }));
    expect(await screen.findByText(/nouveau logo\.png/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      expect((await identityOf(source)).logoName).toBe("nouveau logo.png");
    });
  });

  it("affiche l’erreur de chargement", async () => {
    const source = createDemoSource();
    source.reglages.identity = () => Promise.reject(new Error("panne"));
    renderScreen(<IdentityPage />, source);
    expect(await screen.findByText("Les réglages de l’agence n'a pas pu être chargé")).toBeTruthy();
  });
});

describe("réglages : finances et honoraires", () => {
  it("affiche les honoraires, les reversements et le compte des mandants", async () => {
    const { container } = renderScreen(<FinancesPage />);
    expect(await screen.findByDisplayValue("7")).toBeTruthy();
    expect(screen.getByText(plain(`${formatPercent(700)} TTC correspondent à ${formatPercent(583)} hors taxe`))).toBeTruthy();
    expect(screen.getByDisplayValue("15,00")).toBeTruthy();
    expect(screen.getByDisplayValue("300")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Base de calcul/ }).textContent).toContain("Loyers encaissés");
    expect(screen.getByRole("combobox", { name: /Jour de reversement/ }).textContent).toContain("Le 5 du mois");
    expect(screen.getByRole("combobox", { name: /TVA applicable/ }).textContent).toContain("20 %");
    expect(screen.getByRole<HTMLButtonElement>("switch", { name: "Retenue des honoraires" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("FR76 •••• •••• •••• •••• 1208")).toBeTruthy();
    expect(screen.getByText("Banque du Canal")).toBeTruthy();
    expect(screen.getByText("12/11/2026")).toBeTruthy();
    expect(screen.getByText("Conforme")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("recalcule l’équivalent hors taxe et enregistre en points de base", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<FinancesPage />, source);
    const rate = await screen.findByLabelText("Taux par défaut (% TTC)");
    await user.clear(rate);
    await user.type(rate, "8");
    expect(screen.getByText(plain(`${formatPercent(800)} TTC correspondent à ${formatPercent(667)} hors taxe`))).toBeTruthy();
    await user.clear(screen.getByLabelText("Minimum mensuel par lot (€)"));
    await user.type(screen.getByLabelText("Minimum mensuel par lot (€)"), "18,50");
    await user.click(screen.getByRole("switch", { name: "Retenue des honoraires" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Réglages financiers enregistrés")).toBeTruthy();
    expect(await financesOf(source)).toMatchObject({ feeRateBp: 800, minFeeMinor: 1850, retainFees: false, vatBp: 2000, payoutDay: 5, worksCeilingMinor: 30000 });
  });

  it("enregistre le jour de reversement choisi", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<FinancesPage />, source);
    await user.click(await screen.findByRole("combobox", { name: /Jour de reversement/ }));
    await user.click(await screen.findByRole("option", { name: "Le 10 du mois" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      expect((await financesOf(source)).payoutDay).toBe(10);
    });
  });

  it("refuse un taux illisible ou trop élevé et annule les modifications", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<FinancesPage />, source);
    const rate = await screen.findByLabelText("Taux par défaut (% TTC)");
    await user.clear(rate);
    await user.type(rate, "abc");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Saisissez un taux valide, par exemple 7.")).toBeTruthy();
    await user.clear(rate);
    await user.type(rate, "30");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Le taux doit être compris entre 0,01 % et 25 %.")).toBeTruthy();
    expect((await financesOf(source)).feeRateBp).toBe(700);
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByDisplayValue("7")).toBeTruthy();
  });

  it("refuse un IBAN invalide puis ne conserve que la version masquée d’un IBAN valide", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<FinancesPage />, source);
    await user.click(await screen.findByRole("button", { name: "Modifier le compte" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier le compte des mandants" });
    await user.type(within(dialog).getByLabelText("IBAN"), "FR76 3000 6000 0112 3456 7890 188");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer le compte" }));
    expect(await within(dialog).findByText("Cet IBAN n’est pas valide (IBAN français, clé de contrôle).")).toBeTruthy();
    await user.clear(within(dialog).getByLabelText("IBAN"));
    await user.type(within(dialog).getByLabelText("IBAN"), "FR76 3000 6000 0112 3456 7890 189");
    await user.clear(within(dialog).getByLabelText("Banque"));
    await user.type(within(dialog).getByLabelText("Banque"), "Crédit de l’Ouest");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer le compte" }));
    expect(await screen.findByText("FR76 •••• •••• •••• •••• 0189")).toBeTruthy();
    expect(screen.getByText("Crédit de l’Ouest")).toBeTruthy();
    expect(screen.getByText("À faire")).toBeTruthy();
    const stored = JSON.stringify(await financesOf(source));
    expect(stored).not.toContain("0112");
    expect(stored).not.toContain("3456");
    expect(stored).not.toContain("7890");
    expect(screen.queryByText("Réglages financiers enregistrés")).toBeNull();
  });

  it("affiche l’erreur de chargement", async () => {
    const source = createDemoSource();
    source.reglages.finances = () => Promise.reject(new Error("panne"));
    renderScreen(<FinancesPage />, source);
    expect(await screen.findByText("Les réglages financiers n'a pas pu être chargé")).toBeTruthy();
  });
});
