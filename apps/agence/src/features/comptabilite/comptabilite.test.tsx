import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, search } from "../../../test/navigation";
import { OrgApiError } from "@/features/org/errors";
import { renderOrg } from "@/features/org/testRender";
import { AccountsPage } from "./AccountsPage";
import { ComptabiliteSourceProvider } from "./ComptabiliteSourceProvider";
import { createDemoComptabilite } from "./demo";
import { EntriesPage } from "./EntriesPage";
import { EntryDetailPage } from "./EntryDetailPage";
import type { ComptabiliteSource } from "./source";
import { StatementPage } from "./StatementPage";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

function withSource(ui: React.ReactElement, source: ComptabiliteSource = createDemoComptabilite()) {
  return renderOrg(<ComptabiliteSourceProvider source={source}>{ui}</ComptabiliteSourceProvider>);
}

function failing(error: Error): ComptabiliteSource {
  const reject = () => Promise.reject(error);
  return { accounts: reject, entries: reject, entry: reject, leases: reject, statement: reject };
}

beforeEach(() => {
  resetNavigation();
});

describe("plan comptable", () => {
  it("affiche les comptes de démonstration avec leur solde dans le sens normal", async () => {
    const { container } = withSource(<AccountsPage />);
    expect(await screen.findByRole("heading", { name: "Comptabilité" })).toBeTruthy();
    const table = await screen.findByRole("table", { name: "Plan comptable" });
    const creances = within(table).getByRole("row", { name: /Créances locataires/ });
    expect(within(creances).getByText("450,00 €")).toBeTruthy();
    expect(within(table).getByRole("row", { name: /Honoraires/ })).toBeTruthy();
    expect(screen.getByText("Lecture seule")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Écritures" }).getAttribute("href")).toBe("/finances/comptabilite/ecritures");
    await expectNoA11yViolations(container);
  });

  it("annonce un plan vide sans le confondre avec une erreur", async () => {
    withSource(<AccountsPage />, { ...createDemoComptabilite(), accounts: () => Promise.resolve([]) });
    expect(await screen.findByText("Aucun compte")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche l’accès refusé quand le rôle n’a pas la comptabilité", async () => {
    withSource(<AccountsPage />, failing(new OrgApiError("forbidden", "Votre rôle ne permet pas d’accéder à cet écran ou à cette action.", { status: 403 })));
    expect(await screen.findByText("Accès refusé")).toBeTruthy();
  });

  it("distingue une panne d’un résultat vide et propose de réessayer", async () => {
    const user = userEvent.setup();
    const accounts = vi.fn<ComptabiliteSource["accounts"]>().mockRejectedValueOnce(new OrgApiError("unavailable", "Le serveur est injoignable.")).mockResolvedValue([]);
    withSource(<AccountsPage />, { ...createDemoComptabilite(), accounts });
    expect(await screen.findByText(/non vérifiable pour le moment/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Aucun compte")).toBeTruthy();
  });
});

describe("écritures", () => {
  it("liste les écritures de la plus récente à la plus ancienne et charge la suite", async () => {
    const user = userEvent.setup();
    withSource(<EntriesPage />);
    const table = await screen.findByRole("table", { name: "Écritures du grand livre" });
    expect(within(table).getAllByRole("row")).toHaveLength(16);
    await user.click(screen.getByRole("button", { name: "Afficher plus d’écritures" }));
    await waitFor(() => {
      expect(within(screen.getByRole("table", { name: "Écritures du grand livre" })).getAllByRole("row").length).toBeGreaterThan(16);
    });
    expect(screen.getAllByText(/Appel de loyer 2026-09, Thomas Girard/).length).toBeGreaterThan(0);
  });

  it("filtre par journal et réinitialise quand rien ne correspond", async () => {
    const user = userEvent.setup();
    withSource(<EntriesPage />);
    await screen.findByRole("table", { name: "Écritures du grand livre" });
    await user.click(screen.getByRole("combobox", { name: /Journal/ }));
    await user.click(await screen.findByRole("option", { name: "Dépôts de garantie" }));
    expect(await screen.findByText("Aucune écriture pour ces filtres")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }));
    expect(await screen.findByRole("table", { name: "Écritures du grand livre" })).toBeTruthy();
  });

  it("refuse une période inversée sans interroger le serveur", async () => {
    const user = userEvent.setup();
    const source = createDemoComptabilite();
    const entries = vi.spyOn(source, "entries");
    withSource(<EntriesPage />, source);
    await screen.findByRole("table", { name: "Écritures du grand livre" });
    entries.mockClear();
    await user.type(screen.getByLabelText("Du"), "2026-11-10");
    await user.type(screen.getByLabelText("Au"), "2026-11-02");
    expect(await screen.findByText("La date de fin précède la date de début.")).toBeTruthy();
    expect(entries.mock.calls.some(([filters]) => filters.to !== undefined)).toBe(false);
  });

  it("présélectionne le bail transmis dans l’adresse", async () => {
    search.current = new URLSearchParams("bail=b-2026-007");
    const source = createDemoComptabilite();
    const entries = vi.spyOn(source, "entries");
    withSource(<EntriesPage />, source);
    await screen.findByRole("table", { name: "Écritures du grand livre" });
    expect(entries).toHaveBeenCalledWith({ lease: "b-2026-007" }, null);
  });

  it("annonce le grand livre vide et l’accès refusé", async () => {
    const empty = { ...createDemoComptabilite(), entries: () => Promise.resolve({ items: [], nextCursor: null }) };
    const { unmount } = withSource(<EntriesPage />, empty);
    expect(await screen.findByText("Aucune écriture")).toBeTruthy();
    unmount();
    withSource(<EntriesPage />, failing(new OrgApiError("forbidden", "Accès refusé au grand livre.", { status: 403 })));
    expect((await screen.findAllByText("Accès refusé")).length).toBeGreaterThan(0);
  });
});

describe("détail d’une écriture", () => {
  it("affiche les lignes équilibrées et le lien vers le relevé du bail", async () => {
    const source = createDemoComptabilite();
    const first = (await source.entries({ journal: "rent" }, null)).items[0];
    if (first === undefined) throw new Error("Aucune écriture de démonstration.");
    const { container } = withSource(<EntryDetailPage id={first.id} />, source);
    expect(await screen.findByRole("heading", { name: `Écriture ${first.reference}` })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Lignes de l’écriture" });
    expect(within(table).getAllByRole("link", { name: "Relevé du bail" })[0]?.getAttribute("href")).toMatch(/^\/finances\/comptabilite\/releve\?bail=/);
    const footer = within(table).getByRole("row", { name: /Total/ });
    const [debit, credit] = within(footer).getAllByRole("cell").slice(-2);
    expect(debit?.textContent).toBe(credit?.textContent);
    await expectNoA11yViolations(container);
  });

  it("renvoie vers l’écriture d’origine d’une contre-passation", async () => {
    const source = createDemoComptabilite();
    const reversal = (await source.entries({ journal: "adjustments" }, null)).items[0];
    if (reversal === undefined) throw new Error("Aucune contre-passation de démonstration.");
    withSource(<EntryDetailPage id={reversal.id} />, source);
    const link = await screen.findByRole("link", { name: "qu’elle contre-passe" });
    expect(link.getAttribute("href")).toMatch(/^\/finances\/comptabilite\/ecritures\/ecriture-2026-/);
  });

  it("affiche une page introuvable pour une écriture inconnue", async () => {
    withSource(<EntryDetailPage id="inconnue" />);
    expect(await screen.findByRole("heading", { name: "Écriture introuvable" })).toBeTruthy();
  });

  it("affiche l’accès refusé", async () => {
    withSource(<EntryDetailPage id="x" />, failing(new OrgApiError("forbidden", "Accès refusé à l’écriture.", { status: 403 })));
    expect(await screen.findByText("Accès refusé")).toBeTruthy();
  });
});

describe("relevé de bail", () => {
  async function pickLease(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(await screen.findByRole("combobox", { name: /Bail/ }));
    await user.click(await screen.findByRole("option", { name }));
  }

  it("calcule le relevé d’un bail, solde d’ouverture et de clôture compris", async () => {
    const user = userEvent.setup();
    withSource(<StatementPage />);
    await pickLease(user, /Anaïs Roux/);
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    const table = await screen.findByRole("table", { name: "Mouvements du compte locataire" });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(screen.getByText("Reste dû par le locataire")).toBeTruthy();
    const summary = screen.getByRole("region", { name: /Relevé du/ });
    expect(within(summary).getByText("Solde de clôture").nextElementSibling?.textContent.replace(/\s/g, " ")).toBe("+450,00 €");
  });

  it("refuse un formulaire incomplet ou une période inversée", async () => {
    const user = userEvent.setup();
    withSource(<StatementPage />);
    await screen.findByRole("combobox", { name: /Bail/ });
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    expect(await screen.findByText("Choisissez un bail.")).toBeTruthy();
    await pickLease(user, /Thomas Girard/);
    await user.clear(screen.getByLabelText("Au"));
    await user.type(screen.getByLabelText("Au"), "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    expect(await screen.findByText("La date de fin précède la date de début.")).toBeTruthy();
  });

  it("affiche le relevé directement quand le bail est dans l’adresse", async () => {
    search.current = new URLSearchParams("bail=b-2024-018");
    withSource(<StatementPage />);
    expect(await screen.findByRole("table", { name: "Mouvements du compte locataire" })).toBeTruthy();
    expect(screen.getByText("Compte soldé")).toBeTruthy();
  });

  it("annonce une période sans mouvement et un relevé trop long", async () => {
    const user = userEvent.setup();
    const source = createDemoComptabilite();
    const { unmount } = withSource(<StatementPage />, source);
    await pickLease(user, /Thomas Girard/);
    await user.clear(screen.getByLabelText("Du"));
    await user.type(screen.getByLabelText("Du"), "2025-01-01");
    await user.clear(screen.getByLabelText("Au"));
    await user.type(screen.getByLabelText("Au"), "2025-01-31");
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    expect(await screen.findByText("Aucun mouvement sur la période")).toBeTruthy();
    unmount();

    const tooLong = { ...source, statement: () => Promise.reject(new OrgApiError("invalid", "Ce relevé dépasse le nombre de lignes affichables : réduisez la période.", { status: 422 })) };
    withSource(<StatementPage />, tooLong);
    await pickLease(user, /Thomas Girard/);
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    expect(await screen.findByText(/réduisez la période/)).toBeTruthy();
  });

  it("affiche l’accès refusé quand la liste des baux est interdite", async () => {
    withSource(<StatementPage />, failing(new OrgApiError("forbidden", "Accès refusé aux baux.", { status: 403 })));
    expect(await screen.findByText("Accès refusé")).toBeTruthy();
  });
});
