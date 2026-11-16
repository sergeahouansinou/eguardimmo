import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@eguardimmo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import { rememberVerificationEmail } from "@/lib/pendingVerification";
import { InscriptionChoixScreen } from "./InscriptionChoixScreen";
import { AgenceRegister, BailleurRegister, VoyageurRegister } from "./RegisterForms";
import { ConfirmerEmailScreen, VerificationEmailScreen } from "./VerificationEmailScreens";

async function fillPerson(email: string, password: string, accept = true) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Prénom/), "Léa");
  await user.type(screen.getByLabelText(/^Nom \*/), "Martin");
  await user.type(screen.getByLabelText(/E-mail/), email);
  await user.type(screen.getByLabelText(/Mot de passe \*/), password);
  if (accept) await user.click(screen.getByRole("checkbox"));
  return user;
}

describe("InscriptionChoixScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/inscription");
  });

  it("propose les trois parcours et ne présente aucune violation", async () => {
    const { container } = renderWithAuth(<InscriptionChoixScreen />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/inscription/bailleur", "/inscription/agence", "/inscription/voyageur", "/connexion"]));
    await expectNoA11yViolations(container);
  });
});

describe("Inscription bailleur", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/inscription/bailleur");
  });

  it("n’a aucune violation d’accessibilité et déclare new-password", async () => {
    const { container } = renderWithAuth(<BailleurRegister />);
    expect(screen.getByLabelText(/Mot de passe \*/).getAttribute("autocomplete")).toBe("new-password");
    await expectNoA11yViolations(container);
  });

  it("crée le compte et mène à la vérification de l’e-mail", async () => {
    const environment = createTestEnvironment();
    renderWithAuth(<BailleurRegister />, environment);
    const user = await fillPerson("lea.martin@example.com", "Mot-De-Passe-2026");
    await user.click(screen.getByRole("button", { name: "Créer mon espace" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/verification-email"); });
    expect(environment.store.read()).not.toBeNull();
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem(window.sessionStorage.key(0) ?? "")).toBe("lea.martin@example.com");
    expect(String(router.push.mock.calls[0]?.[0])).not.toContain("lea");
  });

  it("refuse un mot de passe trop court et les conditions non acceptées", async () => {
    renderWithAuth(<BailleurRegister />);
    const user = await fillPerson("lea.martin@example.com", "court", false);
    await user.click(screen.getByRole("button", { name: "Créer mon espace" }));
    expect(await screen.findByText(/au moins 12 caractères/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("affiche le message 422 du serveur au lieu d’une erreur générique", async () => {
    const environment = createTestEnvironment();
    const register = vi.fn(() =>
      Promise.reject(new ApiError(422, "validation_failed", "Certains champs sont invalides.", { password: ["Le mot de passe doit contenir au moins un symbole."] })),
    );
    renderWithAuth(<BailleurRegister />, { ...environment, source: { ...environment.source, register } });
    const user = await fillPerson("lea.martin@example.com", "Mot-De-Passe-2026");
    await user.click(screen.getByRole("button", { name: "Créer mon espace" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Le mot de passe doit contenir au moins un symbole.");
    expect(screen.queryByText(/Une erreur est survenue/)).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("garde le message générique pour une panne non identifiée", async () => {
    const environment = createTestEnvironment();
    const register = vi.fn(() => Promise.reject(new Error("panne")));
    renderWithAuth(<BailleurRegister />, { ...environment, source: { ...environment.source, register } });
    const user = await fillPerson("lea.martin@example.com", "Mot-De-Passe-2026");
    await user.click(screen.getByRole("button", { name: "Créer mon espace" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Une erreur est survenue");
  });

  it("affiche l’indicateur de robustesse et permet d’afficher le mot de passe", async () => {
    renderWithAuth(<BailleurRegister />);
    const user = userEvent.setup();
    const field = screen.getByLabelText(/Mot de passe \*/);
    await user.type(field, "Mot-De-Passe-2026");
    expect(field.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: /Afficher/ }));
    expect(field.getAttribute("type")).toBe("text");
  });
});

describe("Inscription voyageur et agence", () => {
  beforeEach(() => {
    resetNavigation();
  });

  it("crée un compte voyageur", async () => {
    setLocation("/inscription/voyageur");
    const { container } = renderWithAuth(<VoyageurRegister />);
    await expectNoA11yViolations(container);
    const user = await fillPerson("camille.nouvelle@example.com", "Mot-De-Passe-2026");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/verification-email"); });
  });

  it("valide le SIREN de l’agence puis crée le compte", async () => {
    setLocation("/inscription/agence");
    const { container } = renderWithAuth(<AgenceRegister />);
    await expectNoA11yViolations(container);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Nom de l’agence/), "Cabinet Test");
    await user.type(screen.getByLabelText(/SIREN/), "12");
    await user.type(screen.getByLabelText(/E-mail du responsable/), "resp@agence-test.example");
    await user.type(screen.getByLabelText(/Mot de passe \*/), "Mot-De-Passe-2026");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Créer mon agence|Créer/ }));
    expect(router.push).not.toHaveBeenCalled();
    const siren = screen.getByLabelText(/SIREN/);
    await user.clear(siren);
    await user.type(siren, "123 456 789");
    await user.click(screen.getByRole("button", { name: /Créer mon agence|Créer/ }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/verification-email"); });
  });
});

describe("Vérification de l’e-mail", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/verification-email");
  });

  it("limite le renvoi puis le réactive", async () => {
    const environment = createTestEnvironment();
    await environment.source.register({ profile: "voyageur", firstName: "A", lastName: "B", email: "a@example.com", password: "Mot-De-Passe-2026" });
    const { container } = renderWithAuth(<VerificationEmailScreen />, environment);
    const button = await screen.findByRole("button", { name: /Renvoyer le message dans/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("confirme l’adresse avec un jeton valide", async () => {
    setLocation("/verification-email/confirmer?jeton=valide");
    const environment = createTestEnvironment();
    await environment.source.register({ profile: "voyageur", firstName: "A", lastName: "B", email: "a@example.com", password: "Mot-De-Passe-2026" });
    renderWithAuth(<ConfirmerEmailScreen />, environment);
    await waitFor(() => { expect(router.replace.mock.calls.length + router.push.mock.calls.length).toBeGreaterThan(0); });
    const target = String((router.replace.mock.calls[0] ?? router.push.mock.calls[0])?.[0]);
    expect(target).toContain("/email-verifie");
  });

  it("retire le jeton de vérification de l’URL après lecture", async () => {
    setLocation("/verification-email/confirmer?jeton=valide");
    const environment = createTestEnvironment();
    const verifyEmail = vi.fn(environment.source.verifyEmail);
    await environment.source.register({ profile: "voyageur", firstName: "A", lastName: "B", email: "a@example.com", password: "Mot-De-Passe-2026" });
    renderWithAuth(<ConfirmerEmailScreen />, { ...environment, source: { ...environment.source, verifyEmail } });
    await waitFor(() => { expect(verifyEmail).toHaveBeenCalledWith("valide"); });
    expect(window.location.search).toBe("");
    expect(window.location.href).not.toContain("jeton");
  });

  it("renvoie le message à l’adresse saisie à l’inscription, sans la mettre dans l’URL", async () => {
    const environment = createTestEnvironment();
    const resendVerification = vi.fn(() => Promise.resolve({ status: "sent" } as const));
    rememberVerificationEmail("jeanne@exemple.fr");
    environment.advance(120);
    renderWithAuth(<VerificationEmailScreen />, { ...environment, source: { ...environment.source, resendVerification } });

    expect(screen.queryByLabelText(/E-mail/)).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Renvoyer le message" }));

    expect(await screen.findByText("Message renvoyé.")).toBeTruthy();
    expect(resendVerification).toHaveBeenCalledWith("jeanne@exemple.fr");
    expect(window.location.href).not.toContain("jeanne");
    expect(screen.getByRole("button", { name: /Renvoyer le message dans/ })).toHaveProperty("disabled", true);
  });

  it("demande l’adresse quand elle n’est plus en mémoire, la valide puis renvoie", async () => {
    const environment = createTestEnvironment();
    const resendVerification = vi.fn(() => Promise.resolve({ status: "sent" } as const));
    environment.advance(120);
    renderWithAuth(<VerificationEmailScreen />, { ...environment, source: { ...environment.source, resendVerification } });

    await userEvent.click(await screen.findByRole("button", { name: "Renvoyer le message" }));
    expect(await screen.findByText("Saisissez votre adresse e-mail.")).toBeTruthy();
    expect(resendVerification).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/E-mail/), "jeanne@exemple.fr");
    await userEvent.click(screen.getByRole("button", { name: "Renvoyer le message" }));

    expect(await screen.findByText("Message renvoyé.")).toBeTruthy();
    expect(resendVerification).toHaveBeenCalledWith("jeanne@exemple.fr");
  });

  it("annonce la limitation de débit avec la durée à attendre", async () => {
    const environment = createTestEnvironment();
    const resendVerification = vi.fn(() => Promise.resolve({ status: "rate_limited", retryAfterSeconds: 45 } as const));
    rememberVerificationEmail("jeanne@exemple.fr");
    environment.advance(120);
    renderWithAuth(<VerificationEmailScreen />, { ...environment, source: { ...environment.source, resendVerification } });

    await userEvent.click(await screen.findByRole("button", { name: "Renvoyer le message" }));

    expect(await screen.findByText(/Réessayez dans 45 secondes/)).toBeTruthy();
    expect(screen.queryByText("Message renvoyé.")).toBeNull();
  });

  it("signale une adresse refusée par le serveur et une panne, sans prétendre que le message est parti", async () => {
    const environment = createTestEnvironment();
    rememberVerificationEmail("jeanne@exemple.fr");
    environment.advance(120);
    const resendVerification = vi.fn()
      .mockRejectedValueOnce(new ApiError(422, "validation_failed", "Adresse invalide."))
      .mockRejectedValueOnce(new ApiError(500, "server_error", "Erreur interne."));
    renderWithAuth(<VerificationEmailScreen />, { ...environment, source: { ...environment.source, resendVerification } });

    await userEvent.click(await screen.findByRole("button", { name: "Renvoyer le message" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Cette adresse e-mail n’est pas valide.");

    await userEvent.click(screen.getByRole("button", { name: "Renvoyer le message" }));
    await waitFor(() => { expect(screen.getByRole("alert").textContent).toContain("Réessayez dans un instant."); });
    expect(screen.queryByText("Message renvoyé.")).toBeNull();
  });

  it("oublie l’adresse en mémoire une fois le lien confirmé", async () => {
    setLocation("/verification-email/confirmer?jeton=valide");
    rememberVerificationEmail("jeanne@exemple.fr");
    const environment = createTestEnvironment();
    renderWithAuth(<ConfirmerEmailScreen />, environment);
    await waitFor(() => { expect(router.replace).toHaveBeenCalled(); });
    expect(window.sessionStorage.length).toBe(0);
  });

  it("signale une panne serveur à la confirmation sans prétendre que le lien est expiré", async () => {
    setLocation("/verification-email/confirmer?jeton=valide");
    const environment = createTestEnvironment();
    const verifyEmail = vi.fn(() => Promise.reject(new ApiError(500, "server_error", "Erreur interne.")));
    renderWithAuth(<ConfirmerEmailScreen />, { ...environment, source: { ...environment.source, verifyEmail } });
    expect((await screen.findByRole("alert")).textContent).toContain("Votre lien reste utilisable");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renvoie vers le lien expiré avec un jeton périmé", async () => {
    setLocation("/verification-email/confirmer?jeton=expire");
    renderWithAuth(<ConfirmerEmailScreen />);
    await waitFor(() => { expect(router.replace.mock.calls.length + router.push.mock.calls.length).toBeGreaterThan(0); });
    const target = String((router.replace.mock.calls[0] ?? router.push.mock.calls[0])?.[0]);
    expect(target).toContain("/lien-expire");
  });
});
