import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SocialButtons } from "@/components/SocialButtons";
import { createApiAuthSource } from "@/features/auth/api";
import { createApiClient } from "@eguardimmo/api";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import { AgenceRegister } from "../inscription/RegisterForms";
import { ConnexionScreen } from "./ConnexionScreen";

const RETOUR = "http://localhost:3020/";

function apiEnvironment() {
  const client = createApiClient({ baseUrl: "https://api.test", fetchImpl: () => Promise.resolve(new Response(null, { status: 401 })), readCookie: () => "xsrf" });
  return { ...createTestEnvironment(), source: createApiAuthSource(client) };
}

describe("boutons sociaux en mode API", () => {
  const assign = vi.fn();
  const original = window.location;

  beforeEach(() => {
    resetNavigation();
    assign.mockReset();
    window.sessionStorage.clear();
    Object.defineProperty(window, "location", { configurable: true, value: { assign, href: original.href, origin: original.origin } });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("envoie la connexion Google vers le backend avec l’adresse de retour autorisée", async () => {
    setLocation("/connexion?return_to=" + encodeURIComponent(RETOUR));
    renderWithAuth(<ConnexionScreen />, apiEnvironment());
    await userEvent.setup().click(screen.getByRole("button", { name: /Continuer avec Google/ }));
    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(String(assign.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe("https://api.test/auth/social/google/redirect");
    expect(Object.fromEntries(url.searchParams)).toEqual({ intent: "login", return_to: RETOUR });
    expect(window.sessionStorage.getItem("eguardimmo.auth.social-provider")).toBe("google");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ne part pas vers le fournisseur quand l’adresse de retour est refusée", async () => {
    setLocation("/connexion?return_to=" + encodeURIComponent("https://pirate.example/"));
    renderWithAuth(<ConnexionScreen />, apiEnvironment());
    router.replace.mockClear();
    await userEvent.setup().click(screen.getByRole("button", { name: /Continuer avec Apple/ }));
    expect(assign).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("/retour-refuse"));
  });

  it("transmet le profil agence à l’inscription", async () => {
    setLocation("/inscription/agence");
    renderWithAuth(<AgenceRegister />, apiEnvironment());
    await userEvent.setup().click(screen.getByRole("button", { name: /S’inscrire avec Google/ }));
    const url = new URL(String(assign.mock.calls[0]?.[0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ intent: "register", profile: "agency" });
  });

  it("masque les boutons à l’invitation, que le backend ne gère pas", () => {
    setLocation("/invitation/locataire-koffi");
    renderWithAuth(<SocialButtons verb="Activer avec" intent="invitation" onPick={vi.fn()} />, apiEnvironment());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("garde le sélecteur simulé en mode démonstration", async () => {
    setLocation("/connexion");
    renderWithAuth(<ConnexionScreen />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Continuer avec Google/ }));
    expect(assign).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("retour du fournisseur sur la connexion", () => {
  beforeEach(() => {
    resetNavigation();
    window.sessionStorage.clear();
  });

  it("mène un compte inconnu vers l’écran dédié avec le fournisseur mémorisé", () => {
    window.sessionStorage.setItem("eguardimmo.auth.social-provider", "apple");
    setLocation("/connexion?erreur=no_account");
    renderWithAuth(<ConnexionScreen />);
    expect(router.replace).toHaveBeenCalledWith("/connexion/compte-inconnu?fournisseur=apple");
  });

  it("mène un compte existant vers la liaison requise", () => {
    window.sessionStorage.setItem("eguardimmo.auth.social-provider", "google");
    setLocation("/connexion?erreur=account_exists_link_required");
    renderWithAuth(<ConnexionScreen />);
    expect(router.replace).toHaveBeenCalledWith("/connexion/liaison-requise?fournisseur=google");
  });

  it.each(["provider_error", "invalid_state", "provider_unavailable"])("affiche l’erreur technique pour %s", (code) => {
    setLocation(`/connexion?erreur=${code}`);
    renderWithAuth(<ConnexionScreen />);
    expect(screen.getByText("Connexion impossible pour le moment.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("n’affiche rien de plus sans paramètre d’erreur", () => {
    setLocation("/connexion");
    renderWithAuth(<ConnexionScreen />);
    expect(screen.queryByText("Connexion impossible pour le moment.")).toBeNull();
  });
});
