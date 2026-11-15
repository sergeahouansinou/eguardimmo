import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import { ConnexionScreen } from "./ConnexionScreen";

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  const emailField = screen.getByLabelText(/E-mail/);
  await user.clear(emailField);
  await user.type(emailField, email);
  await user.type(screen.getByLabelText(/Mot de passe \*/), password);
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("ConnexionScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/connexion");
  });

  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = renderWithAuth(<ConnexionScreen />);
    await expectNoA11yViolations(container);
  });

  it("déclare les attributs autocomplete attendus", () => {
    renderWithAuth(<ConnexionScreen />);
    expect(screen.getByLabelText(/E-mail/).getAttribute("autocomplete")).toBe("username");
    expect(screen.getByLabelText(/Mot de passe \*/).getAttribute("autocomplete")).toBe("current-password");
  });

  it("connecte un compte sans 2FA et redirige vers le choix du profil", async () => {
    const environment = createTestEnvironment();
    renderWithAuth(<ConnexionScreen />, environment);
    await fill("marc.chevalier@example.com", "MotDePasse-2026");
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/profils"); });
    expect(environment.store.read()).toBe("marc");
  });

  it("envoie vers la vérification 2FA quand elle est requise", async () => {
    renderWithAuth(<ConnexionScreen />);
    await fill("koffi.adjovi@example.com", "MotDePasse-2026");
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/connexion/verification"); });
  });

  it("affiche l’erreur générique et vide le mot de passe", async () => {
    renderWithAuth(<ConnexionScreen />);
    await fill("marc.chevalier@example.com", "mauvais");
    expect(await screen.findByText("E-mail ou mot de passe incorrect.")).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(/Mot de passe \*/).value).toBe("");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("affiche le verrou après cinq échecs et désactive le bouton", async () => {
    renderWithAuth(<ConnexionScreen />);
    for (let attempt = 0; attempt < 5; attempt += 1) await fill("marc.chevalier@example.com", "mauvais");
    expect(await screen.findByText("Trop de tentatives.")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Se connecter" }).disabled).toBe(true);
  });

  it("valide les champs avant l’envoi", async () => {
    const user = userEvent.setup();
    renderWithAuth(<ConnexionScreen />);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Saisissez votre mot de passe.")).toBeTruthy();
    expect(screen.getByLabelText(/E-mail/).getAttribute("aria-invalid")).toBe("true");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("reprend le return_to autorisé vers l’écran de continuation", async () => {
    setLocation("/connexion?return_to=" + encodeURIComponent("http://localhost:3020/"));
    renderWithAuth(<ConnexionScreen />);
    await fill("marc.chevalier@example.com", "MotDePasse-2026");
    await waitFor(() => { expect(router.push).toHaveBeenCalled(); });
    expect(String(router.push.mock.calls[0]?.[0])).toContain("/continuer");
  });

  it("refuse un return_to hors liste blanche", async () => {
    setLocation("/connexion?return_to=" + encodeURIComponent("https://pirate.example/"));
    renderWithAuth(<ConnexionScreen />);
    await waitFor(() => { expect(router.replace).toHaveBeenCalled(); });
    expect(String(router.replace.mock.calls[0]?.[0])).toContain("/retour-refuse");
  });
});
