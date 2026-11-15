import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";
import { equipeOverviewSchema } from "@/features/equipe/schemas";
import { createDemoSource } from "@/features/source";
import { SubscriptionPage } from "./SubscriptionPage";
import { subscriptionSchema } from "./subscriptionSchemas";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

async function plan(name: string): Promise<HTMLElement> {
  return screen.findByRole("region", { name: `Formule ${name}` });
}

describe("Abonnement", () => {
  it("reproduit l'essai gratuit, les formules et l'utilisation de la maquette", async () => {
    const { container } = renderScreen(<SubscriptionPage />);
    expect(await screen.findByText("Formule Agence, essai d'un mois")).toBeTruthy();
    expect(screen.getByText("Du 29/10/2026 au 28/11/2026 · 15 jours restants")).toBeTruthy();
    expect(screen.getByRole("img", { name: "15 jours sur 30 écoulés" })).toBeTruthy();
    expect(screen.getByText("Aucun moyen de paiement enregistré")).toBeTruthy();
    expect(
      screen.getByText("Ajoutez-en un avant le 28/11/2026 pour poursuivre après l'essai. Premier prélèvement : 39,00 € HT le 29/11/2026."),
    ).toBeTruthy();
    expect(within(await plan("Agence")).getByText("Essai en cours")).toBeTruthy();
    expect(within(await plan("Agence")).getByText("39 €")).toBeTruthy();
    expect(within(await plan("Agence")).getByText("20 lots")).toBeTruthy();
    expect(within(await plan("Agence Pro")).getByText("79 €")).toBeTruthy();
    expect(within(await plan("Réseau")).getByText("Sur devis")).toBeTruthy();
    expect(within(await plan("Réseau")).getByRole("link", { name: "Nous contacter" }).getAttribute("href")).toMatch(/^mailto:/);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Formule de l'essai" }).disabled).toBe(true);
    const usage = screen.getByRole("region", { name: "Utilisation" });
    expect(within(usage).getByText("14 / 20")).toBeTruthy();
    expect(within(usage).getByText("4 / 5")).toBeTruthy();
    expect(within(usage).getByText("0,8 Go / 5 Go")).toBeTruthy();
    expect(within(usage).getByRole("img", { name: "70 % utilisé" })).toBeTruthy();
    expect(within(usage).getByRole("img", { name: "80 % utilisé" })).toBeTruthy();
    expect(within(usage).getByRole("img", { name: "16 % utilisé" })).toBeTruthy();
    expect(screen.getByText("Aucune facture pendant l'essai. La première sera émise le 29/11/2026.")).toBeTruthy();
    expect(screen.getByText("24 avenue de la République, 75011 Paris")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("affiche les prix annuels calculés par le serveur (dix mois facturés)", async () => {
    const user = userEvent.setup();
    renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("radio", { name: "Annuel, 2 mois offerts" }));
    expect(within(await plan("Agence")).getByText("390 €")).toBeTruthy();
    expect(within(await plan("Agence Pro")).getByText("790 €")).toBeTruthy();
  });

  it("passe à Agence Pro après confirmation : prix, places et utilisation suivent", async () => {
    const user = userEvent.setup();
    const { source } = renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("button", { name: "Choisir Agence Pro" }));
    const dialog = await screen.findByRole("dialog", { name: "Choisir la formule Agence Pro ?" });
    expect(within(dialog).getByText("79 € HT par mois")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Choisir Agence Pro" }));
    expect(await screen.findByText("Formule Agence Pro activée")).toBeTruthy();
    expect(await screen.findByText("Formule Agence Pro, essai d'un mois")).toBeTruthy();
    expect(screen.getByText(/Premier prélèvement : 79,00 € HT le 29\/11\/2026/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Utilisation" })).getByText("14 / 100")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Utilisation" })).getByText("4 / 15")).toBeTruthy();
    const team = equipeOverviewSchema.parse(await source.equipe.overview());
    expect(team.seats).toMatchObject({ planName: "Agence Pro", limit: 15 });
  });

  it("facture un an à dix fois le prix mensuel, sans montant envoyé par le client", async () => {
    const source = createDemoSource();
    await source.compte.changePlan({ planId: "agence-pro", period: "yearly" });
    const view = subscriptionSchema.parse(await source.compte.subscription());
    expect(view.firstCharge).toEqual({ date: "2026-11-29", amountMinor: 79000, period: "yearly" });
    await expect(source.compte.changePlan({ planId: "reseau", period: "monthly" })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(source.compte.changePlan({ planId: "agence", period: "monthly", amountMinor: 1 })).resolves.toBeTruthy();
    expect(subscriptionSchema.parse(await source.compte.subscription()).firstCharge.amountMinor).toBe(3900);
  });

  it("refuse de repasser à une formule trop petite pour l'équipe", async () => {
    const source = createDemoSource();
    await source.compte.changePlan({ planId: "agence-pro", period: "monthly" });
    await source.equipe.invite({ firstName: "Thomas", lastName: "Girard", email: "thomas.girard@example.com", role: "comptable", portfolioMode: "all", mandantIds: [], message: "" });
    await expect(source.compte.changePlan({ planId: "agence", period: "monthly" })).rejects.toMatchObject({ code: "seat_limit" });
  });

  it("ajoute un moyen de paiement masqué sans jamais saisir de numéro", async () => {
    const user = userEvent.setup();
    renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("button", { name: "Ajouter une carte" }));
    const dialog = await screen.findByRole("dialog", { name: "Ajouter une carte bancaire" });
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(within(dialog).getByText(/redirigé vers notre prestataire de paiement/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Continuer vers le prestataire" }));
    expect(await screen.findByText("Moyen de paiement ajouté")).toBeTruthy();
    expect(await screen.findByText("Moyen de paiement enregistré")).toBeTruthy();
    expect(screen.getAllByText(/Visa •••• 4242/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Aucun moyen de paiement enregistré")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ajouter un mandat" }));
    await user.click(await screen.findByRole("button", { name: "Continuer vers le prestataire" }));
    expect((await screen.findAllByText(/Mandat SEPA •••• 3031/)).length).toBeGreaterThan(0);
  });

  it("retire un moyen de paiement après confirmation", async () => {
    const user = userEvent.setup();
    renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("button", { name: "Ajouter un moyen de paiement" }));
    await user.click(await screen.findByRole("button", { name: "Continuer vers le prestataire" }));
    await user.click(await screen.findByRole("button", { name: "Retirer Visa •••• 4242" }));
    const confirm = await screen.findByRole("dialog", { name: "Retirer ce moyen de paiement ?" });
    await user.click(within(confirm).getByRole("button", { name: "Retirer" }));
    expect(await screen.findByText("Moyen de paiement retiré")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Aucun moyen de paiement enregistré")).toBeTruthy();
    });
  });

  it("valide puis enregistre la facturation", async () => {
    const user = userEvent.setup();
    renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("button", { name: "Modifier la facturation" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier la facturation" });
    const vat = within(dialog).getByLabelText("N° de TVA *");
    await user.clear(vat);
    await user.type(vat, "12");
    await user.clear(within(dialog).getByLabelText("Société *"));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/Saisissez un numéro de TVA valide/)).toBeTruthy();
    expect(within(dialog).getByText("La société est obligatoire.")).toBeTruthy();
    await user.type(within(dialog).getByLabelText("Société *"), "Delmas Gestion");
    await user.clear(vat);
    await user.type(vat, "fr 40 912345678");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Facturation mise à jour")).toBeTruthy();
    expect(await screen.findByText("Delmas Gestion")).toBeTruthy();
    expect(screen.getByText("FR40912345678")).toBeTruthy();
  });

  it("affiche une erreur quand le chargement échoue", async () => {
    const source = createDemoSource();
    source.compte.subscription = () => Promise.reject(new Error("panne"));
    renderScreen(<SubscriptionPage />, source);
    expect(await screen.findByText("L'abonnement n'a pas pu être chargé")).toBeTruthy();
  });
});
