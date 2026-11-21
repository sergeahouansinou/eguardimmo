import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { confieSchema } from "../data/schemas";
import { renderWithSpace } from "../test/render";
import { AccueilScreen } from "./AccueilScreen";
import { DevisScreen } from "./DevisScreen";
import { DocumentsScreen } from "./DocumentsScreen";
import { InformationsModifierScreen } from "./InformationsModifierScreen";
import { MandatFinScreen } from "./MandatFinScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { BienScreen } from "./BienScreen";
import { ReleveScreen } from "./ReleveScreen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/confie",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  push.mockClear();
});

describe("accueil", () => {
  it("affiche les chiffres du mandat et reste accessible", async () => {
    const { container } = renderWithSpace(<AccueilScreen />);
    expect(await screen.findByRole("heading", { name: /Bonjour Marc/ })).toBeTruthy();
    expect(screen.getByText("Apt 12")).toBeTruthy();
    expect(screen.getByText("Studio 4")).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe("fiche d'un bien", () => {
  it("affiche un bien connu et un message pour un identifiant inconnu", async () => {
    const known = renderWithSpace(<BienScreen id="studio-4" />);
    expect(await screen.findByRole("heading", { name: /Studio 4/ })).toBeTruthy();
    known.unmount();
    renderWithSpace(<BienScreen id="zzz" />);
    expect(await screen.findByText("Bien introuvable")).toBeTruthy();
  });
});

describe("validation de devis", () => {
  it("accepter ouvre la confirmation puis applique la décision à la fixture", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<DevisScreen id="fuite-sous-l-evier" />);
    await user.click(await screen.findByRole("button", { name: "Envoyer ma décision" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/380,00/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Accepter le devis" }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith("/confie/interventions/fuite-sous-l-evier"); });
    const data = confieSchema.parse(await source.snapshot());
    expect(data.interventions.find((item) => item.id === "fuite-sous-l-evier")?.status).toBe("quote_accepted");
  });

  it("refuser sans motif bloque l'envoi et n'ouvre pas la confirmation", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<DevisScreen id="fuite-sous-l-evier" />);
    await user.click(await screen.findByRole("radio", { name: /Refuser le devis/ }));
    await user.click(screen.getByRole("button", { name: "Envoyer ma décision" }));
    expect(await screen.findByText(/Indiquez le motif du refus/)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    const data = confieSchema.parse(await source.snapshot());
    expect(data.interventions.find((item) => item.id === "fuite-sous-l-evier")?.status).toBe("quote_pending");
  });

  it("refuser avec un motif enregistre le refus", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<DevisScreen id="fuite-sous-l-evier" />);
    await user.click(await screen.findByRole("radio", { name: /Refuser le devis/ }));
    await user.type(screen.getByRole("textbox", { name: "Motif du refus" }), "Montant trop élevé");
    await user.click(screen.getByRole("button", { name: "Envoyer ma décision" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Refuser le devis" }));
    await waitFor(() => { expect(push).toHaveBeenCalled(); });
    const data = confieSchema.parse(await source.snapshot());
    const intervention = data.interventions.find((item) => item.id === "fuite-sous-l-evier");
    expect(intervention?.status).toBe("quote_refused");
    expect(intervention?.decision?.comment).toBe("Montant trop élevé");
  });
});

describe("demande de fin de mandat", () => {
  it("à l'échéance : confirmation puis demande enregistrée", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<MandatFinScreen />);
    await screen.findByRole("heading", { name: "Demander la fin du mandat" });
    await user.click(screen.getByRole("radio", { name: /À l'échéance du mandat/ }));
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith("/confie/agence/mandat"); });
    const data = confieSchema.parse(await source.snapshot());
    expect(data.mandate.endRequest?.kind).toBe("at_term");
  });
});

describe("fin anticipée", () => {
  it("bloque l'envoi sans date ni motif", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<MandatFinScreen />);
    await screen.findByRole("heading", { name: "Demander la fin du mandat" });
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(await screen.findByText("Indiquez la date de fin souhaitée.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(confieSchema.parse(await source.snapshot()).mandate.endRequest).toBeNull();
  });
});

describe("notifications", () => {
  it("n'enregistre que lorsque une préférence a changé", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<NotificationsScreen />);
    const save = await screen.findByRole<HTMLButtonElement>("button", { name: "Enregistrer mes préférences" });
    expect(save.disabled).toBe(true);
    await user.click(screen.getByRole("switch", { name: "E-mail, Loyer impayé" }));
    expect(save.disabled).toBe(false);
    await user.click(save);
    await waitFor(() => { expect(screen.getByRole("switch", { name: "E-mail, Loyer impayé" }).getAttribute("aria-checked")).toBe("false"); });
    const data = confieSchema.parse(await source.snapshot());
    expect(data.preferences.find((item) => item.id === "impaye")?.email).toBe(false);
    expect((await screen.findByRole<HTMLButtonElement>("button", { name: "Enregistrer mes préférences" })).disabled).toBe(true);
  });
});

describe("documents", () => {
  it("filtre par catégorie via les onglets", async () => {
    const user = userEvent.setup();
    renderWithSpace(<DocumentsScreen />);
    expect(await screen.findByText("Avis de taxe foncière 2026")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /Quittances/ }));
    expect(screen.queryByText("Avis de taxe foncière 2026")).toBeNull();
    expect(screen.getAllByText(/Quittance de loyer/).length).toBeGreaterThan(0);
  });
});

describe("modification des informations", () => {
  it("enregistre une adresse modifiée et revient à la fiche", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<InformationsModifierScreen />);
    const city = await screen.findByRole("textbox", { name: /Ville/ });
    await user.clear(city);
    await user.type(city, "Lyon");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith("/confie/informations"); });
    expect(confieSchema.parse(await source.snapshot()).profile.city).toBe("Lyon");
  });

  it("affiche l'erreur de validation et n'enregistre rien", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<InformationsModifierScreen />);
    const postal = await screen.findByRole("textbox", { name: /Code postal/ });
    await user.clear(postal);
    await user.type(postal, "69");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/5 chiffres/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(confieSchema.parse(await source.snapshot()).profile.postalCode).toBe("69300");
  });
});

describe("relevé de compte de démonstration", () => {
  const cell = (row: HTMLElement | undefined, header: string) => row?.querySelector(`td[data-label="${header}"]`)?.textContent.replace(/\s/g, " ");

  it("présente le mois en cours avec les soldes et les mouvements calculés sur les reversements", async () => {
    const { container } = renderWithSpace(<ReleveScreen />);

    const table = await screen.findByRole("table", { name: "Relevé de compte du 01/11/2026 au 30/11/2026" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(screen.getByRole("region", { name: "Solde au 01/11/2026, avant mouvements" })).getByText("1 150,00 €")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Solde au 30/11/2026" })).getByText("700,00 €")).toBeTruthy();
    expect([cell(rows[1], "Crédit"), cell(rows[1], "Solde")]).toEqual(["700,00 €", "1 850,00 €"]);
    expect([cell(rows[2], "Débit"), cell(rows[3], "Débit"), cell(rows[3], "Solde")]).toEqual(["80,50 €", "1 069,50 €", "700,00 €"]);
    expect(screen.getByRole("link", { name: "Accueil" }).getAttribute("href")).toBe("/confie");
    await expectNoA11yViolations(container);
  });

  it("recalcule le relevé pour une autre période et refuse une période incohérente", async () => {
    const user = userEvent.setup();
    renderWithSpace(<ReleveScreen />);
    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText("Du"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-12-31" } });
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    expect(await screen.findByText("Aucun mouvement sur cette période")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Solde au 31/12/2026" })).getByText("700,00 €")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-11-01" } });
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));
    expect((await screen.findByRole("alert")).textContent).toContain("La date de fin ne peut pas précéder celle de début.");
  });
});
