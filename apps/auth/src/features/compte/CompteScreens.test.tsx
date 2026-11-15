import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useCodesStore } from "@/features/auth/codesStore";
import { securitySchema } from "@/features/auth/schemas";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import type { TestEnvironment } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import { AccountShell } from "./AccountShell";
import { Activation2FAScreen } from "./Activation2FAScreen";
import { AppareilsScreen } from "./AppareilsScreen";
import { CodesSecoursScreen } from "./CodesSecoursScreen";
import { ComptesLiesScreen, LiaisonConflitScreen } from "./ComptesLiesScreens";
import { ConfirmerCodeScreen, ConfirmerMotDePasseScreen } from "./ConfirmationScreens";
import { useNoticeStore } from "./noticeStore";
import { SecuriteScreen } from "./SecuriteScreen";
import { SuppressionScreen } from "./SuppressionScreen";

async function confirmed(accountId: string): Promise<TestEnvironment> {
  const environment = createTestEnvironment(accountId);
  await environment.source.confirmPassword("MotDePasse-2026");
  return environment;
}

async function security(environment: TestEnvironment) {
  return securitySchema.parse(await environment.source.getSecurity());
}

beforeEach(() => {
  resetNavigation();
  useCodesStore.getState().clear();
  useNoticeStore.getState().dismiss();
});

describe("AccountShell", () => {
  it("renvoie vers la connexion sans session, en gardant la page demandée", async () => {
    setLocation("/compte/securite");
    renderWithAuth(<AccountShell>contenu</AccountShell>);
    await waitFor(() => { expect(router.replace).toHaveBeenCalledTimes(1); });
    expect(String(router.replace.mock.calls[0]?.[0])).toBe("/connexion?suite=%2Fcompte%2Fsecurite");
  });

  it("affiche la navigation du compte et le contenu avec une session", async () => {
    setLocation("/compte/securite");
    const { container } = renderWithAuth(<AccountShell>contenu de test</AccountShell>, createTestEnvironment("koffi"));
    expect(await screen.findByText("contenu de test")).toBeTruthy();
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/compte/securite", "/compte/comptes-lies", "/compte/appareils", "/compte/supprimer", "/compte/aide"]));
    await expectNoA11yViolations(container);
  });
});

describe("SecuriteScreen", () => {
  it("présente les sections du compte de Koffi sans violation", async () => {
    setLocation("/compte/securite");
    const { container } = renderWithAuth(<SecuriteScreen />, createTestEnvironment("koffi"));
    expect(await screen.findByText("Double authentification")).toBeTruthy();
    for (const title of ["Connexion", "Comptes liés", "Appareils connectés", "Zone sensible"]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    await expectNoA11yViolations(container);
  });

  it("propose d’activer la 2FA à un compte qui n’en a pas", async () => {
    setLocation("/compte/securite");
    renderWithAuth(<SecuriteScreen />, createTestEnvironment("marc"));
    expect((await screen.findByRole("link", { name: "Activer" })).getAttribute("href")).toBe("/compte/securite/double-authentification");
  });
});

describe("Confirmation", () => {
  it("accepte le mot de passe et revient sur la page demandée", async () => {
    setLocation("/compte/securite/confirmation?suite=%2Fcompte%2Fappareils");
    const { container } = renderWithAuth(<ConfirmerMotDePasseScreen />, createTestEnvironment("marc"));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Mot de passe \*/), "MotDePasse-2026");
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/compte/appareils?confirme=1"); });
  });

  it("refuse un mauvais mot de passe", async () => {
    setLocation("/compte/securite/confirmation?suite=%2Fcompte%2Fappareils");
    renderWithAuth(<ConfirmerMotDePasseScreen />, createTestEnvironment("marc"));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Mot de passe \*/), "mauvais");
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith("/compte/appareils?confirme=1");
  });

  it("ignore une suite externe et retombe sur la sécurité", async () => {
    setLocation("/compte/securite/confirmation?suite=https%3A%2F%2Fpirate.example");
    renderWithAuth(<ConfirmerMotDePasseScreen />, createTestEnvironment("marc"));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Mot de passe \*/), "MotDePasse-2026");
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/compte/securite?confirme=1"); });
  });

  it("confirme avec le code de l’application", async () => {
    setLocation("/compte/securite/confirmation/code?suite=%2Fcompte%2Fsupprimer&exige=code");
    const { container } = renderWithAuth(<ConfirmerCodeScreen />, createTestEnvironment("koffi"));
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText(/chiffre 1 sur 6/));
    await user.keyboard("481305");
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/compte/supprimer?confirme=1"); });
  });
});

describe("Activation de la 2FA", () => {
  it("redirige vers la confirmation quand elle n’est pas récente", async () => {
    setLocation("/compte/securite/double-authentification");
    renderWithAuth(<Activation2FAScreen />, createTestEnvironment("marc"));
    await waitFor(() => { expect(router.push).toHaveBeenCalled(); });
    expect(String(router.push.mock.calls[0]?.[0])).toContain("/compte/securite/confirmation");
  });

  it("active avec le bon code et révèle les codes de secours une seule fois", async () => {
    setLocation("/compte/securite/double-authentification");
    const environment = await confirmed("marc");
    const { container } = renderWithAuth(<Activation2FAScreen />, environment);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Code à 6 chiffres/), "481305");
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Confirmer et activer" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/compte/securite/codes-de-secours"); });
    expect(useCodesStore.getState().codes).toHaveLength(8);
    expect((await security(environment)).twoFactor.enabled).toBe(true);
  });

  it("refuse un mauvais code", async () => {
    setLocation("/compte/securite/double-authentification");
    renderWithAuth(<Activation2FAScreen />, await confirmed("marc"));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Code à 6 chiffres/), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmer et activer" }));
    expect(await screen.findByText(/Code incorrect/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith("/compte/securite/codes-de-secours");
  });
});

describe("Codes de secours", () => {
  it("affiche les codes une seule fois puis vide le magasin", async () => {
    setLocation("/compte/securite/codes-de-secours");
    useCodesStore.getState().reveal(["aaaaa-11111", "bbbbb-22222"]);
    const { container } = renderWithAuth(<CodesSecoursScreen />, createTestEnvironment("marc"));
    const list = screen.getByRole("list", { name: "Codes de secours" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(useCodesStore.getState().codes).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("retourne à la sécurité quand il n’y a aucun code à montrer", async () => {
    setLocation("/compte/securite/codes-de-secours");
    renderWithAuth(<CodesSecoursScreen />, createTestEnvironment("marc"));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/compte/securite"); });
  });
});

describe("Comptes liés", () => {
  it("exige une confirmation avant de délier", async () => {
    setLocation("/compte/comptes-lies");
    renderWithAuth(<ComptesLiesScreen />, createTestEnvironment("koffi"));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Délier Google" }));
    expect(String(router.push.mock.calls[0]?.[0])).toContain("/compte/securite/confirmation");
  });

  it("délie Google après confirmation du dialogue", async () => {
    setLocation("/compte/comptes-lies");
    const environment = await confirmed("koffi");
    const { container } = renderWithAuth(<ComptesLiesScreen />, environment);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Délier Google" }));
    const dialog = await screen.findByRole("dialog");
    await expectNoA11yViolations(container);
    await user.click(within(dialog).getByRole("button", { name: "Délier" }));
    await waitFor(() => { expect(useNoticeStore.getState().notice?.title).toBe("Google délié de votre compte."); });
    expect((await security(environment)).linkedAccounts.find((account) => account.provider === "google")?.linked).toBe(false);
  });

  it("annule la déliaison sans rien modifier", async () => {
    setLocation("/compte/comptes-lies");
    const environment = await confirmed("koffi");
    renderWithAuth(<ComptesLiesScreen />, environment);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Délier Google" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Annuler/ }));
    expect((await security(environment)).linkedAccounts.find((account) => account.provider === "google")?.linked).toBe(true);
  });

  it("explique le conflit de liaison", async () => {
    setLocation("/compte/comptes-lies/liaison-impossible?fournisseur=google");
    const { container } = renderWithAuth(<LiaisonConflitScreen />, createTestEnvironment("marc"));
    expect(await screen.findByText(/déjà lié à un autre compte eGuardImmo/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe("Appareils", () => {
  it("déconnecte un appareil", async () => {
    setLocation("/compte/appareils");
    const environment = createTestEnvironment("koffi");
    const { container } = renderWithAuth(<AppareilsScreen />, environment);
    const buttons = await screen.findAllByRole("button", { name: /^Déconnecter (?!les autres)/ });
    await expectNoA11yViolations(container);
    const before = (await security(environment)).devices.length;
    const user = userEvent.setup();
    const [first] = buttons;
    if (!first) throw new Error("aucun appareil");
    await user.click(first);
    await waitFor(() => { expect(useNoticeStore.getState().notice?.tone).toBe("success"); });
    expect((await security(environment)).devices.length).toBe(before - 1);
  });

  it("déconnecte les autres appareils après confirmation", async () => {
    setLocation("/compte/appareils");
    const environment = createTestEnvironment("koffi");
    renderWithAuth(<AppareilsScreen />, environment);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Déconnecter les autres appareils" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Déconnecter" }));
    await waitFor(() => { expect(useNoticeStore.getState().notice?.title).toBe("Les autres appareils ont été déconnectés."); });
    expect((await security(environment)).devices).toHaveLength(1);
  });
});

describe("Suppression du compte", () => {
  it("exige le mot SUPPRIMER avant tout", async () => {
    setLocation("/compte/supprimer");
    const { container } = renderWithAuth(<SuppressionScreen />, createTestEnvironment("marc"));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Supprimer définitivement" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("redirige vers la ré-authentification quand la confirmation n’est pas récente", async () => {
    setLocation("/compte/supprimer");
    renderWithAuth(<SuppressionScreen />, createTestEnvironment("marc"));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Tapez SUPPRIMER/), "SUPPRIMER");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalled(); });
    expect(String(router.push.mock.calls[0]?.[0])).toContain("/compte/securite/confirmation");
  });

  it("supprime après confirmation du dialogue puis mène à l’écran final", async () => {
    setLocation("/compte/supprimer?confirme=1");
    const environment = await confirmed("marc");
    renderWithAuth(<SuppressionScreen />, environment);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Tapez SUPPRIMER/), "SUPPRIMER");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Oui, supprimer mon compte" }));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/compte-supprime"); });
    expect(environment.store.read()).toBeNull();
  });
});
