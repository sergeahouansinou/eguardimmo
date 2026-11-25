import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";
import { createDemoSource } from "@/features/source";
import { CHANNEL_ITEMS, EVENT_GROUPS } from "./notificationGroups";
import { NotificationsPage } from "./NotificationsPage";
import { ProfilePage } from "./ProfilePage";
import { SecurityPage } from "./SecurityPage";
import { securitySchema } from "./securitySchemas";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

function checked(name: string): string | null {
  return screen.getByRole("switch", { name }).getAttribute("aria-checked");
}

describe("Mon profil", () => {
  it("affiche l'identité, laisse l'e-mail en lecture seule et n'active Enregistrer qu'après modification", async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(<ProfilePage />);
    expect((await screen.findByLabelText<HTMLInputElement>("Prénom *")).value).toBe("Sophie");
    expect(screen.getByLabelText<HTMLInputElement>("Nom *").value).toBe("Delmas");
    expect(screen.getByLabelText<HTMLInputElement>("E-mail *").readOnly).toBe(true);
    expect(screen.getByText("Se modifie dans Connexion et sécurité")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "Rôles et droits" }).getAttribute("href")).toBe("/equipe/roles");
    const nav = screen.getByRole("navigation", { name: "Sections des réglages" });
    expect(within(nav).getByRole("link", { name: "Mon profil" }).getAttribute("aria-current")).toBe("page");
    await user.type(screen.getByLabelText("Fonction"), " associée");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enregistrer" }).disabled).toBe(false);
    await expectNoA11yViolations(container);
  });

  it("enregistre les modifications puis annule les suivantes", async () => {
    const user = userEvent.setup();
    const { source } = renderScreen(<ProfilePage />);
    const firstName = await screen.findByLabelText<HTMLInputElement>("Prénom *");
    await user.clear(firstName);
    await user.type(firstName, "Sophia");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Profil enregistré")).toBeTruthy();
    expect(await source.compte.profile()).toMatchObject({ firstName: "Sophia" });
    await user.type(firstName, "x");
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(firstName.value).toBe("Sophia");
  });

  it("refuse un mobile invalide et un prénom vide", async () => {
    const user = userEvent.setup();
    renderScreen(<ProfilePage />);
    const mobile = await screen.findByLabelText("Téléphone mobile *");
    await user.clear(mobile);
    await user.type(mobile, "abc");
    await user.clear(screen.getByLabelText("Prénom *"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/Saisissez un numéro de mobile valide/)).toBeTruthy();
    expect(screen.getByText("Le prénom est obligatoire.")).toBeTruthy();
  });

  it("retient le nom de la photo choisie et refuse un format interdit", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { source } = renderScreen(<ProfilePage />);
    await screen.findByLabelText("Prénom *");
    await user.upload(screen.getByLabelText("Parcourir"), new File(["x"], "portrait.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      expect(await source.compte.profile()).toMatchObject({ photoName: "portrait.png" });
    });
    await user.upload(screen.getByLabelText("Parcourir"), new File(["x"], "scan.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/Format non accepté/)).toBeTruthy();
    await expect(source.compte.saveProfile({ civility: "mme", firstName: "S", lastName: "D", jobTitle: "", mobile: "+33 6 00 00 00 21", language: "fr", timezone: "Europe/Paris", photoName: "scan.pdf" })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("exporte les données du compte en CSV", async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:demo";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderScreen(<ProfilePage />);
    await user.click(await screen.findByRole("button", { name: "Exporter mes données" }));
    expect(await screen.findByText("Export prêt")).toBeTruthy();
    expect(click).toHaveBeenCalledOnce();
    const text = await blobs[0]?.text();
    expect(text).toContain("Prénom;Sophie");
    expect(text).toContain("E-mail;sophie.delmas@example.com");
    click.mockRestore();
  });

  it("affiche une erreur quand le chargement échoue", async () => {
    const source = createDemoSource();
    source.compte.profile = () => Promise.reject(new Error("panne"));
    renderScreen(<ProfilePage />, source);
    expect(await screen.findByText("Le profil n'a pas pu être chargé")).toBeTruthy();
  });
});

describe("Sécurité", () => {
  it("calcule les règles et l'alerte depuis l'équipe", async () => {
    const { container } = renderScreen(<SecurityPage />);
    expect(await screen.findByText("4 collaborateurs sur 5 l'ont activée")).toBeTruthy();
    expect(screen.getByText("Léa Fontaine n'a pas encore activé la double authentification")).toBeTruthy();
    expect(screen.getByText("Elle devra l'activer à sa prochaine connexion.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir l'équipe" }).getAttribute("href")).toBe("/equipe");
    expect(screen.getByRole("combobox", { name: /Longueur minimale/ }).textContent).toContain("6 caractères");
    expect(screen.getByText("Modifié le 02/09/2026")).toBeTruthy();
    expect(screen.getByText("Application d'authentification · 8 codes de secours")).toBeTruthy();
    expect(screen.getByText("3 appareils, dont cette session")).toBeTruthy();
    expect(screen.getByText("13/11/2026, 08:12")).toBeTruthy();
    expect(screen.getByText("02/11/2026")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Journal de connexion" })).getByText("0")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("retire l'alerte quand le collaborateur sans double authentification est désactivé", async () => {
    const source = createDemoSource();
    await source.equipe.deactivate("lea-fontaine");
    renderScreen(<SecurityPage />, source);
    expect(await screen.findByText("4 collaborateurs sur 4 l'ont activée")).toBeTruthy();
    expect(screen.queryByText(/n'a pas encore activé/)).toBeNull();
  });

  it("modifie les règles de l'agence puis les enregistre", async () => {
    const user = userEvent.setup();
    const { source } = renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("switch", { name: "Double authentification obligatoire" }));
    expect(screen.queryByText(/n'a pas encore activé/)).toBeNull();
    await user.click(screen.getByRole("combobox", { name: /Longueur minimale/ }));
    await user.click(screen.getByRole("option", { name: "14 caractères" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Règles de sécurité enregistrées")).toBeTruthy();
    const overview = securitySchema.parse(await source.compte.security());
    expect(overview.rules).toEqual({ twoFactorRequired: false, minPasswordLength: 14 });
  });

  it("annule les modifications en cours", async () => {
    const user = userEvent.setup();
    renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("switch", { name: "Double authentification obligatoire" }));
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(checked("Double authentification obligatoire")).toBe("true");
  });

  it("applique la longueur minimale de l'agence au changement de mot de passe", async () => {
    const user = userEvent.setup();
    renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("button", { name: "Gérer dans Mon compte" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier le mot de passe" });
    await user.type(within(dialog).getByLabelText("Mot de passe actuel"), "ancien-secret");
    await user.type(within(dialog).getByLabelText("Nouveau mot de passe"), "court");
    await user.type(within(dialog).getByLabelText("Confirmer le nouveau mot de passe"), "autre");
    await user.click(within(dialog).getByRole("button", { name: "Modifier le mot de passe" }));
    expect(await within(dialog).findByText("Le mot de passe doit contenir au moins 6 caractères.")).toBeTruthy();
    expect(within(dialog).getByText("Les deux mots de passe ne correspondent pas.")).toBeTruthy();
    await expectNoA11yViolations(dialog);
  });

  it("change le mot de passe sans le conserver", async () => {
    const user = userEvent.setup();
    const { source } = renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("button", { name: "Gérer dans Mon compte" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier le mot de passe" });
    await user.type(within(dialog).getByLabelText("Mot de passe actuel"), "ancien-secret-1");
    await user.type(within(dialog).getByLabelText("Nouveau mot de passe"), "nouveau-secret-long-2");
    await user.type(within(dialog).getByLabelText("Confirmer le nouveau mot de passe"), "nouveau-secret-long-2");
    await user.click(within(dialog).getByRole("button", { name: "Modifier le mot de passe" }));
    expect(await screen.findByText("Mot de passe modifié")).toBeTruthy();
    expect(await screen.findByText("Modifié le 13/11/2026")).toBeTruthy();
    expect(JSON.stringify(await source.compte.security())).not.toContain("nouveau-secret");
    expect(screen.queryByRole("dialog", { name: "Modifier le mot de passe" })).toBeNull();
  });

  it("accepte un mot de passe de 6 caractères sans composition", async () => {
    const user = userEvent.setup();
    renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("button", { name: "Gérer dans Mon compte" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier le mot de passe" });
    await user.type(within(dialog).getByLabelText("Mot de passe actuel"), "ancien-secret");
    await user.type(within(dialog).getByLabelText("Nouveau mot de passe"), "azerty");
    await user.type(within(dialog).getByLabelText("Confirmer le nouveau mot de passe"), "azerty");
    await user.click(within(dialog).getByRole("button", { name: "Modifier le mot de passe" }));
    expect(await screen.findByText("Mot de passe modifié")).toBeTruthy();
  });

  it("refuse un nouveau mot de passe identique à l'actuel", async () => {
    const user = userEvent.setup();
    renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("button", { name: "Gérer dans Mon compte" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier le mot de passe" });
    await user.type(within(dialog).getByLabelText("Mot de passe actuel"), "meme-secret-long-1");
    await user.type(within(dialog).getByLabelText("Nouveau mot de passe"), "meme-secret-long-1");
    await user.type(within(dialog).getByLabelText("Confirmer le nouveau mot de passe"), "meme-secret-long-1");
    await user.click(within(dialog).getByRole("button", { name: "Modifier le mot de passe" }));
    expect(await within(dialog).findByText("Choisissez un mot de passe différent de l'actuel.")).toBeTruthy();
  });

  it("liste le journal et déconnecte un appareil après confirmation", async () => {
    const user = userEvent.setup();
    renderScreen(<SecurityPage />);
    await user.click(await screen.findByRole("button", { name: "Voir le journal" }));
    const log = await screen.findByRole("dialog", { name: "Journal de connexion" });
    expect(within(log).getAllByRole("rowheader")).toHaveLength(6);
    expect(within(log).getByText("Échec")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Journal de connexion" })).toBeNull();
    });
    await user.click(screen.getByRole("button", { name: "Gérer les appareils" }));
    const devices = await screen.findByRole("dialog", { name: "Appareils connectés" });
    expect(within(devices).queryByRole("button", { name: /MacBook/ })).toBeNull();
    await user.click(within(devices).getByRole("button", { name: "Déconnecter iPad · Safari" }));
    const confirm = await screen.findByRole("dialog", { name: "Déconnecter cet appareil ?" });
    await user.click(within(confirm).getByRole("button", { name: "Déconnecter" }));
    expect(await screen.findByText("Appareil déconnecté")).toBeTruthy();
    expect(await screen.findByText("2 appareils, dont cette session")).toBeTruthy();
  });

  it("refuse de déconnecter la session en cours côté démo-serveur", async () => {
    const source = createDemoSource();
    await expect(source.compte.signOutDevice("macbook-chrome")).rejects.toMatchObject({ code: "forbidden" });
    await expect(source.compte.signOutDevice("inconnu")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("Notifications", () => {
  it("reproduit les treize interrupteurs de la maquette", async () => {
    const { container } = renderScreen(<NotificationsPage />);
    expect(await screen.findByRole("switch", { name: "Loyer impayé" })).toBeTruthy();
    const total = EVENT_GROUPS.flatMap((group) => group.items).length + CHANNEL_ITEMS.length;
    expect(total).toBe(13);
    expect(screen.getAllByRole("switch")).toHaveLength(14);
    expect(checked("Loyer impayé")).toBe("true");
    expect(checked("Encaissement reçu")).toBe("false");
    expect(checked("Accord du mandant")).toBe("false");
    expect(checked("Mobile")).toBe("false");
    expect(checked("E-mail")).toBe("true");
    expect(screen.getByText("sophie.delmas@example.com")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Fréquence/ }).textContent).toContain("Chaque lundi");
    expect(screen.getByText("22:00 à 07:00")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("enregistre un réglage dans le store puis le retrouve", async () => {
    const user = userEvent.setup();
    const { source, unmount } = renderScreen(<NotificationsPage />);
    expect(await screen.findByRole<HTMLButtonElement>("button", { name: "Enregistrer" })).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("switch", { name: "Encaissement reçu" }));
    await user.click(screen.getByRole("combobox", { name: /Fréquence/ }));
    await user.click(screen.getByRole("option", { name: "Chaque jour" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Notifications enregistrées")).toBeTruthy();
    unmount();
    renderScreen(<NotificationsPage />, source);
    expect(await screen.findByRole("switch", { name: "Encaissement reçu" })).toBeTruthy();
    expect(checked("Encaissement reçu")).toBe("true");
    expect(screen.getByRole("combobox", { name: /Fréquence/ }).textContent).toContain("Chaque jour");
  });

  it("annule les modifications non enregistrées", async () => {
    const user = userEvent.setup();
    renderScreen(<NotificationsPage />);
    await user.click(await screen.findByRole("switch", { name: "Loyer impayé" }));
    expect(checked("Loyer impayé")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(checked("Loyer impayé")).toBe("true");
  });

  it("refuse des préférences invalides côté démo-serveur", async () => {
    const source = createDemoSource();
    await expect(source.compte.saveNotifications({ events: {}, channels: {}, digestFrequency: "hourly", quietHours: true })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
