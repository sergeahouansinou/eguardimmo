import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";
import { createDemoSource } from "../source";
import { DevisPage } from "./DevisPage";
import { InterventionFormPage } from "./InterventionFormPage";
import { devisSchema, interventionSchema } from "./schemas";
import type { CreateInterventionInput } from "./schemas";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("création d'une intervention", () => {
  it("valide les champs obligatoires avant l'envoi", async () => {
    const { container } = renderScreen(<InterventionFormPage />);
    await userEvent.click(screen.getByRole("button", { name: "Créer l'intervention" }));
    expect(await screen.findByText("Indiquez le sujet (3 caractères au minimum).")).toBeTruthy();
    expect(screen.getByText("Choisissez le bien concerné.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("crée l'intervention, demande l'accord au-delà du plafond et redirige", async () => {
    const { source } = renderScreen(<InterventionFormPage />);
    await userEvent.type(screen.getByLabelText("Sujet *"), "Volet roulant bloqué");
    await userEvent.click(screen.getByRole("combobox", { name: /Bien/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Studio 4, Marc Chevalier/ }));
    await userEvent.click(screen.getByRole("combobox", { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Urgente" }));
    await userEvent.click(screen.getByRole("combobox", { name: /Intervenant/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Multiservices Azur" }));
    await userEvent.type(screen.getByLabelText("Montant estimé"), "380,00");
    expect(screen.getByText("Accord du mandant demandé")).toBeTruthy();
    await userEvent.upload(screen.getByLabelText("Choisir des fichiers"), new File(["x"], "volet.jpg", { type: "image/jpeg" }));
    expect(screen.getByText("volet.jpg")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Créer l'intervention" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/interventions/volet-roulant-bloque");
    });
    expect(await screen.findByText("Intervention créée")).toBeTruthy();
    const created = interventionSchema.parse(await source.interventions.get("volet-roulant-bloque"));
    expect(created).toMatchObject({ status: "ouverte", estimatedMinor: 38000, approvalRequired: true, priority: "urgente", mandantId: "marc-chevalier", photos: ["volet.jpg"] });
    expect(created.events[0]?.title).toBe("Accord du mandant demandé");
  });

  it("n'exige pas l'accord du mandant sous le plafond", async () => {
    const { source } = renderScreen(<InterventionFormPage />);
    await userEvent.type(screen.getByLabelText("Sujet *"), "Poignée de porte");
    await userEvent.click(screen.getByRole("combobox", { name: /Bien/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Apt 9/ }));
    await userEvent.type(screen.getByLabelText("Montant estimé"), "120");
    expect(screen.queryByText("Accord du mandant demandé")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Créer l'intervention" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/interventions/poignee-de-porte");
    });
    expect(interventionSchema.parse(await source.interventions.get("poignee-de-porte"))).toMatchObject({ approvalRequired: false, estimatedMinor: 12000 });
  });

  it("refuse un montant invalide et un fichier non accepté", async () => {
    renderScreen(<InterventionFormPage />);
    await userEvent.type(screen.getByLabelText("Sujet *"), "Poignée de porte");
    await userEvent.type(screen.getByLabelText("Montant estimé"), "beaucoup");
    await userEvent.upload(screen.getByLabelText("Choisir des fichiers"), new File(["x"], "plan.pdf", { type: "application/pdf" }), { applyAccept: false });
    expect(screen.getByText(/Format non accepté/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Créer l'intervention" }));
    expect(await screen.findByText("Montant invalide, exemple : 380,00.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("revalide côté serveur : un bien inconnu et des données invalides sont refusés", async () => {
    const source = createDemoSource();
    const base: CreateInterventionInput = { subject: "Test", lotId: "inconnu", priority: "normale", dueOn: "", contractor: "", description: "", notifyTenant: true, notifyMandant: true, estimatedMinor: null, photos: [] };
    await expect(source.interventions.create(base)).rejects.toMatchObject({ code: "validation", fieldErrors: { lotId: "Ce bien n'existe pas." } });
    await expect(source.interventions.create({ ...base, subject: "x", lotId: "apt-12", dueOn: "2026-02-30" })).rejects.toMatchObject({
      fieldErrors: { subject: "Indiquez le sujet (3 caractères au minimum)." },
    });
    await expect(source.interventions.create({ ...base, lotId: "apt-12", estimatedMinor: -5 })).rejects.toMatchObject({ code: "validation" });
  });
});

describe("devis à soumettre", () => {
  it("affiche le détail, la TVA et le dépassement calculés par le serveur", async () => {
    const { container } = renderScreen(<DevisPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Devis plomberie, Studio 4" })).toBeTruthy();
    expect(screen.getByText("À soumettre")).toBeTruthy();
    expect(screen.getByText("380 € dépassent de 80 € le plafond du mandat")).toBeTruthy();
    expect(screen.getByText(/Le mandat M-2025-0142 fixe à 300 €/)).toBeTruthy();
    expect(screen.getByText("345,45 €")).toBeTruthy();
    expect(screen.getByText("34,55 €")).toBeTruthy();
    expect(screen.getByText("TVA 10 %")).toBeTruthy();
    expect(screen.getByText("2 h")).toBeTruthy();
    expect((await screen.findByRole("link", { name: "Fuite sous l'évier" })).getAttribute("href")).toBe("/interventions/fuite-sous-l-evier");
    await expectNoA11yViolations(container);
  });

  it("calcule hors taxes et TVA côté serveur à partir des lignes", async () => {
    const source = createDemoSource();
    const list = devisSchema.array().parse(await source.interventions.listDevis());
    const devis = list.find((item) => item.id === "devis-plomberie-studio-4");
    expect(devis).toMatchObject({ totalMinor: 38000, htMinor: 34545, vatMinor: 3455, excessMinor: 8000, ceilingMinor: 30000 });
    expect(devis?.lines.map((line) => line.totalMinor)).toEqual([6000, 14000, 8500, 9500]);
  });

  it("soumet le devis au mandant : état, événement et notification", async () => {
    const { source } = renderScreen(<DevisPage />);
    await screen.findByRole("heading", { level: 1, name: "Devis plomberie, Studio 4" });
    await userEvent.click(screen.getByRole("button", { name: "Soumettre au mandant" }));
    const dialog = await screen.findByRole("dialog", { name: "Soumettre le devis au mandant" });
    expect(dialog).toBeTruthy();
    const message = within(dialog).getByLabelText("Message joint");
    await userEvent.clear(message);
    await userEvent.type(message, "court");
    await userEvent.click(screen.getByRole("button", { name: "Soumettre le devis" }));
    expect(await screen.findByText("Le message doit comporter 10 caractères au minimum.")).toBeTruthy();
    await userEvent.clear(message);
    await userEvent.type(message, "Merci de valider ce devis rapidement.");
    await userEvent.click(screen.getByRole("button", { name: "Soumettre le devis" }));
    expect(await screen.findByText("Devis soumis au mandant")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Soumettre au mandant" })).toBeNull();
    });
    expect(screen.getAllByText("Soumis").length).toBeGreaterThan(0);
    const devis = devisSchema.array().parse(await source.interventions.listDevis()).find((item) => item.id === "devis-plomberie-studio-4");
    expect(devis).toMatchObject({ state: "soumis", submittedOn: "2026-11-13", message: "Merci de valider ce devis rapidement." });
    const intervention = interventionSchema.parse(await source.interventions.get("fuite-sous-l-evier"));
    expect(intervention.status).toBe("devis_soumis");
    expect(intervention.events[0]?.title.replace(/\u00a0/g, " ")).toBe("Devis soumis au mandant, 380 € TTC");
  });

  it("refuse de soumettre deux fois le même devis", async () => {
    const source = createDemoSource();
    const input = { devisId: "devis-plomberie-studio-4", message: "Merci de valider ce devis." };
    await source.interventions.submitDevis(input);
    await expect(source.interventions.submitDevis(input)).rejects.toMatchObject({ code: "already_submitted" });
    await expect(source.interventions.submitDevis({ devisId: "inconnu", message: "Merci de valider ce devis." })).rejects.toMatchObject({ code: "not_found" });
  });

  it("sélectionne un autre devis et gère l'identifiant inconnu", async () => {
    resetNavigation("devis=devis-electricite-les-tilleuls");
    const first = renderScreen(<DevisPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Devis électricité, Les Tilleuls" })).toBeTruthy();
    expect(screen.getByText("Soumis à Paul Lemoine le 10/11/2026, réponse attendue sous 48 h.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Soumettre au mandant" })).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: /Devis affiché/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Devis plomberie, Studio 4/ }));
    expect(router.replace).toHaveBeenCalledWith("/devis?devis=devis-plomberie-studio-4");
    first.unmount();
    resetNavigation("devis=inconnu");
    renderScreen(<DevisPage />);
    expect(await screen.findByRole("heading", { name: "Devis introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux interventions" }).getAttribute("href")).toBe("/interventions");
  });

  it("imprime le devis par la fonction d'impression du navigateur", async () => {
    const print = vi.fn<() => void>();
    vi.stubGlobal("print", print);
    renderScreen(<DevisPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
