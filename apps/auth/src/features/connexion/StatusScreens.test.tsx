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
  ["e-mail vérifié", EmailVerifieScreen, "/email-verifie", "Adresse vérifiée"],
  ["lien expiré", LienExpireScreen, "/lien-expire?type=verification", "Ce lien a expiré"],
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

  it("le lien expiré de vérification propose un nouveau message de vérification", () => {
    setLocation("/lien-expire?type=verification");
    renderWithAuth(<LienExpireScreen />);
    expect(screen.getByRole("link", { name: "Recevoir un nouveau lien" }).getAttribute("href")).toBe("/verification-email");
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
