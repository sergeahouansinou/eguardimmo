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
  it("affiche l'essai complet, les formules de l'ADR et l'utilisation", async () => {
    const { container } = renderScreen(<SubscriptionPage />);
    expect(await screen.findByText("Formule Gratuit, essai complet de 15 jours")).toBeTruthy();
    expect(screen.getByText("Du 05/11/2026 au 20/11/2026 · 7 jours restants")).toBeTruthy();
    expect(screen.getByRole("img", { name: "8 jours sur 15 écoulés" })).toBeTruthy();
    expect(screen.getByText("Aucun moyen de paiement enregistré")).toBeTruthy();
    expect(
      screen.getByText("Ajoutez-en un avant le 20/11/2026 pour souscrire une formule payante. Sans souscription, l'organisation repasse en Gratuit à la fin de l'essai."),
    ).toBeTruthy();
    expect(within(await plan("Gratuit")).getByText("Essai en cours")).toBeTruthy();
    expect(within(await plan("Gratuit")).getByText("0 €")).toBeTruthy();
    expect(within(await plan("Gratuit")).getByText("1 lot")).toBeTruthy();
    expect(within(await plan("Silver")).getByText("4,90 €")).toBeTruthy();
    expect(within(await plan("Silver")).getByText("2 à 5 lots")).toBeTruthy();
    expect(within(await plan("Gold")).getByText("10,90 €")).toBeTruthy();
    expect(within(await plan("Gold")).getByText("Lots illimités")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Formule Réseau" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Nous contacter" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Formule de l'essai" }).disabled).toBe(true);
    const usage = screen.getByRole("region", { name: "Utilisation" });
    expect(within(usage).getByText("14 / illimité")).toBeTruthy();
    expect(within(usage).getByText("4 / selon le plan")).toBeTruthy();
    expect(within(usage).getByText("800 Mo / 5 Go")).toBeTruthy();
    expect(within(usage).getByRole("img", { name: "16 % utilisé" })).toBeTruthy();
    expect(screen.getByText("Aucune facture pendant l'essai.")).toBeTruthy();
    expect(screen.getByText("24 avenue de la République, 75011 Paris")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("affiche les prix annuels de l'ADR, sans remise calculée", async () => {
    const user = userEvent.setup();
    renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("radio", { name: "Annuel" }));
    expect(within(await plan("Silver")).getByText("58 €")).toBeTruthy();
    expect(within(await plan("Gold")).getByText("118 €")).toBeTruthy();
  });

  it("passe à Gold après confirmation : prix, places et utilisation suivent", async () => {
    const user = userEvent.setup();
    const { source } = renderScreen(<SubscriptionPage />);
    await user.click(await screen.findByRole("button", { name: "Choisir Gold" }));
    const dialog = await screen.findByRole("dialog", { name: "Choisir la formule Gold ?" });
    expect(within(dialog).getByText("10,90 € HT par mois")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Choisir Gold" }));
    expect(await screen.findByText("Formule Gold activée")).toBeTruthy();
    expect(await screen.findByText("Formule Gold, essai complet de 15 jours")).toBeTruthy();
    expect(screen.getByText(/Premier prélèvement : 10,90 € HT le 21\/11\/2026/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Utilisation" })).getByText("14 / illimité")).toBeTruthy();
    const team = equipeOverviewSchema.parse(await source.equipe.overview());
    expect(team.seats).toMatchObject({ planName: "Gold", limit: null });
  });

  it("facture un an au prix annuel de la grille, sans montant envoyé par le client", async () => {
    const source = createDemoSource();
    await source.compte.changePlan({ planId: "gold", period: "yearly" });
    const view = subscriptionSchema.parse(await source.compte.subscription());
    expect(view.firstCharge).toEqual({ date: "2026-11-21", amountMinor: 11800, period: "yearly" });
    await expect(source.compte.changePlan({ planId: "reseau", period: "monthly" })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(source.compte.changePlan({ planId: "gold", period: "monthly", amountMinor: 1 })).resolves.toBeTruthy();
    expect(subscriptionSchema.parse(await source.compte.subscription()).firstCharge.amountMinor).toBe(1090);
  });

  it("refuse de repasser à une formule trop petite pour l'équipe ou le portefeuille", async () => {
    const source = createDemoSource();
    await expect(source.compte.changePlan({ planId: "silver", period: "monthly" })).rejects.toMatchObject({ code: "lot_limit" });
    await source.compte.changePlan({ planId: "gold", period: "monthly" });
    await source.equipe.invite({ firstName: "Thomas", lastName: "Girard", email: "thomas.girard@example.com", role: "comptable", portfolioMode: "all", mandantIds: [], message: "" });
    await expect(source.compte.changePlan({ planId: "gratuit", period: "monthly" })).rejects.toMatchObject({ code: "seat_limit" });
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
