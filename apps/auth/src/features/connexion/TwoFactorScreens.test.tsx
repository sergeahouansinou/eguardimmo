import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import type { TestEnvironment } from "../../../test/render";
import { BackupCodeScreen, TwoFactorScreen } from "./TwoFactorScreens";

async function challenged(): Promise<TestEnvironment> {
  const environment = createTestEnvironment();
  await environment.source.signIn({ email: "koffi.adjovi@example.com", password: "MotDePasse-2026" });
  return environment;
}

async function enterCode(code: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(/chiffre 1 sur 6/));
  await user.keyboard(code);
  await user.click(screen.getByRole("button", { name: "Valider le code" }));
}

describe("TwoFactorScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/connexion/verification");
  });

  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = renderWithAuth(<TwoFactorScreen />, await challenged());
    await expectNoA11yViolations(container);
  });

  it("valide le bon code et ouvre la session", async () => {
    const environment = await challenged();
    renderWithAuth(<TwoFactorScreen />, environment);
    await enterCode("481305");
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/profils"); });
    expect(environment.store.read()).toBe("koffi");
  });

  it("refuse un mauvais code et vide la saisie", async () => {
    renderWithAuth(<TwoFactorScreen />, await challenged());
    await enterCode("000000");
    expect(await screen.findByText("Code incorrect.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("refuse un code incomplet avant l’envoi", async () => {
    renderWithAuth(<TwoFactorScreen />, await challenged());
    await enterCode("48");
    expect(await screen.findByText("Le code comporte 6 chiffres.")).toBeTruthy();
  });

  it("signale la vérification expirée sans défi en cours", async () => {
    renderWithAuth(<TwoFactorScreen />);
    await enterCode("481305");
    expect(await screen.findByText("Votre vérification a expiré.")).toBeTruthy();
  });

  it("verrouille après cinq mauvais codes, à la tentative suivante", async () => {
    renderWithAuth(<TwoFactorScreen />, await challenged());
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await enterCode("000000");
      await screen.findByRole("button", { name: "Valider le code" });
    }
    expect(await screen.findByText("Trop de tentatives.")).toBeTruthy();
  });

  it("propose le code de secours", async () => {
    renderWithAuth(<TwoFactorScreen />, await challenged());
    const link = screen.getByRole("link", { name: "Utiliser un code de secours" });
    expect(link.getAttribute("href")).toBe("/connexion/code-de-secours");
  });
});

describe("BackupCodeScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/connexion/code-de-secours");
  });

  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = renderWithAuth(<BackupCodeScreen />, await challenged());
    await expectNoA11yViolations(container);
  });

  it("accepte un code de secours valide", async () => {
    const environment = await challenged();
    renderWithAuth(<BackupCodeScreen />, environment);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Code de secours \*/), "r5n7v-4bj2e");
    await user.click(screen.getByRole("button", { name: "Valider le code de secours" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/profils"); });
    expect(environment.store.read()).toBe("koffi");
  });

  it("refuse un code inconnu", async () => {
    renderWithAuth(<BackupCodeScreen />, await challenged());
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Code de secours \*/), "zzzzz-zzzzz");
    await user.click(screen.getByRole("button", { name: "Valider le code de secours" }));
    expect(await screen.findByText("Code de secours refusé.")).toBeTruthy();
  });
});
