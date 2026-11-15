import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation, router } from "../../../../test/navigation";
import { formatRate } from "@/lib/money";
import { createDemoSource, parsePortefeuille } from "../source";
import { failingSource, pickOption, renderPortefeuille } from "../testing";
import { AvenantFormPage } from "./AvenantFormPage";
import { MandatDetailPage } from "./MandatDetailPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

async function stored(source: ReturnType<typeof createDemoSource>, id: string) {
  return parsePortefeuille(await source.load()).mandats.find((item) => item.id === id);
}

describe("nouvel avenant", () => {
  it("signale mandat et taux manquants", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    const { container } = renderPortefeuille(<AvenantFormPage />, source);
    await user.click(await screen.findByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText("Choisissez le mandat.")).toBeTruthy();
    expect(screen.getByText(/Saisissez un taux entre 0,01 et 20 %/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(parsePortefeuille(await source.load()).avenants).toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it("applique un nouveau taux d'honoraires et ouvre le mandat", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = createDemoSource();
    renderPortefeuille(<AvenantFormPage />, source);
    const rate = await screen.findByRole("textbox", { name: /Nouveaux honoraires/ });
    expect((rate as HTMLInputElement).value).toBe("7");
    await user.clear(rate);
    await user.type(rate, "6,5");
    const preview = screen.getByRole("group", { name: "Aperçu de l'avenant" });
    expect(within(preview).getByText(`${formatRate(700)} → ${formatRate(650)}`.replace(/\s/g, " "))).toBeTruthy();
    expect(within(preview).getByText(/74,75 € par mois sur 1 150 € de loyers appelés, contre 80,50 € aujourd'hui/)).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Motif" }), "Accord du mandant du 10 novembre");
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mandats/m-2025-0142"); });
    expect((await stored(source, "m-2025-0142"))?.feeBasisPoints).toBe(650);
    const data = parsePortefeuille(await source.load());
    expect(data.avenants[0]).toMatchObject({ number: "AV-2026-0001", kind: "honoraires", applied: true, note: "Accord du mandant du 10 novembre" });
    expect(data.events.some((event) => event.title === "Avenant AV-2026-0001 appliqué")).toBe(true);
  });

  it("refuse un taux hors limites", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    renderPortefeuille(<AvenantFormPage />);
    const rate = await screen.findByRole("textbox", { name: /Nouveaux honoraires/ });
    await user.clear(rate);
    await user.type(rate, "25");
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText(/Saisissez un taux entre 0,01 et 20 %/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("choisit le mandat dans la liste et reprend ses conditions", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<AvenantFormPage />);
    await pickOption(user, /Mandat/, /M-2024-0058, Famille Bernard/);
    expect(screen.getByRole("textbox", { name: /Nouveaux honoraires/ })).toHaveProperty("value", "7");
    expect(screen.getByText("Famille Bernard")).toBeTruthy();
    expect(screen.getByText("Aucun avenant sur ce mandat pour le moment.")).toBeTruthy();
  });

  it("prolonge la durée et remet un mandat à renouveler en cours", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2023-0071");
    const source = createDemoSource();
    renderPortefeuille(<AvenantFormPage />, source);
    await user.click(await screen.findByRole("radio", { name: "Durée" }));
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText("Indiquez la nouvelle échéance.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nouvelle échéance/), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText("La nouvelle échéance doit suivre l'échéance actuelle du 31/12/2026.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nouvelle échéance/), { target: { value: "2029-12-31" } });
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/mandats/m-2023-0071"); });
    expect(await stored(source, "m-2023-0071")).toMatchObject({ endIso: "2029-12-31", status: "actif" });
  });

  it("modifie le jour de reversement", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = createDemoSource();
    renderPortefeuille(<AvenantFormPage />, source);
    await user.click(await screen.findByRole("radio", { name: "Reversement" }));
    await pickOption(user, /Nouveau jour de reversement/, "Le 12 du mois");
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledTimes(1); });
    expect((await stored(source, "m-2025-0142"))?.payoutDay).toBe(12);
  });

  it("modifie le plafond de travaux et refuse une saisie vide", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = createDemoSource();
    renderPortefeuille(<AvenantFormPage />, source);
    await user.click(await screen.findByRole("radio", { name: "Travaux" }));
    const limit = screen.getByRole("textbox", { name: /Nouveau plafond/ });
    await user.clear(limit);
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText(/Saisissez un montant en euros/)).toBeTruthy();
    await user.type(limit, "800");
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledTimes(1); });
    expect((await stored(source, "m-2025-0142"))?.worksLimitMinor).toBe(80_000);
  });

  it("programme un avenant à effet futur sans modifier le mandat", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = createDemoSource();
    renderPortefeuille(<AvenantFormPage />, source);
    const rate = await screen.findByRole("textbox", { name: /Nouveaux honoraires/ });
    await user.clear(rate);
    await user.type(rate, "6");
    fireEvent.change(screen.getByLabelText(/Date d'effet/), { target: { value: "2027-01-01" } });
    expect(screen.getByText(/L'avenant est programmé/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledTimes(1); });
    expect((await stored(source, "m-2025-0142"))?.feeBasisPoints).toBe(700);
    expect(parsePortefeuille(await source.load()).avenants[0]?.applied).toBe(false);
  });

  it("refuse une date d'effet passée", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = createDemoSource();
    renderPortefeuille(<AvenantFormPage />, source);
    await screen.findByRole("textbox", { name: /Nouveaux honoraires/ });
    fireEvent.change(screen.getByLabelText(/Date d'effet/), { target: { value: "2026-11-01" } });
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText("La date d'effet ne peut pas être antérieure au 13/11/2026.")).toBeTruthy();
    expect(parsePortefeuille(await source.load()).avenants).toHaveLength(0);
  });

  it("n'offre pas les mandats terminés ni en résiliation", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    await source.terminateMandat("m-2025-0142", { reason: "mandant", effectIso: "2027-03-31", noticeIso: "2026-11-13", note: "" });
    renderPortefeuille(<AvenantFormPage />, source);
    await user.click(await screen.findByRole("combobox", { name: /Mandat/ }));
    const list = await screen.findByRole("listbox", { name: /Mandat/ });
    expect(within(list).getAllByRole("option")).toHaveLength(5);
    expect(within(list).queryByText(/M-2025-0142/)).toBeNull();
    expect(within(list).queryByText(/M-2021-0044/)).toBeNull();
  });

  it("affiche l'échec de la source sans naviguer", async () => {
    const user = userEvent.setup();
    resetNavigation("mandat=m-2025-0142");
    const source = { ...createDemoSource(), createAvenant: () => Promise.reject(new Error("Écriture refusée")) };
    renderPortefeuille(<AvenantFormPage />, source);
    await screen.findByRole("textbox", { name: /Nouveaux honoraires/ });
    await user.click(screen.getByRole("button", { name: "Valider l'avenant" }));
    expect(await screen.findByText("Écriture refusée")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<AvenantFormPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });

  it("liste l'avenant créé dans la fiche du mandat", async () => {
    const source = createDemoSource();
    await source.createAvenant({ mandatId: "m-2025-0142", kind: "honoraires", effectIso: "2026-11-13", feeBasisPoints: 650, note: "" });
    renderPortefeuille(<MandatDetailPage id="m-2025-0142" />, source);
    expect(await screen.findByText("Avenant AV-2026-0001 appliqué")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ajouter un avenant" }).getAttribute("href")).toBe("/mandats/avenant?mandat=m-2025-0142");
  });
});
