import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderScreen } from "../../../test/render";
import { resetNavigation } from "../../../test/navigation";
import { createDemoSource } from "@/features/source";
import { ConformitePage } from "./ConformitePage";
import { PieceDetailPage } from "./PieceDetailPage";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

const textOf = (element: HTMLElement) => element.textContent;

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Élément absent à l’index ${String(index)}`);
  return item;
}

beforeEach(() => {
  resetNavigation();
});

function pdf(name = "kbis-2026.pdf", size = 2048) {
  return new File([new Uint8Array(size).fill(1)], name, { type: "application/pdf" });
}

async function pickOption(user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("liste de conformité", () => {
  it("affiche les statistiques, l’alerte et les pièces calculées", async () => {
    const { container } = renderScreen(<ConformitePage />);
    expect(await screen.findByRole("heading", { name: "Conformité" })).toBeTruthy();
    expect(screen.getByText("Assurance responsabilité civile professionnelle, à renouveler")).toBeTruthy();
    expect(textOf(screen.getByRole("region", { name: "Pièces suivies" }))).toContain("5toutes déposées");
    expect(textOf(screen.getByRole("region", { name: "Valides" }))).toContain("4dont la carte professionnelle");
    expect(textOf(screen.getByRole("region", { name: "À renouveler" }))).toContain("1Assurance RCP");
    expect(textOf(screen.getByRole("region", { name: "Prochaine échéance" }))).toContain("31/12/2026dans 48 jours");
    const rows = within(screen.getByRole("table", { name: "Pièces de conformité" })).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(within(at(rows, 3)).getByText("48 jours")).toBeTruthy();
    expect(within(at(rows, 3)).getByText("À renouveler")).toBeTruthy();
    expect(within(at(rows, 1)).getByText("19 mois")).toBeTruthy();
    expect(screen.getByText("90, 30 et 7 jours avant l’échéance")).toBeTruthy();
    expect(screen.getByText("Sophie Delmas, Camille Perrin")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir Assurance RCP" }).getAttribute("href")).toBe("/conformite/assurance-rcp");
    await expectNoA11yViolations(container);
  });

  it("ajoute une pièce avec un justificatif valide", async () => {
    const user = userEvent.setup();
    renderScreen(<ConformitePage />);
    await user.click(await screen.findByRole("button", { name: "Ajouter une pièce" }));
    const dialog = await screen.findByRole("dialog", { name: "Ajouter une pièce" });
    await pickOption(user, /Type de pièce/, "Extrait Kbis");
    await user.type(within(dialog).getByLabelText("Référence"), "KBIS-2026-0412");
    await user.type(within(dialog).getByLabelText("Date d’échéance"), "2027-02-12");
    await user.upload(within(dialog).getByLabelText("Parcourir"), pdf());
    expect(within(dialog).getByText("kbis-2026.pdf")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Ajouter la pièce" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(await screen.findByText("Pièces suivies")).toBeTruthy();
    await waitFor(() => {
      expect(textOf(screen.getByRole("region", { name: "Pièces suivies" }))).toContain("6toutes déposées");
    });
    const table = within(screen.getByRole("table", { name: "Pièces de conformité" }));
    expect(table.getByRole("rowheader", { name: /Extrait Kbis/ })).toBeTruthy();
    expect(table.getByText("KBIS-2026-0412")).toBeTruthy();
    expect(screen.getByText("Pièce ajoutée")).toBeTruthy();
  });

  it("refuse un formulaire vide et un fichier exécutable", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderScreen(<ConformitePage />);
    await user.click(await screen.findByRole("button", { name: "Ajouter une pièce" }));
    const dialog = await screen.findByRole("dialog", { name: "Ajouter une pièce" });
    await user.click(within(dialog).getByRole("button", { name: "Ajouter la pièce" }));
    expect(await within(dialog).findByText("Choisissez le type de pièce.")).toBeTruthy();
    expect(within(dialog).getByText("Saisissez la référence de la pièce.")).toBeTruthy();
    expect(within(dialog).getByText("Saisissez une date valide.")).toBeTruthy();
    expect(within(dialog).getByText("Déposez le justificatif de la pièce.")).toBeTruthy();
    await user.upload(within(dialog).getByLabelText("Parcourir"), new File(["MZ"], "setup.exe", { type: "application/x-msdownload" }));
    expect(await within(dialog).findByText(/Format non accepté/)).toBeTruthy();
    expect(within(dialog).queryByText("setup.exe")).toBeNull();
  });

  it("modifie les rappels d’échéance", async () => {
    const user = userEvent.setup();
    renderScreen(<ConformitePage />);
    await user.click(await screen.findByRole("button", { name: "Modifier" }));
    const dialog = await screen.findByRole("dialog", { name: "Rappels d’échéance" });
    await user.click(within(dialog).getByRole("checkbox", { name: "7 jours avant" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Camille Perrin" }));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("90 et 30 jours avant l’échéance")).toBeTruthy();
    expect(screen.getByText("Sophie Delmas")).toBeTruthy();
  });

  it("refuse d’enregistrer des rappels sans alerte", async () => {
    const user = userEvent.setup();
    renderScreen(<ConformitePage />);
    await user.click(await screen.findByRole("button", { name: "Modifier" }));
    const dialog = await screen.findByRole("dialog", { name: "Rappels d’échéance" });
    for (const label of ["90 jours avant", "30 jours avant", "7 jours avant"]) {
      await user.click(within(dialog).getByRole("checkbox", { name: label }));
    }
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText("Choisissez au moins une alerte.")).toBeTruthy();
  });
});

describe("fiche d’une pièce", () => {
  it("affiche la carte professionnelle avec ses conditions et propose de renouveler l’assurance", async () => {
    const { container } = renderScreen(<PieceDetailPage id="carte-professionnelle" />);
    expect(await screen.findByRole("heading", { name: "Carte professionnelle" })).toBeTruthy();
    expect(screen.getByText("Transactions et gestion immobilière · valable jusqu’au 30/06/2028")).toBeTruthy();
    const conditions = screen.getByRole("region", { name: "Conditions du renouvellement" });
    expect(within(conditions).getByText("Valable jusqu’au 31/12/2027")).toBeTruthy();
    expect(within(conditions).getByText("Échéance le 31/12/2026")).toBeTruthy();
    expect(within(conditions).getByText("À renouveler")).toBeTruthy();
    expect(within(conditions).getByText("À fournir")).toBeTruthy();
    const renewal = screen.getByRole("region", { name: "Renouvellement" });
    expect(within(renewal).getByText(/à partir du 31\/03\/2028/)).toBeTruthy();
    expect(within(renewal).getByText(/L’assurance RCP doit être renouvelée avant le 31\/12\/2026/)).toBeTruthy();
    expect(within(renewal).getByRole("button", { name: "Renouveler l’assurance RCP" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Conformité" }).getAttribute("href")).toBe("/conformite");
    await expectNoA11yViolations(container);
  });

  it("renouvelle l’assurance RCP et met à jour l’état partout", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    const { unmount } = renderScreen(<PieceDetailPage id="assurance-rcp" />, source);
    await user.click(await screen.findByRole("button", { name: "Renouveler l’assurance RCP" }));
    const dialog = await screen.findByRole("dialog", { name: "Renouveler l’assurance RCP" });
    await user.type(within(dialog).getByLabelText("Nouvelle référence"), "RCP-2027-00412");
    await user.type(within(dialog).getByLabelText("Nouvelle échéance"), "2027-12-31");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer le renouvellement" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText("Mercier Assurances Pro · valable jusqu’au 31/12/2027")).toBeTruthy();
    });
    expect(screen.getByText("RCP-2027-00412")).toBeTruthy();
    expect(screen.getByText("Pièce renouvelée")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Renouveler l’assurance RCP" })).toBeNull();
    unmount();
    renderScreen(<ConformitePage />, source);
    expect(await screen.findByText("Pièces suivies")).toBeTruthy();
    expect(screen.queryByText("Assurance responsabilité civile professionnelle, à renouveler")).toBeNull();
    expect(textOf(screen.getByRole("region", { name: "Valides" }))).toContain("5");
  });

  it("refuse une échéance qui ne suit pas l’échéance actuelle", async () => {
    const user = userEvent.setup();
    renderScreen(<PieceDetailPage id="assurance-rcp" />);
    await user.click(await screen.findByRole("button", { name: "Renouveler l’assurance RCP" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nouvelle référence"), "RCP-2027-00412");
    await user.type(within(dialog).getByLabelText("Nouvelle échéance"), "2026-12-01");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer le renouvellement" }));
    expect(await within(dialog).findByText("La nouvelle échéance doit suivre l’échéance actuelle.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("programme un rappel affiché sur la fiche et dans l’historique", async () => {
    const user = userEvent.setup();
    renderScreen(<PieceDetailPage id="assurance-rcp" />);
    await user.click(await screen.findByRole("button", { name: "Programmer un rappel" }));
    const dialog = await screen.findByRole("dialog", { name: "Programmer un rappel" });
    await user.type(within(dialog).getByLabelText("Date du rappel"), "2026-12-01");
    await user.click(within(dialog).getByRole("button", { name: "Programmer le rappel" }));
    expect((await screen.findAllByText("01/12/2026 · E-mail et notification dans l’application")).length).toBe(2);
    expect(screen.getByText("Rappel programmé", { selector: "b" })).toBeTruthy();
  });

  it("refuse un rappel après l’échéance", async () => {
    const user = userEvent.setup();
    renderScreen(<PieceDetailPage id="assurance-rcp" />);
    await user.click(await screen.findByRole("button", { name: "Programmer un rappel" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Date du rappel"), "2027-02-01");
    await user.click(within(dialog).getByRole("button", { name: "Programmer le rappel" }));
    expect(await within(dialog).findByText("Le rappel doit précéder l’échéance.")).toBeTruthy();
  });

  it("affiche un état introuvable avec retour pour un identifiant inconnu", async () => {
    renderScreen(<PieceDetailPage id="piece-inconnue" />);
    expect(await screen.findByRole("heading", { name: "Pièce introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à la conformité" }).getAttribute("href")).toBe("/conformite");
  });

  it("indique une erreur de chargement", async () => {
    const source = createDemoSource();
    source.conformite.overview = () => Promise.reject(new Error("panne"));
    renderScreen(<ConformitePage />, source);
    expect(await screen.findByText("La conformité n'a pas pu être chargé")).toBeTruthy();
  });
});
