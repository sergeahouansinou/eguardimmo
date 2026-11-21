import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderScreen } from "../../../test/render";
import { router, resetNavigation } from "../../../test/navigation";
import { createDemoSource } from "@/features/source";
import { createEquipeDemo } from "./demo";
import { EquipePage } from "./EquipePage";
import { InvitationPage } from "./InvitationPage";
import { RolesPage } from "./RolesPage";
import { INVITABLE_ROLE_IDS, RIGHTS, ROLE_IDS, ROLE_SUMMARIES, rightsOfRole } from "./rights";
import { equipeOverviewSchema } from "./schemas";
import { seatMessage } from "./seats";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

function cappedSource() {
  const equipe = createEquipeDemo();
  equipe.setSeatPlan({ name: "Silver", seats: 5 });
  return { ...createDemoSource(), equipe };
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("rowheader", { name: new RegExp(name) }).closest("tr");
  if (!row) throw new Error(`Ligne introuvable : ${name}`);
  return row;
}

async function cancelPendingInvitation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Modifier Mathieu Garnier" }));
  await user.click(await screen.findByRole("button", { name: "Annuler l'invitation" }));
  await user.click(await screen.findByRole("button", { name: "Annuler l'invitation", hidden: false }));
}

describe("Équipe", () => {
  it("affiche les cinq collaborateurs de la maquette et le message de places", async () => {
    const { container } = renderScreen(<EquipePage />);
    expect(await screen.findByRole("heading", { name: "Équipe" })).toBeTruthy();
    expect(screen.getByText("Formule Gratuit : 4 collaborateurs actifs. Plusieurs collaborateurs inclus.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Tous/ }).textContent).toContain("5");
    expect(screen.getByRole("tab", { name: /Actifs/ }).textContent).toContain("4");
    expect(screen.getByRole("tab", { name: /Invitations/ }).textContent).toContain("1");
    expect(within(rowOf("Sophie Delmas")).getByText("En ligne")).toBeTruthy();
    expect(within(rowOf("Julien Marchand")).getByText("3 mandants")).toBeTruthy();
    expect(within(rowOf("Julien Marchand")).getByText("Aujourd'hui, 08:12")).toBeTruthy();
    expect(within(rowOf("Camille Perrin")).getByText("12/11/2026, 17:40")).toBeTruthy();
    expect(within(rowOf("Léa Fontaine")).getByText("Non activée")).toBeTruthy();
    expect(within(rowOf("Mathieu Garnier")).getByText("Invitation envoyée")).toBeTruthy();
    expect(within(rowOf("Mathieu Garnier")).getByText("Jamais")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Modifier Sophie/ })).toBeNull();
    expect(screen.getByText("1 à 5 sur 5")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filtre par onglet, recherche et rôle", async () => {
    const user = userEvent.setup();
    renderScreen(<EquipePage />);
    await user.click(await screen.findByRole("tab", { name: /Invitations/ }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(1);
    expect(screen.getByRole("rowheader", { name: /Mathieu Garnier/ })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /Tous/ }));
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un collaborateur" }), "perrin");
    expect(screen.getAllByRole("rowheader")).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox", { name: "Rechercher un collaborateur" }));
    await user.click(screen.getByRole("combobox", { name: /Rôle/ }));
    await user.click(screen.getByRole("option", { name: "Gestionnaire" }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(3);
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un collaborateur" }), "zzz");
    expect(screen.getByText("Aucun collaborateur ne correspond à ces filtres.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(5);
  });

  it("modifie le rôle d'un collaborateur", async () => {
    const user = userEvent.setup();
    renderScreen(<EquipePage />);
    await user.click(await screen.findByRole("button", { name: "Modifier Léa Fontaine" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier Léa Fontaine" });
    await user.click(within(dialog).getByRole("combobox", { name: /Rôle/ }));
    await user.click(screen.getByRole("option", { name: /Comptable/ }));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Modifier Léa Fontaine" })).toBeNull();
    });
    expect(within(rowOf("Léa Fontaine")).getByText("Comptable")).toBeTruthy();
  });

  it("exige au moins un mandant pour un gestionnaire au portefeuille choisi", async () => {
    const user = userEvent.setup();
    renderScreen(<EquipePage />);
    await user.click(await screen.findByRole("button", { name: "Modifier Julien Marchand" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier Julien Marchand" });
    for (const name of ["Marc Chevalier", "Famille Bernard", "Hélène Roussel"]) {
      await user.click(within(dialog).getByRole("checkbox", { name: new RegExp(name) }));
    }
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText("Choisissez au moins un mandant.")).toBeTruthy();
    await user.click(within(dialog).getByRole("checkbox", { name: /Nadia Benali/ }));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(within(rowOf("Julien Marchand")).getByText("1 mandant")).toBeTruthy();
    });
  });

  it("désactive un collaborateur après confirmation, puis le réactive", async () => {
    const user = userEvent.setup();
    renderScreen(<EquipePage />);
    await user.click(await screen.findByRole("button", { name: "Modifier Camille Perrin" }));
    await user.click(await screen.findByRole("button", { name: "Désactiver le collaborateur" }));
    const confirm = await screen.findByRole("dialog", { name: "Désactiver ce collaborateur ?" });
    await user.click(within(confirm).getByRole("button", { name: "Désactiver" }));
    await waitFor(() => {
      expect(within(rowOf("Camille Perrin")).getByText("Désactivé")).toBeTruthy();
    });
    expect(screen.getByText(/3 collaborateurs actifs\. Plusieurs collaborateurs inclus/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Modifier Camille Perrin" }));
    await user.click(await screen.findByRole("button", { name: "Réactiver le collaborateur" }));
    await waitFor(() => {
      expect(within(rowOf("Camille Perrin")).getByText("Actif")).toBeTruthy();
    });
  });

  it("annule une invitation en attente et libère la place", async () => {
    const user = userEvent.setup();
    renderScreen(<EquipePage />, cappedSource());
    await cancelPendingInvitation(user);
    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: /Mathieu Garnier/ })).toBeNull();
    });
    expect(screen.getByText("Formule Silver : 4 collaborateurs actifs sur 5. 1 place disponible.")).toBeTruthy();
  });

  it("renvoie une invitation", async () => {
    const user = userEvent.setup();
    renderScreen(<EquipePage />);
    await user.click(await screen.findByRole("button", { name: "Renvoyer l'invitation à Mathieu Garnier" }));
    expect(await screen.findByText("Invitation renvoyée")).toBeTruthy();
  });

  it("affiche une erreur quand le chargement échoue", async () => {
    const source = createDemoSource();
    source.equipe.overview = () => Promise.reject(new Error("panne"));
    renderScreen(<EquipePage />, source);
    expect(await screen.findByText("L'équipe n'a pas pu être chargé")).toBeTruthy();
  });

  it("produit des places conformes à la formule", () => {
    expect(seatMessage({ planName: "Silver", limit: 5, active: 3, pending: 0, used: 3 })).toBe(
      "Formule Silver : 3 collaborateurs actifs sur 5. 2 places disponibles.",
    );
    expect(seatMessage({ planName: "Silver", limit: 5, active: 5, pending: 0, used: 5 })).toBe(
      "Formule Silver : 5 collaborateurs actifs sur 5. Aucune place disponible.",
    );
    expect(seatMessage({ planName: "Silver", limit: 15, active: 4, pending: 1, used: 5 })).toBe(
      "Formule Silver : 4 collaborateurs actifs sur 15. 1 invitation en attente, 10 places disponibles.",
    );
    expect(seatMessage({ planName: "Gold", limit: null, active: 4, pending: 1, used: 5 })).toBe(
      "Formule Gold : 4 collaborateurs actifs. Plusieurs collaborateurs inclus.",
    );
  });
});

describe("Invitation", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, email = "thomas.girard@example.com") {
    await user.type(await screen.findByLabelText("Prénom *"), "Thomas");
    await user.type(screen.getByLabelText("Nom *"), "Girard");
    await user.type(screen.getByLabelText("E-mail *"), email);
  }

  it("valide les champs obligatoires", async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(<InvitationPage />);
    await user.click(await screen.findByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText("Le prénom est obligatoire.")).toBeTruthy();
    expect(screen.getByText("Le nom est obligatoire.")).toBeTruthy();
    expect(screen.getByText("Saisissez une adresse e-mail valide.")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("calcule le panneau des droits depuis la matrice et masque le portefeuille hors gestionnaire", async () => {
    const user = userEvent.setup();
    renderScreen(<InvitationPage />);
    const panel = await screen.findByRole("region", { name: "Droits du rôle" });
    expect(within(panel).getByText("Reversements : validation, exécution, apports, clôture, export").parentElement?.textContent).toContain("Aucun");
    expect(within(panel).getByText("Honoraires et reversements : lecture et préparation").parentElement?.textContent).toContain("Préparation");
    expect(screen.getByText(/Double authentification exigée si l'agence l'impose/)).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Comptable/ }));
    expect(within(panel).getByText("Reversements : validation, exécution, apports, clôture, export").parentElement?.textContent).toContain("Modifier, 2FA");
    expect(screen.getByText("Ce rôle voit tout le portefeuille, dans la limite de ses droits.")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Administrateur/ }));
    expect(screen.getByText("Double authentification obligatoire pour ce rôle.")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Assistante/ })).toBeNull();
  });

  it("refuse l'invitation quand la formule est complète, avec un lien vers l'abonnement", async () => {
    const user = userEvent.setup();
    renderScreen(<InvitationPage />, cappedSource());
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText(/La formule Silver est complète \(5 collaborateurs sur 5\)/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les formules" }).getAttribute("href")).toBe("/compte/abonnement");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("refuse une adresse déjà membre de l'équipe", async () => {
    const user = userEvent.setup();
    renderScreen(<InvitationPage />);
    await fill(user, "Julien.Marchand@example.com");
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    expect(await screen.findByText("Cette adresse e-mail appartient déjà à l'équipe.")).toBeTruthy();
  });

  it("envoie l'invitation une fois une place libérée et redirige vers l'équipe", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    await source.equipe.cancelInvitation("mathieu-garnier");
    renderScreen(<InvitationPage />, source);
    await fill(user);
    await user.click(screen.getByRole("radio", { name: "Mandants choisis" }));
    await user.click(screen.getByRole("checkbox", { name: /SCI Les Acacias/ }));
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/equipe");
    });
    const overview = equipeOverviewSchema.parse(await source.equipe.overview());
    const created = overview.members.find((member) => member.email === "thomas.girard@example.com");
    expect(created).toMatchObject({ id: "thomas-girard", status: "invited", role: "gestionnaire", portfolioLabel: "1 mandant", twoFactor: "at_acceptance" });
    expect(overview.seats).toMatchObject({ active: 4, pending: 1, used: 5 });
  });

  it("revalide les entrées côté démo-serveur", async () => {
    const source = createDemoSource();
    await expect(source.equipe.invite({ firstName: "", lastName: "X", email: "pas-un-mail", role: "titulaire", portfolioMode: "all", mandantIds: [], message: "" })).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(source.equipe.updateMember({ id: "sophie-delmas", role: "comptable", portfolioMode: "all", mandantIds: [] })).rejects.toMatchObject({ code: "forbidden" });
  });
});

function cellsOf(table: HTMLElement, label: string): (string | null)[] {
  const line = within(table).getByRole("rowheader", { name: new RegExp(label) }).closest("tr");
  if (!line) throw new Error(`Ligne introuvable : ${label}`);
  return within(line).getAllByRole("cell").map((cell) => cell.textContent);
}

describe("Rôles et droits", () => {
  it("affiche la matrice du serveur avec la colonne administrateur et sans assistante", async () => {
    const { container } = renderScreen(<RolesPage />);
    expect(await screen.findByRole("heading", { name: "Rôles et droits" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Matrice des droits" });
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Droit", "Titulaire", "Administrateur", "Gestionnaire", "Comptable"]);
    expect(within(table).queryByText("Assistante")).toBeNull();
    expect(within(table).getAllByRole("rowheader")).toHaveLength(RIGHTS.length);
    expect(screen.getByRole("link", { name: "Voir l'équipe" }).getAttribute("href")).toBe("/equipe");
    expect(screen.getByRole("link", { name: "Inviter un collaborateur" }).getAttribute("href")).toBe("/equipe/invitation");
    await expectNoA11yViolations(container);
  });

  it("corrige les huit domaines contredits par les routes", async () => {
    renderScreen(<RolesPage />);
    const table = await screen.findByRole("table", { name: "Matrice des droits" });
    expect(cellsOf(table, "Honoraires et reversements : lecture")).toEqual(["Préparation", "Préparation", "Préparation", "Préparation"]);
    expect(cellsOf(table, "Reversements : validation")).toEqual(["Modifier, 2FA", "Modifier, 2FA", "Aucun", "Modifier, 2FA"]);
    expect(cellsOf(table, "Comptes rendus : publication")).toEqual(["Modifier", "Modifier", "Modifier", "Aucun"]);
    expect(cellsOf(table, "Messages aux locataires")).toEqual(["Modifier", "Modifier", "Modifier", "Aucun"]);
    expect(cellsOf(table, "Interventions et devis")).toEqual(["Modifier", "Modifier", "Modifier", "Lecture"]);
    expect(cellsOf(table, "Factures de prestataires")).toEqual(["Modifier", "Modifier", "Modifier", "Modifier"]);
    expect(cellsOf(table, "Règlements de prestataires")).toEqual(["Modifier, 2FA", "Modifier, 2FA", "Aucun", "Modifier, 2FA"]);
    expect(cellsOf(table, "Conformité")).toEqual(["Modifier", "Modifier", "Modifier", "Lecture"]);
    expect(cellsOf(table, "Équipe, identité")).toEqual(["Modifier", "Modifier", "Lecture", "Lecture"]);
    expect(cellsOf(table, "Saisie d'un encaissement")).toEqual(["Modifier", "Modifier", "Modifier", "Modifier"]);
    expect(cellsOf(table, "Banque et rapprochement")).toEqual(["Modifier, 2FA", "Modifier, 2FA", "Aucun", "Modifier, 2FA"]);
    expect(cellsOf(table, "Grand livre")).toEqual(["Lecture", "Lecture", "Aucun", "Lecture"]);
  });

  it("donne à l'administrateur les mêmes droits qu'au titulaire, clôture comprise", () => {
    expect(RIGHTS.every((right) => right.levels.administrateur === right.levels.titulaire)).toBe(true);
    const closing = RIGHTS.find((right) => right.id === "reversements-execution");
    expect(closing?.levels.administrateur).toBe("write_two_factor");
    expect(Object.values(ROLE_SUMMARIES).join(" ")).not.toMatch(/sauf/i);
  });

  it("ne donne au gestionnaire que la préparation des reversements et aucun accès à la banque", () => {
    const levels = rightsOfRole("gestionnaire", ["reversements-preparation", "reversements-execution", "banque", "grand-livre"]).map((right) => right.level);
    expect(levels).toEqual(["prepare", "none", "none", "none"]);
  });

  it("limite le rôle administrateur invitable et supprime l'assistante", () => {
    expect([...INVITABLE_ROLE_IDS]).toEqual(["administrateur", "gestionnaire", "comptable"]);
    expect([...ROLE_IDS]).not.toContain("assistante");
  });
});
