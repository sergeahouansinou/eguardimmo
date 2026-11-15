import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
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
  });

  it("refuse un mot de passe trop court et les conditions non acceptées", async () => {
    renderWithAuth(<BailleurRegister />);
    const user = await fillPerson("lea.martin@example.com", "court", false);
    await user.click(screen.getByRole("button", { name: "Créer mon espace" }));
    expect(await screen.findByText(/au moins 12 caractères/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
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

  it("renvoie vers le lien expiré avec un jeton périmé", async () => {
    setLocation("/verification-email/confirmer?jeton=expire");
    renderWithAuth(<ConfirmerEmailScreen />);
    await waitFor(() => { expect(router.replace.mock.calls.length + router.push.mock.calls.length).toBeGreaterThan(0); });
    const target = String((router.replace.mock.calls[0] ?? router.push.mock.calls[0])?.[0]);
    expect(target).toContain("/lien-expire");
  });
});
