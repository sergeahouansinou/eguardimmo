import { ApiUnreachableError } from "@eguardimmo/api";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import type { TestEnvironment } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, setLocation } from "../../../test/navigation";
import { DEMO_TENANT_TOKENS } from "@/features/auth/demoTenantInvitations";
import type { AuthSource, TenantInvitationAcceptance } from "@/features/auth/source";
import { EmailVerifieScreen } from "@/features/connexion/StatusScreens";
import { readTenantInvitation, rememberTenantInvitation } from "@/lib/tenantInvitationIntent";
import { TenantInvitationScreen } from "./TenantInvitationScreen";

const KOFFI = DEMO_TENANT_TOKENS.koffi;

function withSource(environment: TestEnvironment, overrides: Partial<AuthSource>): TestEnvironment {
  return { ...environment, source: { ...environment.source, ...overrides } };
}

function acceptingWith(result: TenantInvitationAcceptance | Error) {
  return vi.fn<AuthSource["acceptTenantInvitation"]>(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
}

async function consentAndSubmit() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Accepter l’invitation" }));
}

describe("TenantInvitationScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation(`/invitation-locataire/${KOFFI}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("jeton et URL", () => {
    it("retire le jeton de l’URL, le garde en sessionStorage et n’écrit rien dans les journaux", async () => {
      const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />);

      await screen.findByRole("link", { name: "Me connecter" });

      expect(window.location.pathname).toBe("/invitation-locataire");
      expect(window.location.href).not.toContain(KOFFI);
      expect(readTenantInvitation()).toBe(KOFFI);
      for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain(KOFFI);
    });

    it("reprend le jeton mémorisé quand l’URL n’en porte plus", async () => {
      rememberTenantInvitation(KOFFI);
      setLocation("/invitation-locataire");
      renderWithAuth(<TenantInvitationScreen urlToken={null} />, createTestEnvironment("koffi"));

      expect(await screen.findByText("Gestion Les Tilleuls")).toBeTruthy();
    });

    it("refuse un jeton mal formé sans appeler le serveur ni le mémoriser", async () => {
      const environment = createTestEnvironment("koffi");
      const preview = vi.fn<AuthSource["previewTenantInvitation"]>(() => Promise.resolve({ status: "valid" }));
      renderWithAuth(<TenantInvitationScreen urlToken="trop-court" />, withSource(environment, { previewTenantInvitation: preview }));

      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      expect(preview).not.toHaveBeenCalled();
      expect(readTenantInvitation()).toBeNull();
      expect(window.location.pathname).toBe("/invitation-locataire");
    });

    it("affiche un seul message pour un jeton expiré, inconnu ou déjà utilisé, et oublie le jeton", async () => {
      const expired = renderWithAuth(<TenantInvitationScreen urlToken={DEMO_TENANT_TOKENS.expiree} />, createTestEnvironment("koffi"));
      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      const message = screen.getByText(/invalide, expirée ou déjà utilisée/).textContent;
      await waitFor(() => { expect(readTenantInvitation()).toBeNull(); });
      expired.unmount();

      renderWithAuth(<TenantInvitationScreen urlToken={"Inconnu".padEnd(48, "0")} />, createTestEnvironment("koffi"));
      await screen.findByText("Invitation invalide");
      expect(screen.getByText(/invalide, expirée ou déjà utilisée/).textContent).toBe(message);
    });
  });

  describe("sans session", () => {
    it("propose de se connecter ou de créer un compte en gardant l’intention, sans jeton dans les liens", async () => {
      const { container } = renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />);

      const login = await screen.findByRole("link", { name: "Me connecter" });
      const signUp = screen.getByRole("link", { name: "Créer mon compte" });
      expect(login.getAttribute("href")).toBe("/connexion?suite=%2Finvitation-locataire");
      expect(signUp.getAttribute("href")).toBe("/inscription?suite=%2Finvitation-locataire");
      for (const link of [login, signUp]) expect(link.getAttribute("href")).not.toContain(KOFFI);
      await expectNoA11yViolations(container);
    });

    it("liste les invitations de démonstration en mode démo", async () => {
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />);
      expect(await screen.findByText("Mode démonstration")).toBeTruthy();
      expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === `/invitation-locataire/${DEMO_TENANT_TOKENS.alex}`)).toBe(true);
    });
  });

  describe("consentement", () => {
    it("affiche l’organisation, l’expiration et le texte de consentement, avec le bouton inactif sans la case", async () => {
      const { container } = renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, createTestEnvironment("koffi"));

      expect(await screen.findByRole("heading", { name: "Rattacher mon compte à mon dossier" })).toBeTruthy();
      expect(screen.getAllByText(/Gestion Les Tilleuls/).length).toBeGreaterThan(1);
      expect(screen.getByText(/valable jusqu’au 21\/11\/2026/)).toBeTruthy();
      expect(screen.getByText("koffi.adjovi@example.com")).toBeTruthy();
      const button = screen.getByRole("button", { name: "Accepter l’invitation" });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      await expectNoA11yViolations(container);

      await userEvent.setup().click(screen.getByRole("checkbox"));
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    it("n’envoie rien sans consentement, même quand le formulaire est soumis directement", async () => {
      const environment = createTestEnvironment("koffi");
      const accept = acceptingWith({ status: "accepted" });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, withSource(environment, { acceptTenantInvitation: accept }));
      const button = await screen.findByRole("button", { name: "Accepter l’invitation" });

      await userEvent.setup().click(button);
      const form = button.closest("form");
      if (form === null) throw new Error("Formulaire introuvable");
      fireEvent.submit(form);

      expect(await screen.findByText("Cochez la case pour accepter le rattachement de votre compte.")).toBeTruthy();
      expect(accept).not.toHaveBeenCalled();
    });

    it("accepte l’invitation avec le jeton et le consentement, oublie le jeton et mène à l’espace locataire", async () => {
      const environment = createTestEnvironment("koffi");
      const accept = vi.spyOn(environment.source, "acceptTenantInvitation");
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      await consentAndSubmit();

      expect(await screen.findByRole("heading", { name: "Invitation acceptée" })).toBeTruthy();
      expect(accept).toHaveBeenCalledExactlyOnceWith({ token: KOFFI, consent: true });
      expect(screen.getByRole("link", { name: "Accéder à mon espace locataire" }).getAttribute("href")).toBe("http://localhost:3030/");
      expect(readTenantInvitation()).toBeNull();
    });

    it("rattache un compte sans espace : le profil locataire apparaît", async () => {
      const environment = createTestEnvironment("sans-profil");
      renderWithAuth(<TenantInvitationScreen urlToken={DEMO_TENANT_TOKENS.alex} />, environment);

      await consentAndSubmit();

      await screen.findByRole("heading", { name: "Invitation acceptée" });
      expect(screen.getByText(/Cabinet Delmas Immobilier/)).toBeTruthy();
      expect(await environment.source.listProfiles()).toHaveLength(1);
    });

    it("signale un compte déjà rattaché à l’organisation sans fermer le formulaire", async () => {
      renderWithAuth(<TenantInvitationScreen urlToken={DEMO_TENANT_TOKENS.marc} />, createTestEnvironment("marc"));

      await consentAndSubmit();

      expect(await screen.findByText(/déjà rattaché à une autre fiche chez Gestion Les Tilleuls/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Accepter l’invitation" })).toBeTruthy();
    });
  });

  describe("erreurs à l’acceptation", () => {
    const cases: [string, TenantInvitationAcceptance | Error, RegExp][] = [
      ["409 fiche déjà rattachée", { status: "party_already_linked" }, /déjà rattaché à un autre compte/],
      ["422 consentement", { status: "consent_required" }, /Acceptez le rattachement de votre compte/],
      ["429", { status: "rate_limited", retryAfterSeconds: 90 }, /Réessayez dans 2 minutes/],
      ["serveur injoignable", new ApiUnreachableError(), /Le serveur est injoignable/],
      ["panne serveur", new Error("boom"), /Votre invitation reste valable : réessayez/],
    ];

    it.each(cases)("%s : message utile et formulaire conservé", async (_label, result, expected) => {
      const environment = withSource(createTestEnvironment("koffi"), { acceptTenantInvitation: acceptingWith(result) });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      await consentAndSubmit();

      expect(await screen.findByText(expected)).toBeTruthy();
      expect(screen.queryByText("Une erreur est survenue.")).toBeNull();
      expect(readTenantInvitation()).toBe(KOFFI);
    });

    it("404 : bascule sur le message unique et oublie le jeton", async () => {
      const environment = withSource(createTestEnvironment("koffi"), { acceptTenantInvitation: acceptingWith({ status: "invalid" }) });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      await consentAndSubmit();

      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      await waitFor(() => { expect(readTenantInvitation()).toBeNull(); });
    });

    it("403 adresse différente : propose de changer de compte", async () => {
      const environment = withSource(createTestEnvironment("koffi"), { acceptTenantInvitation: acceptingWith({ status: "email_mismatch" }) });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      await consentAndSubmit();

      expect(await screen.findByText("Invitation destinée à une autre adresse")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Me déconnecter et changer de compte" })).toBeTruthy();
    });

    it("403 adresse non vérifiée : propose de confirmer l’adresse", async () => {
      const environment = withSource(createTestEnvironment("koffi"), { acceptTenantInvitation: acceptingWith({ status: "email_unverified" }) });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      await consentAndSubmit();

      expect(await screen.findByText("Confirmez votre adresse e-mail")).toBeTruthy();
    });

    it("401 : revient à la connexion quand la session a disparu", async () => {
      const environment = createTestEnvironment("koffi");
      const overridden = withSource(environment, { acceptTenantInvitation: vi.fn(() => { environment.store.write(null); return Promise.resolve({ status: "unauthenticated" as const }); }) });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, overridden);

      await consentAndSubmit();

      expect(await screen.findByRole("link", { name: "Me connecter" })).toBeTruthy();
    });
  });

  describe("aperçu", () => {
    it("adresse différente : explique et permet de se déconnecter en gardant l’invitation", async () => {
      const environment = createTestEnvironment("marc");
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      expect(await screen.findByText("Invitation destinée à une autre adresse")).toBeTruthy();
      expect(screen.getByText("marc.chevalier@example.com")).toBeTruthy();
      await userEvent.setup().click(screen.getByRole("button", { name: "Me déconnecter et changer de compte" }));

      expect(await screen.findByRole("link", { name: "Créer mon compte" })).toBeTruthy();
      expect(environment.store.read()).toBeNull();
      expect(readTenantInvitation()).toBe(KOFFI);
    });

    it("adresse non confirmée : renvoie vers la confirmation puis revérifie", async () => {
      const environment = createTestEnvironment();
      await environment.source.register({ profile: "voyageur", firstName: "Nina", lastName: "Roy", email: "nina@example.com", password: "Mot-De-Passe-2026" });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      const confirm = await screen.findByRole("link", { name: "Confirmer mon adresse" });
      expect(confirm.getAttribute("href")).toBe("/verification-email?suite=%2Finvitation-locataire");

      await environment.source.verifyEmail("valide");
      await userEvent.setup().click(screen.getByRole("button", { name: "J’ai confirmé mon adresse" }));

      expect(await screen.findByText("Invitation destinée à une autre adresse")).toBeTruthy();
    });

    it("panne de l’aperçu : message précis et nouvel essai", async () => {
      const environment = createTestEnvironment("koffi");
      const preview = vi.fn<AuthSource["previewTenantInvitation"]>(() => Promise.reject(new Error("boom")));
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, withSource(environment, { previewTenantInvitation: preview }));

      expect(await screen.findByText("Impossible de vérifier l’invitation")).toBeTruthy();
      await userEvent.setup().click(screen.getByRole("button", { name: "Réessayer" }));
      await waitFor(() => { expect(preview).toHaveBeenCalledTimes(2); });
    });

    it("limitation de débit : indique le délai", async () => {
      const environment = withSource(createTestEnvironment("koffi"), {
        previewTenantInvitation: () => Promise.resolve({ status: "rate_limited", retryAfterSeconds: 45 }),
      });
      renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      expect(await screen.findByText(/Réessayez dans 45 secondes/)).toBeTruthy();
    });
  });

  describe("petits écrans", () => {
    it("n’impose aucune largeur fixe et casse les noms d’organisation très longs", async () => {
      const organisation = "Societe".repeat(12);
      const environment = withSource(createTestEnvironment("koffi"), {
        previewTenantInvitation: () => Promise.resolve({ status: "valid", organizationName: organisation, expiresAt: "2026-11-21T10:00:00.000Z" }),
      });
      const { container } = renderWithAuth(<TenantInvitationScreen urlToken={KOFFI} />, environment);

      await screen.findByRole("button", { name: "Accepter l’invitation" });

      const card = container.querySelector("section[aria-label='Accepter l’invitation']");
      expect(card?.className).toContain("min-w-0");
      expect(card?.className).toContain("max-w-[420px]");
      expect(container.innerHTML).not.toMatch(/\s(min-)?w-\[\d+px\]/);
      const bold = screen.getAllByText(organisation)[0];
      expect(bold?.className).toContain("[overflow-wrap:anywhere]");
      expect(screen.getByRole("checkbox").nextElementSibling?.firstElementChild?.className).toContain("[overflow-wrap:anywhere]");
      expect(screen.getByText(/Votre compte eGuardImmo \(identifiant/).closest("ul")?.className).toContain("[overflow-wrap:anywhere]");
    });
  });
});

describe("EmailVerifieScreen avec une invitation locataire en attente", () => {
  it("renvoie vers la connexion en reprenant l’invitation", async () => {
    rememberTenantInvitation(KOFFI);
    renderWithAuth(<EmailVerifieScreen />);

    const link = await screen.findByRole("link", { name: "Me connecter et reprendre l’invitation" });
    expect(link.getAttribute("href")).toBe("/connexion?suite=%2Finvitation-locataire");
  });

  it("garde le parcours habituel sans invitation", async () => {
    renderWithAuth(<EmailVerifieScreen />);
    expect((await screen.findByRole("link", { name: "Me connecter" })).getAttribute("href")).toBe("/connexion");
  });
});
