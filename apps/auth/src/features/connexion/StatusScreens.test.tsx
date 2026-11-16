import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, setLocation } from "../../../test/navigation";
import {
  CompteInconnuScreen,
  CompteSupprimeScreen,
  DeconnecteScreen,
  EmailVerifieScreen,
  LiaisonRequiseScreen,
  LienExpireScreen,
  MotDePasseModifieScreen,
  RetourRefuseScreen,
  SessionExpireeScreen,
} from "./StatusScreens";

const CASES = [
  ["compte inconnu", CompteInconnuScreen, "/connexion/compte-inconnu", "Aucun compte trouvé"],
  ["liaison requise", LiaisonRequiseScreen, "/connexion/liaison-requise", "Un compte existe déjà avec cet e-mail"],
  ["retour refusé", RetourRefuseScreen, "/retour-refuse?adresse=https%3A%2F%2Fpirate.example%2F", "Adresse de retour refusée"],
  ["session expirée", SessionExpireeScreen, "/session-expiree", "Votre session a expiré"],
  ["déconnecté", DeconnecteScreen, "/deconnecte", "Vous êtes déconnecté"],
  ["e-mail vérifié", EmailVerifieScreen, "/email-verifie", "E-mail vérifié"],
  ["lien expiré", LienExpireScreen, "/lien-expire", "Ce lien a expiré"],
  ["lien de confirmation invalide", LienExpireScreen, "/lien-expire?type=verification", "Lien de confirmation invalide"],
  ["mot de passe modifié", MotDePasseModifieScreen, "/mot-de-passe/modifie", "Mot de passe modifié"],
  ["compte supprimé", CompteSupprimeScreen, "/compte-supprime", "Compte supprimé"],
] as const;

describe("écrans de statut", () => {
  beforeEach(resetNavigation);

  it.each(CASES)("%s : titre, lien d’action et accessibilité", async (_name, Screen, location, title) => {
    setLocation(location);
    const { container } = renderWithAuth(<Screen />);
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("n’affiche pas l’adresse refusée complète, seulement son origine", () => {
    setLocation("/retour-refuse?adresse=" + encodeURIComponent("https://pirate.example/chemin?secret=1"));
    renderWithAuth(<RetourRefuseScreen />);
    expect(screen.getByText(/pirate\.example/)).toBeTruthy();
    expect(screen.queryByText(/secret=1/)).toBeNull();
  });

  it("l’e-mail vérifié renvoie vers la connexion, sans session ouverte", () => {
    setLocation("/email-verifie");
    renderWithAuth(<EmailVerifieScreen />);
    expect(screen.getByText("Connectez-vous pour accéder à votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Me connecter" }).getAttribute("href")).toBe("/connexion");
  });

  it("le lien de confirmation invalide explique la cause et propose la connexion", () => {
    setLocation("/lien-expire?type=verification");
    renderWithAuth(<LienExpireScreen />);
    expect(screen.getByText(/invalide, expiré \(60 minutes\) ou déjà utilisé/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Me connecter" }).getAttribute("href")).toBe("/connexion");
  });

  it("le lien de réinitialisation expiré propose un nouveau lien", () => {
    setLocation("/lien-expire");
    renderWithAuth(<LienExpireScreen />);
    expect(screen.getByRole("link", { name: "Recevoir un nouveau lien" }).getAttribute("href")).toBe("/mot-de-passe-oublie");
  });

  it("la déconnexion ferme la session encore ouverte puis propose de se reconnecter", async () => {
    setLocation("/deconnecte");
    const environment = createTestEnvironment("marc");
    renderWithAuth(<DeconnecteScreen />, environment);
    expect(await screen.findByRole("heading", { name: "Vous êtes déconnecté" })).toBeTruthy();
    expect(environment.store.read()).toBeNull();
    expect(screen.getByRole("link", { name: "Me reconnecter" }).getAttribute("href")).toBe("/connexion");
  });

  it("la déconnexion signale l’échec de fermeture de la session au lieu d’annoncer une déconnexion", async () => {
    setLocation("/deconnecte");
    const environment = createTestEnvironment("marc");
    const signOut = vi.spyOn(environment.source, "signOut").mockRejectedValueOnce(new Error("panne"));
    const { container } = renderWithAuth(<DeconnecteScreen />, environment);
    expect((await screen.findByRole("alert")).textContent).toContain("La déconnexion a échoué");
    expect(screen.queryByRole("heading", { name: "Vous êtes déconnecté" })).toBeNull();
    expect(environment.store.read()).not.toBeNull();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("heading", { name: "Vous êtes déconnecté" })).toBeTruthy();
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(environment.store.read()).toBeNull();
  });
});
