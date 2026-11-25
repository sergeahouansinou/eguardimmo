import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@eguardimmo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { navigationState, resetNavigation, router, setLocation } from "../../../test/navigation";
import { DefinirMotDePasseScreen, MotDePasseNouveauScreen, MotDePasseOublieScreen } from "./MotDePasseScreens";

describe("MotDePasseOublieScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/mot-de-passe-oublie");
  });

  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = renderWithAuth(<MotDePasseOublieScreen />);
    await expectNoA11yViolations(container);
  });

  it("envoie la demande et mène à l’écran de confirmation", async () => {
    const user = userEvent.setup();
    renderWithAuth(<MotDePasseOublieScreen />);
    await user.type(screen.getByLabelText(/E-mail/), "inconnu@example.com");
    await user.click(screen.getByRole("button", { name: /Envoyer/ }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mot-de-passe-oublie/envoye"); });
  });

  it("refuse une adresse invalide", async () => {
    const user = userEvent.setup();
    renderWithAuth(<MotDePasseOublieScreen />);
    await user.type(screen.getByLabelText(/E-mail/), "pas-un-email");
    await user.click(screen.getByRole("button", { name: /Envoyer/ }));
    expect(await screen.findByText(/pas valide/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("affiche la limite de débit à la sixième demande", async () => {
    const user = userEvent.setup();
    renderWithAuth(<MotDePasseOublieScreen />);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const field = screen.getByLabelText(/E-mail/);
      await user.clear(field);
      await user.type(field, "inconnu@example.com");
      await user.click(screen.getByRole("button", { name: /Envoyer/ }));
      await waitFor(() => { expect(screen.getByRole<HTMLButtonElement>("button", { name: /Envoyer/ }).disabled).toBe(false); });
    }
    expect(await screen.findByText(/Trop de demandes/)).toBeTruthy();
  });
});

describe("MotDePasseNouveauScreen", () => {
  beforeEach(() => {
    resetNavigation();
  });

  it("réinitialise avec un jeton valide", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide");
    const environment = createTestEnvironment("marc");
    const { container } = renderWithAuth(<MotDePasseNouveauScreen />, environment);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "Nouveau-Mot-2026");
    await expectNoA11yViolations(container);
    await user.type(screen.getByLabelText(/Confirmation \*/), "Nouveau-Mot-2026");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mot-de-passe/modifie"); });
    expect(environment.store.read()).toBeNull();
  });

  it("accepte un mot de passe de 6 caractères sans composition", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide");
    renderWithAuth(<MotDePasseNouveauScreen />, createTestEnvironment("marc"));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "azerty");
    expect(screen.queryByRole("list", { name: "Règles du mot de passe" })).toBeNull();
    await user.type(screen.getByLabelText(/Confirmation \*/), "azerty");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mot-de-passe/modifie"); });
  });

  it("affiche sous le champ le refus du serveur", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide");
    const environment = createTestEnvironment("marc");
    const refus = "Le champ mot de passe ne doit pas dépasser 255 caractères.";
    const resetPassword = vi.fn(() => Promise.reject(new ApiError(422, "validation_failed", "Certains champs sont invalides.", { password: [refus] })));
    renderWithAuth(<MotDePasseNouveauScreen />, { ...environment, source: { ...environment.source, resetPassword } });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "azerty");
    await user.type(screen.getByLabelText(/Confirmation \*/), "azerty");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByText(refus)).toBeTruthy();
    expect(screen.queryByText(/Une erreur est survenue/)).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("transmet le jeton et l’e-mail du lien à la vérification puis à la réinitialisation", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide&email=marc.chevalier%40example.com");
    const environment = createTestEnvironment("marc");
    const checkResetToken = vi.fn(environment.source.checkResetToken);
    const resetPassword = vi.fn(environment.source.resetPassword);
    renderWithAuth(<MotDePasseNouveauScreen />, { ...environment, source: { ...environment.source, checkResetToken, resetPassword } });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "Nouveau-Mot-2026");
    await user.type(screen.getByLabelText(/Confirmation \*/), "Nouveau-Mot-2026");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mot-de-passe/modifie"); });
    expect(checkResetToken).toHaveBeenCalledWith({ token: "valide", email: "marc.chevalier@example.com" });
    expect(resetPassword).toHaveBeenCalledWith({ token: "valide", email: "marc.chevalier@example.com", password: "Nouveau-Mot-2026" });
  });

  it("retire le jeton et l’e-mail de l’URL sans perdre le formulaire", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide&email=marc.chevalier%40example.com&suite=%2Fprofils");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const environment = createTestEnvironment("marc");
    const checkResetToken = vi.fn(environment.source.checkResetToken);
    const view = renderWithAuth(<MotDePasseNouveauScreen />, { ...environment, source: { ...environment.source, checkResetToken } });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "Nouveau-Mot-2026");

    expect(window.location.search).toBe("?suite=%2Fprofils");
    expect(window.location.href).not.toContain("jeton");
    expect(window.location.href).not.toContain("email");
    expect(replaceState).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    navigationState.search = "suite=%2Fprofils";
    view.rerenderWithAuth(<MotDePasseNouveauScreen />);
    expect(screen.getByLabelText<HTMLInputElement>(/Nouveau mot de passe \*/).value).toBe("Nouveau-Mot-2026");
    expect(router.replace).not.toHaveBeenCalled();
    expect(checkResetToken).toHaveBeenCalledTimes(1);
    replaceState.mockRestore();
  });

  it("ne touche pas à l’URL quand elle ne porte aucun paramètre sensible", async () => {
    setLocation("/mot-de-passe/nouveau");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderWithAuth(<MotDePasseNouveauScreen />);
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/lien-expire?type=reinitialisation"); });
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("refuse une confirmation différente", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide");
    renderWithAuth(<MotDePasseNouveauScreen />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "Nouveau-Mot-2026");
    await user.type(screen.getByLabelText(/Confirmation \*/), "Autre-Mot-2026");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByText(/ne correspond|identique|correspondent/i)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("refuse la réutilisation de l’ancien mot de passe", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=valide");
    const environment = createTestEnvironment();
    await environment.source.requestPasswordReset("marc.chevalier@example.com");
    renderWithAuth(<MotDePasseNouveauScreen />, environment);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nouveau mot de passe \*/), "MotDePasse-2026");
    await user.type(screen.getByLabelText(/Confirmation \*/), "MotDePasse-2026");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByText("Choisissez un mot de passe différent de l’ancien.")).toBeTruthy();
  });

  it("renvoie vers le lien expiré avec un jeton périmé ou absent", async () => {
    setLocation("/mot-de-passe/nouveau?jeton=expire");
    renderWithAuth(<MotDePasseNouveauScreen />);
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/lien-expire?type=reinitialisation"); });
  });
});

describe("DefinirMotDePasseScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/mot-de-passe/definir");
  });

  it("envoie le lien de définition au compte sans mot de passe", async () => {
    const user = userEvent.setup();
    const { container } = renderWithAuth(<DefinirMotDePasseScreen />, createTestEnvironment("camille"));
    await user.click(await screen.findByRole("button", { name: "Recevoir le lien par e-mail" }));
    expect(await screen.findByText("Lien envoyé.")).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
