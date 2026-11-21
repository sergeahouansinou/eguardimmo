import { ApiUnreachableError } from "@eguardimmo/api";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import type { TestEnvironment } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, setLocation } from "../../../test/navigation";
import { DEMO_OWNER_CODES, DEMO_OWNER_TOKENS } from "@/features/auth/demoOwnerInvitations";
import type { AuthSource, OwnerInvitationAcceptance } from "@/features/auth/source";
import { EmailVerifieScreen } from "@/features/connexion/StatusScreens";
import { readOwnerInvitation, rememberOwnerInvitation } from "@/lib/ownerInvitationIntent";
import { OwnerInvitationScreen } from "./OwnerInvitationScreen";

const ALEX = DEMO_OWNER_TOKENS.alex;
const CODE = DEMO_OWNER_CODES.alex;

function withSource(environment: TestEnvironment, overrides: Partial<AuthSource>): TestEnvironment {
  return { ...environment, source: { ...environment.source, ...overrides } };
}

function acceptingWith(result: OwnerInvitationAcceptance | Error) {
  return vi.fn<AuthSource["acceptOwnerInvitation"]>(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
}

async function typeCode(code: string) {
  const user = userEvent.setup();
  const first = await screen.findByRole("textbox", { name: "Code d’appariement, chiffre 1 sur 6" });
  await user.click(first);
  await user.keyboard(code);
}

async function fillAndSubmit(code: string = CODE) {
  const user = userEvent.setup();
  await typeCode(code);
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Accepter l’invitation" }));
}

const digits = () => screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value).join("");

describe("OwnerInvitationScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation(`/invitation-proprietaire/${ALEX}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("jeton et URL", () => {
    it("retire le jeton de l’URL, le garde en sessionStorage et n’écrit rien dans les journaux", async () => {
      const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />);

      await screen.findByRole("link", { name: "Me connecter" });

      expect(window.location.pathname).toBe("/invitation-proprietaire");
      expect(window.location.href).not.toContain(ALEX);
      expect(readOwnerInvitation()).toBe(ALEX);
      for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain(ALEX);
    });

    it("reprend le jeton mémorisé quand l’URL n’en porte plus", async () => {
      rememberOwnerInvitation(ALEX);
      setLocation("/invitation-proprietaire");
      renderWithAuth(<OwnerInvitationScreen urlToken={null} />, createTestEnvironment("sans-profil"));

      expect(await screen.findByRole("heading", { name: "Rattacher mon compte à mon mandat" })).toBeTruthy();
    });

    it("refuse un jeton mal formé sans appeler le serveur ni le mémoriser", async () => {
      const environment = createTestEnvironment("sans-profil");
      const preview = vi.fn<AuthSource["previewOwnerInvitation"]>(() => Promise.resolve({ status: "invalid" }));
      renderWithAuth(<OwnerInvitationScreen urlToken="trop-court" />, withSource(environment, { previewOwnerInvitation: preview }));

      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      expect(preview).not.toHaveBeenCalled();
      expect(readOwnerInvitation()).toBeNull();
    });

    it("affiche un seul message pour un jeton expiré, inconnu ou bloqué, et oublie le jeton", async () => {
      const expired = renderWithAuth(<OwnerInvitationScreen urlToken={DEMO_OWNER_TOKENS.expiree} />, createTestEnvironment("sans-profil"));
      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      const message = screen.getByText(/invalide, expirée ou déjà utilisée/).textContent;
      await waitFor(() => { expect(readOwnerInvitation()).toBeNull(); });
      expired.unmount();

      renderWithAuth(<OwnerInvitationScreen urlToken={"Inconnu".padEnd(48, "0")} />, createTestEnvironment("sans-profil"));
      await screen.findByText("Invitation invalide");
      expect(screen.getByText(/invalide, expirée ou déjà utilisée/).textContent).toBe(message);
    });
  });

  describe("sans session", () => {
    it("propose de se connecter ou de créer un compte en gardant l’intention, sans jeton dans les liens", async () => {
      const { container } = renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />);

      const login = await screen.findByRole("link", { name: "Me connecter" });
      const signUp = screen.getByRole("link", { name: "Créer mon compte" });
      expect(login.getAttribute("href")).toBe("/connexion?suite=%2Finvitation-proprietaire");
      expect(signUp.getAttribute("href")).toBe("/inscription?suite=%2Finvitation-proprietaire");
      for (const link of [login, signUp]) expect(link.getAttribute("href")).not.toContain(ALEX);
      await expectNoA11yViolations(container);
    });
  });

  describe("appariement", () => {
    it("affiche l’agence, le rôle, l’expiration et le consentement, bouton inactif sans code ni case", async () => {
      const { container } = renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, createTestEnvironment("sans-profil"));

      expect(await screen.findByRole("heading", { name: "Rattacher mon compte à mon mandat" })).toBeTruthy();
      expect(screen.getAllByText(/Cabinet Delmas Immobilier/).length).toBeGreaterThan(1);
      expect(screen.getAllByText(/en tant que propriétaire mandant/).length).toBeGreaterThan(0);
      expect(screen.getByText(/valable jusqu’au 21\/11\/2026/)).toBeTruthy();
      expect(screen.getByText("sans-profil@example.com")).toBeTruthy();
      const button = screen.getByRole<HTMLButtonElement>("button", { name: "Accepter l’invitation" });
      expect(button.disabled).toBe(true);
      await expectNoA11yViolations(container);

      await typeCode(CODE);
      expect(button.disabled).toBe(true);
      await userEvent.setup().click(screen.getByRole("checkbox"));
      expect(button.disabled).toBe(false);
    });

    it("n’envoie rien sans code ni consentement, même quand le formulaire est soumis directement", async () => {
      const environment = createTestEnvironment("sans-profil");
      const accept = acceptingWith({ status: "accepted", role: "holder" });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, withSource(environment, { acceptOwnerInvitation: accept }));
      const button = await screen.findByRole("button", { name: "Accepter l’invitation" });

      const form = button.closest("form");
      if (form === null) throw new Error("Formulaire introuvable");
      fireEvent.submit(form);

      expect(await screen.findByText("Saisissez les 6 chiffres du code remis par votre agence.")).toBeTruthy();
      expect(await screen.findByText("Cochez la case pour accepter le rattachement de votre compte.")).toBeTruthy();
      expect(accept).not.toHaveBeenCalled();
    });

    it("accepte avec jeton, code et consentement, oublie le jeton et mène à l’espace propriétaire", async () => {
      const environment = createTestEnvironment("sans-profil");
      const accept = vi.spyOn(environment.source, "acceptOwnerInvitation");
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      await fillAndSubmit();

      expect(await screen.findByRole("heading", { name: "Invitation acceptée" })).toBeTruthy();
      expect(accept).toHaveBeenCalledExactlyOnceWith({ token: ALEX, code: CODE, consent: true });
      expect(screen.getByRole("link", { name: "Accéder à mon espace propriétaire" }).getAttribute("href")).toBe("http://localhost:3020/confie");
      expect(readOwnerInvitation()).toBeNull();
      expect(await environment.source.listProfiles()).toHaveLength(1);
    });

    it("ne stocke ni n’affiche le code après l’acceptation, et ne le journalise pas", async () => {
      const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
      const { container } = renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, createTestEnvironment("sans-profil"));

      await fillAndSubmit();
      await screen.findByRole("heading", { name: "Invitation acceptée" });

      expect(container.textContent).not.toContain(CODE);
      expect(JSON.stringify(Object.entries(window.sessionStorage))).not.toContain(CODE);
      expect(JSON.stringify(Object.entries(window.localStorage))).not.toContain(CODE);
      for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain(CODE);
    });

    it("code faux : message utile, champ vidé, formulaire conservé et jeton gardé", async () => {
      const { client } = renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, createTestEnvironment("sans-profil"));

      await fillAndSubmit("000000");

      expect(await screen.findByText(/Le code d’appariement est incorrect/)).toBeTruthy();
      expect(digits()).toBe("");
      expect(screen.getByRole("button", { name: "Accepter l’invitation" })).toBeTruthy();
      expect(readOwnerInvitation()).toBe(ALEX);
      expect(document.body.textContent).not.toMatch(/essais? restants?/i);
      expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain("000000");
    });

    it("cinquième code faux : l’invitation bloquée bascule sur le message unique", async () => {
      const environment = createTestEnvironment("sans-profil");
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await typeCode("000000");
        if (attempt === 0) await userEvent.setup().click(screen.getByRole("checkbox"));
        await userEvent.setup().click(screen.getByRole("button", { name: "Accepter l’invitation" }));
        await waitFor(() => { expect(digits()).toBe(""); });
      }

      await typeCode(CODE);
      await userEvent.setup().click(screen.getByRole("button", { name: "Accepter l’invitation" }));

      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      await waitFor(() => { expect(readOwnerInvitation()).toBeNull(); });
    });
  });

  describe("erreurs à l’acceptation", () => {
    const cases: [string, OwnerInvitationAcceptance | Error, RegExp][] = [
      ["409 accès déjà accordé", { status: "already_linked" }, /déjà rattaché à ce mandat/],
      ["409 plafond atteint", { status: "limit_reached" }, /ne peut plus rattacher de compte/],
      ["422 consentement", { status: "consent_required" }, /Acceptez le rattachement de votre compte/],
      ["429", { status: "rate_limited", retryAfterSeconds: 90 }, /Réessayez dans 2 minutes/],
      ["serveur injoignable", new ApiUnreachableError(), /Le serveur est injoignable/],
      ["panne serveur ou code inconnu", new Error("boom"), /Votre invitation reste valable : réessayez/],
    ];

    it.each(cases)("%s : message utile et formulaire conservé", async (_label, result, expected) => {
      const environment = withSource(createTestEnvironment("sans-profil"), { acceptOwnerInvitation: acceptingWith(result) });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      await fillAndSubmit();

      expect(await screen.findByText(expected)).toBeTruthy();
      expect(readOwnerInvitation()).toBe(ALEX);
      expect(digits()).toBe("");
    });

    it("404 : bascule sur le message unique et oublie le jeton", async () => {
      const environment = withSource(createTestEnvironment("sans-profil"), { acceptOwnerInvitation: acceptingWith({ status: "invalid" }) });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      await fillAndSubmit();

      expect(await screen.findByText("Invitation invalide")).toBeTruthy();
      await waitFor(() => { expect(readOwnerInvitation()).toBeNull(); });
    });

    it("403 adresse différente : propose de changer de compte", async () => {
      const environment = withSource(createTestEnvironment("sans-profil"), { acceptOwnerInvitation: acceptingWith({ status: "email_mismatch" }) });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      await fillAndSubmit();

      expect(await screen.findByText("Invitation destinée à une autre adresse")).toBeTruthy();
    });

    it("403 adresse non vérifiée : propose de confirmer l’adresse", async () => {
      const environment = withSource(createTestEnvironment("sans-profil"), { acceptOwnerInvitation: acceptingWith({ status: "email_unverified" }) });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      await fillAndSubmit();

      expect(await screen.findByText("Confirmez votre adresse e-mail")).toBeTruthy();
    });

    it("401 : revient à la connexion quand la session a disparu", async () => {
      const environment = createTestEnvironment("sans-profil");
      const overridden = withSource(environment, { acceptOwnerInvitation: vi.fn(() => { environment.store.write(null); return Promise.resolve({ status: "unauthenticated" as const }); }) });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, overridden);

      await fillAndSubmit();

      expect(await screen.findByRole("link", { name: "Me connecter" })).toBeTruthy();
    });
  });

  describe("aperçu", () => {
    it("adresse différente : explique et permet de se déconnecter en gardant l’invitation", async () => {
      const environment = createTestEnvironment("koffi");
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      expect(await screen.findByText("Invitation destinée à une autre adresse")).toBeTruthy();
      await userEvent.setup().click(screen.getByRole("button", { name: "Me déconnecter et changer de compte" }));

      expect(await screen.findByRole("link", { name: "Créer mon compte" })).toBeTruthy();
      expect(readOwnerInvitation()).toBe(ALEX);
    });

    it("adresse non confirmée : renvoie vers la confirmation", async () => {
      const environment = createTestEnvironment();
      await environment.source.register({ profile: "voyageur", firstName: "Nina", lastName: "Roy", email: "nina@example.com", password: "Mot-De-Passe-2026" });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      const confirm = await screen.findByRole("link", { name: "Confirmer mon adresse" });
      expect(confirm.getAttribute("href")).toBe("/verification-email?suite=%2Finvitation-proprietaire");
    });

    it("panne de l’aperçu : message précis et nouvel essai", async () => {
      const preview = vi.fn<AuthSource["previewOwnerInvitation"]>(() => Promise.reject(new Error("boom")));
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, withSource(createTestEnvironment("sans-profil"), { previewOwnerInvitation: preview }));

      expect(await screen.findByText("Impossible de vérifier l’invitation")).toBeTruthy();
      await userEvent.setup().click(screen.getByRole("button", { name: "Réessayer" }));
      await waitFor(() => { expect(preview).toHaveBeenCalledTimes(2); });
    });

    it("limitation de débit : indique le délai", async () => {
      const environment = withSource(createTestEnvironment("sans-profil"), {
        previewOwnerInvitation: () => Promise.resolve({ status: "rate_limited", retryAfterSeconds: 45 }),
      });
      renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      expect(await screen.findByText(/Réessayez dans 45 secondes/)).toBeTruthy();
    });
  });

  describe("petits écrans", () => {
    it("n’impose aucune largeur fixe et casse les noms d’agence très longs", async () => {
      const organisation = "Societe".repeat(12);
      const environment = withSource(createTestEnvironment("sans-profil"), {
        previewOwnerInvitation: () => Promise.resolve({ status: "valid", organizationName: organisation, role: "co_owner", expiresAt: "2026-11-21T10:00:00.000Z" }),
      });
      const { container } = renderWithAuth(<OwnerInvitationScreen urlToken={ALEX} />, environment);

      await screen.findByRole("button", { name: "Accepter l’invitation" });

      const card = container.querySelector("section[aria-label='Accepter l’invitation']");
      expect(card?.className).toContain("min-w-0");
      expect(container.innerHTML).not.toMatch(/\s(min-)?w-\[\d+px\]/);
      expect(screen.getAllByText(organisation)[0]?.className).toContain("[overflow-wrap:anywhere]");
      expect(screen.getByText(/Votre compte eGuardImmo \(identifiant/).closest("ul")?.className).toContain("[overflow-wrap:anywhere]");
      expect(screen.getAllByText(/en tant que co-indivisaire \(lecture seule\)/).length).toBeGreaterThan(0);
    });
  });
});

describe("EmailVerifieScreen avec une invitation propriétaire en attente", () => {
  it("renvoie vers la connexion en reprenant l’invitation propriétaire", async () => {
    rememberOwnerInvitation(ALEX);
    renderWithAuth(<EmailVerifieScreen />);

    const link = await screen.findByRole("link", { name: "Me connecter et reprendre l’invitation" });
    expect(link.getAttribute("href")).toBe("/connexion?suite=%2Finvitation-proprietaire");
    expect(screen.getByText(/espace propriétaire/)).toBeTruthy();
  });
});
