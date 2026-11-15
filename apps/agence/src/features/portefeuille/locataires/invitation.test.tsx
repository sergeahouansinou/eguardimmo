import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation } from "../../../../test/navigation";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, pickOption, renderPortefeuille } from "../testing";
import { InvitationPage } from "./InvitationPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
  vi.unstubAllGlobals();
});

function rowOf(name: string): HTMLElement {
  const table = screen.getByRole("table", { name: "Invitations envoyées" });
  const row = within(table).getByText(name).closest("tr");
  if (!row) throw new Error(`Ligne introuvable : ${name}`);
  return row;
}

describe("suivi des invitations", () => {
  it("liste les invitations avec leur statut du jour", async () => {
    const { container } = renderPortefeuille(<InvitationPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Inviter un locataire" })).toBeTruthy();
    expect(within(rowOf("Inès Laurent")).getByText("En attente")).toBeTruthy();
    expect(within(rowOf("Louis Petit")).getByText("Expirée")).toBeTruthy();
    expect(within(rowOf("Thomas Girard")).getByText("Acceptée")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filtre par statut et annonce l'onglet vide", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<InvitationPage />);
    await user.click(await screen.findByRole("tab", { name: /Acceptées/ }));
    const table = screen.getByRole("table", { name: "Invitations envoyées" });
    expect(within(table).getByText("Thomas Girard")).toBeTruthy();
    expect(within(table).queryByText("Inès Laurent")).toBeNull();
    await user.click(screen.getByRole("tab", { name: /Annulées/ }));
    expect(screen.getByText("Aucune invitation")).toBeTruthy();
  });

  it("renvoie une invitation expirée avec un nouveau délai", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<InvitationPage />, source);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'invitation de Louis Petit" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renvoyer l'invitation" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).invitations.find((item) => item.id === "inv-0002")).toMatchObject({ status: "envoyee", sentIso: "2026-11-13", expiresIso: "2026-11-27" });
    });
    expect(await screen.findByText("Invitation renvoyée")).toBeTruthy();
    await waitFor(() => { expect(within(rowOf("Louis Petit")).getByText("En attente")).toBeTruthy(); });
  });

  it("annule une invitation après confirmation", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<InvitationPage />, source);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'invitation de Inès Laurent" }));
    await user.click(await screen.findByRole("menuitem", { name: "Annuler l'invitation" }));
    const dialog = await screen.findByRole("dialog");
    expect(parsePortefeuille(await source.load()).invitations.find((item) => item.id === "inv-0001")?.status).toBe("envoyee");
    await user.click(within(dialog).getByRole("button", { name: "Conserver" }));
    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(parsePortefeuille(await source.load()).invitations.find((item) => item.id === "inv-0001")?.status).toBe("envoyee");

    await user.click(screen.getByRole("button", { name: "Actions pour l'invitation de Inès Laurent" }));
    await user.click(await screen.findByRole("menuitem", { name: "Annuler l'invitation" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler l'invitation" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).invitations.find((item) => item.id === "inv-0001")?.status).toBe("annulee");
    });
    await waitFor(() => { expect(within(rowOf("Inès Laurent")).getByText("Annulée")).toBeTruthy(); });
  });

  it("copie le lien d'une invitation en attente", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
    renderPortefeuille(<InvitationPage />);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'invitation de Inès Laurent" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copier le lien" }));
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith("https://locataire.eguardimmo.example/invitation/ines-laurent-k3f9a2"); });
    expect(await screen.findByText("Lien copié")).toBeTruthy();
  });

  it("signale l'échec de la copie au lieu de l'avaler", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText: () => Promise.reject(new Error("refusé")) } } }));
    renderPortefeuille(<InvitationPage />);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'invitation de Inès Laurent" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copier le lien" }));
    expect(await screen.findByText("Copie impossible")).toBeTruthy();
  });

  it("ne propose pas de renvoi pour une invitation acceptée", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<InvitationPage />);
    await user.click(await screen.findByRole("button", { name: "Actions pour l'invitation de Thomas Girard" }));
    expect(await screen.findByRole("menuitem", { name: "Voir le bail" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Renvoyer l'invitation" })).toBeNull();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<InvitationPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});

describe("envoi d'une invitation", () => {
  it("exige un bail et un e-mail valides", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<InvitationPage />, source);
    await user.click(await screen.findByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText("Choisissez le bail concerné.")).toBeTruthy();
    expect(screen.getByText(/Saisissez une adresse e-mail valide/)).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: /E-mail du locataire/ }), "pas-un-email");
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText(/Saisissez une adresse e-mail valide/)).toBeTruthy();
    expect(parsePortefeuille(await source.load()).invitations).toHaveLength(3);
  });

  it("exige un message d'au moins 10 caractères", async () => {
    const user = userEvent.setup();
    resetNavigation("bail=b-2026-004");
    renderPortefeuille(<InvitationPage />);
    const message = await screen.findByRole("textbox", { name: /Message d'accompagnement/ });
    await user.clear(message);
    await user.type(message, "Salut");
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText("Rédigez un message d'au moins 10 caractères.")).toBeTruthy();
  });

  it("génère le lien et suit la nouvelle invitation", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderPortefeuille(<InvitationPage />, source);
    await pickOption(user, /Bail concerné/, /B-2026-004, Apt 7/);
    const email = screen.getByRole("textbox", { name: /E-mail du locataire/ });
    expect((email as HTMLInputElement).value).toBe("louis.petit@example.com");
    await user.clear(email);
    await user.type(email, "louis.perso@example.com");
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText("Invitation envoyée à louis.perso@example.com")).toBeTruthy();
    expect(screen.getByText(/^https:\/\/locataire\.eguardimmo\.example\/invitation\/louis-petit-/)).toBeTruthy();
    const stored = parsePortefeuille(await source.load()).invitations.at(-1);
    expect(stored).toMatchObject({ email: "louis.perso@example.com", bailId: "b-2026-004", status: "envoyee", expiresIso: "2026-11-27" });
    await waitFor(() => { expect(within(screen.getByRole("table", { name: "Invitations envoyées" })).getAllByText("Louis Petit")).toHaveLength(2); });
    expect(screen.getByRole("textbox", { name: /E-mail du locataire/ })).toHaveProperty("value", "");
  });

  it("reflète l'e-mail et le message saisis dans l'aperçu", async () => {
    const user = userEvent.setup();
    resetNavigation("bail=b-2026-016");
    renderPortefeuille(<InvitationPage />);
    const preview = await screen.findByRole("group", { name: "Aperçu du message" });
    expect(within(preview).getByText("Bonjour Inès,")).toBeTruthy();
    expect(within(preview).getByText(/Logement : Apt 5, 31 rue Duguesclin/)).toBeTruthy();
    const message = screen.getByRole("textbox", { name: /Message d'accompagnement/ });
    await user.clear(message);
    await user.type(message, "Bienvenue chez nous, activez votre espace.");
    expect(within(preview).getByText("Bienvenue chez nous, activez votre espace.")).toBeTruthy();
  });

  it("refuse une invitation déjà en cours pour le même bail et le même e-mail", async () => {
    const user = userEvent.setup();
    resetNavigation("bail=b-2026-016");
    const source = createDemoSource();
    renderPortefeuille(<InvitationPage />, source);
    await user.click(await screen.findByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText(/Une invitation est déjà en cours pour ines.laurent@example.com/)).toBeTruthy();
    expect(parsePortefeuille(await source.load()).invitations).toHaveLength(3);
  });

  it("n'offre que les locataires sans espace activé", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<InvitationPage />);
    await user.click(await screen.findByRole("combobox", { name: /Bail concerné/ }));
    const list = await screen.findByRole("listbox", { name: /Bail concerné/ });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(within(list).queryByText(/B-2024-018/)).toBeNull();
  });

  it("affiche l'échec de la source", async () => {
    const user = userEvent.setup();
    resetNavigation("bail=b-2026-004");
    const source = { ...createDemoSource(), createInvitation: () => Promise.reject(new Error("Messagerie indisponible")) };
    renderPortefeuille(<InvitationPage />, source);
    const email = await screen.findByRole("textbox", { name: /E-mail du locataire/ });
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText("Messagerie indisponible")).toBeTruthy();
    expect((email as HTMLInputElement).value).toBe("louis.petit@example.com");
  });
});
