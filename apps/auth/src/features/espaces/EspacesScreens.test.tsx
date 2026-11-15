import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirectTo } from "@/lib/navigation";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import { AccesRefuseScreen } from "./AccesRefuseScreen";
import { ContinuerScreen } from "./ContinuerScreen";
import { ProfilsScreen } from "./ProfilsScreen";

describe("ProfilsScreen", () => {
  beforeEach(() => {
    resetNavigation();
    vi.mocked(redirectTo).mockReset();
    setLocation("/profils");
  });

  it("liste les profils de Marc, sans violation d’accessibilité", async () => {
    const { container } = renderWithAuth(<ProfilsScreen />, createTestEnvironment("marc"));
    expect(await screen.findByText("Bonjour Marc")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Ouvrir cet espace/ })).toHaveLength(3);
    await expectNoA11yViolations(container);
  });

  it("ouvre l’espace choisi et mémorise le profil", async () => {
    const user = userEvent.setup();
    renderWithAuth(<ProfilsScreen />, createTestEnvironment("marc"));
    const [first] = await screen.findAllByRole("button", { name: /Ouvrir cet espace/ });
    if (!first) throw new Error("aucun profil");
    await user.click(first);
    await waitFor(() => { expect(redirectTo).toHaveBeenCalledTimes(1); });
    expect(String(vi.mocked(redirectTo).mock.calls[0]?.[0])).toContain("localhost");
  });

  it.each([
    ["Espace bailleur", "http://localhost:3020/"],
    ["Espace propriétaire", "http://localhost:3020/confie"],
    ["Espace locataire", "http://localhost:3030/"],
  ])("ouvre %s à l’adresse configurée", async (title, expected) => {
    const user = userEvent.setup();
    renderWithAuth(<ProfilsScreen />, createTestEnvironment("marc"));
    await user.click(await screen.findByRole("button", { name: `Ouvrir cet espace : ${title}` }));
    await waitFor(() => { expect(redirectTo).toHaveBeenCalledWith(expected); });
  });

  it("reprend l’adresse de retour demandée quand elle vise le profil ouvert", async () => {
    setLocation("/profils?return_to=" + encodeURIComponent("http://localhost:3030/loyers"));
    renderWithAuth(<ProfilsScreen />, createTestEnvironment("koffi"));
    await waitFor(() => { expect(redirectTo).toHaveBeenCalledWith("http://localhost:3030/loyers"); });
  });

  it("ouvre directement l’unique profil", async () => {
    renderWithAuth(<ProfilsScreen />, createTestEnvironment("koffi"));
    await waitFor(() => { expect(redirectTo).toHaveBeenCalledTimes(1); });
  });

  it("oriente un compte sans profil vers l’écran dédié", async () => {
    renderWithAuth(<ProfilsScreen />, createTestEnvironment("sans-profil"));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/acces-refuse?aucun=1"); });
  });

  it("renvoie vers la connexion sans session, en gardant la suite", async () => {
    renderWithAuth(<ProfilsScreen />);
    await waitFor(() => { expect(router.replace).toHaveBeenCalledTimes(1); });
    expect(String(router.replace.mock.calls[0]?.[0])).toMatch(/^\/connexion\?.*suite=/);
  });

  it("se déconnecte et mène à l’écran de déconnexion", async () => {
    const user = userEvent.setup();
    const environment = createTestEnvironment("marc");
    renderWithAuth(<ProfilsScreen />, environment);
    await screen.findByText("Bonjour Marc");
    await user.click(screen.getByRole("button", { name: /Se déconnecter/ }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/deconnecte"); });
    expect(environment.store.read()).toBeNull();
  });
});

describe("ContinuerScreen", () => {
  beforeEach(() => {
    resetNavigation();
    vi.mocked(redirectTo).mockReset();
  });

  it("redirige vers l’espace demandé quand le profil existe", async () => {
    setLocation("/continuer?return_to=" + encodeURIComponent("http://localhost:3030/"));
    const { container } = renderWithAuth(<ContinuerScreen />, createTestEnvironment("koffi"));
    await waitFor(() => { expect(redirectTo).toHaveBeenCalledWith("http://localhost:3030/"); });
    await expectNoA11yViolations(container);
  });

  it("refuse l’accès à un espace sans profil correspondant", async () => {
    setLocation("/continuer?return_to=" + encodeURIComponent("http://localhost:3010/"));
    renderWithAuth(<ContinuerScreen />, createTestEnvironment("koffi"));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith("/acces-refuse?espace=agence"); });
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("n’ouvre jamais une adresse hors liste blanche", async () => {
    setLocation("/continuer?return_to=" + encodeURIComponent("https://pirate.example/"));
    renderWithAuth(<ContinuerScreen />, createTestEnvironment("koffi"));
    await waitFor(() => { expect(router.replace).toHaveBeenCalled(); });
    expect(String(router.replace.mock.calls[0]?.[0])).toContain("/retour-refuse");
    expect(redirectTo).not.toHaveBeenCalled();
  });
});

describe("AccesRefuseScreen", () => {
  beforeEach(() => {
    resetNavigation();
  });

  it("propose les espaces disponibles quand l’espace demandé est refusé", async () => {
    setLocation("/acces-refuse?espace=agence");
    const { container } = renderWithAuth(<AccesRefuseScreen />, createTestEnvironment("koffi"));
    expect(await screen.findByRole("button", { name: /Se déconnecter/ })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("explique l’absence de profil", async () => {
    setLocation("/acces-refuse?aucun=1");
    const { container } = renderWithAuth(<AccesRefuseScreen />, createTestEnvironment("sans-profil"));
    expect(await screen.findByText("Aucun espace rattaché à ce compte")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Créer un espace" }).getAttribute("href")).toBe("/inscription");
    await expectNoA11yViolations(container);
  });
});
