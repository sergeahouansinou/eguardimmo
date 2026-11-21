import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { ACCESS_ENTRY, SECOND_ACCESS_ENTRY, problem } from "../responses.fixtures";
import { HomeScreen } from "../screens/HomeScreen";
import { HOME_CO_OWNER_RESPONSE, HOME_EMPTY_RESPONSE, HOME_RESPONSE } from "./fixtures";
import { NEXT_NOTICE_FALLBACK, NEXT_NOTICE_MESSAGES } from "./labels";

vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const HOME = "GET /api/v1/owner/home";
const withNotice = (code: string | null) => ({ data: { ...HOME_RESPONSE.data, payouts: { ...HOME_RESPONSE.data.payouts, next_notice: code } } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accueil connecté au serveur", () => {
  it("affiche loyers, impayés, reversements, mandat, compte rendu et lots du serveur, pour l'agence choisie", async () => {
    const stub = stubApi({ [HOME]: { body: HOME_RESPONSE } });
    const { container } = renderApi(<HomeScreen />);

    const collected = await screen.findByRole("region", { name: "Loyers encaissés, novembre 2026" });
    expect(within(collected).getByText("700 €")).toBeTruthy();
    expect(within(collected).getByText("sur 1 200 € appelés")).toBeTruthy();
    const arrears = screen.getByRole("region", { name: "Impayés" });
    expect(within(arrears).getByText("500 €")).toBeTruthy();
    expect(within(arrears).getByText("1 échéance, jusqu’à 11 jours de retard")).toBeTruthy();
    const pending = screen.getByRole("region", { name: "Reversement en attente" });
    expect(within(pending).getByText("641,20 €")).toBeTruthy();
    expect(within(pending).getByText("Après 58,80 € d’honoraires")).toBeTruthy();
    const last = screen.getByRole("region", { name: "Dernier reversement" });
    expect(within(last).getByText("600 €")).toBeTruthy();
    expect(within(last).getByText("Versé le 05/10/2026 · RV-2026-0006")).toBeTruthy();

    const mandate = screen.getByRole("region", { name: "Mon mandat" });
    expect(within(mandate).getByText("M-2026-0001")).toBeTruthy();
    expect(within(mandate).getByText("7 % des loyers encaissés")).toBeTruthy();
    expect(within(mandate).getByText("Le 5 de chaque mois")).toBeTruthy();
    expect(within(mandate).getByText("31/12/2028")).toBeTruthy();
    const next = screen.getByRole("region", { name: "Prochain reversement" });
    expect(within(next).getByText("Prévu autour du 05/12/2026")).toBeTruthy();
    const report = screen.getByRole("region", { name: "Dernier compte rendu" });
    expect(within(report).getByText(/Mensuel · du 01\/10\/2026 au 31\/10\/2026 · Non lu/)).toBeTruthy();
    expect(within(report).getByRole("link", { name: "Ouvrir le compte rendu CRG-2026-0010" }).getAttribute("href")).toMatch(/\/confie\/comptes-rendus\//);

    const units = screen.getByRole("table", { name: "Mes biens" });
    expect(within(units).getByText("Résidence Les Filaos - A1")).toBeTruthy();
    expect(within(units).getByText("Pauline Martin")).toBeTruthy();
    expect(within(units).getByText("Occupé")).toBeTruthy();
    expect(within(units).getByText("Loyer en retard")).toBeTruthy();
    expect(within(units).getByText("Vacant")).toBeTruthy();
    expect(within(units).getByText("Aucun locataire")).toBeTruthy();
    expect(screen.getByText("3 lots : 2 occupés, 1 vacant")).toBeTruthy();
    expect(screen.getByText("2 devis attendent votre décision")).toBeTruthy();
    expect(screen.queryByText(/bientôt disponible/i)).toBeNull();

    expect(stub.calls.filter((call) => call.path === "/api/v1/owner/home").map((call) => call.query)).toEqual([{ agency: ACCESS_ENTRY.agency.id }]);
    await expectNoA11yViolations(container);
  });

  it("redemande la synthèse de l'agence quand on change de mandat", async () => {
    const stub = stubApi({ "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } }, [HOME]: { body: HOME_RESPONSE } });
    const { user } = renderApi(<HomeScreen />);

    await screen.findByRole("region", { name: "Impayés" });
    await user.click(screen.getByRole("combobox", { name: /Agence et mandant/ }));
    await user.click(await screen.findByRole("option", { name: /SCI Les Palmiers/ }));

    await screen.findByRole("region", { name: "Impayés" });
    expect(stub.calls.filter((call) => call.path === "/api/v1/owner/home").map((call) => call.query.agency)).toEqual([ACCESS_ENTRY.agency.id, SECOND_ACCESS_ENTRY.agency.id]);
  });

  it.each(Object.entries(NEXT_NOTICE_MESSAGES))("traduit le motif %s du prochain reversement, sans jamais afficher le code", async (code, message) => {
    stubApi({ [HOME]: { body: withNotice(code) } });
    renderApi(<HomeScreen />);

    const next = await screen.findByRole("region", { name: "Prochain reversement" });
    expect(within(next).getByText(`Date indicative · ${message}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain(code);
  });

  it("remplace un motif inconnu du serveur par un libellé lisible", async () => {
    stubApi({ [HOME]: { body: withNotice("motif_futur_du_backend") } });
    renderApi(<HomeScreen />);

    const next = await screen.findByRole("region", { name: "Prochain reversement" });
    expect(within(next).getByText(`Date indicative · ${NEXT_NOTICE_FALLBACK}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain("motif_futur_du_backend");
  });

  it("n'annonce pas de date de reversement quand le serveur n'en donne pas", async () => {
    stubApi({ [HOME]: { body: { data: { ...HOME_RESPONSE.data, payouts: { ...HOME_RESPONSE.data.payouts, next_date: null } } } } });
    renderApi(<HomeScreen />);

    expect(await within(await screen.findByRole("region", { name: "Prochain reversement" })).findByText("Date non communiquée")).toBeTruthy();
  });

  it("ne montre aucun reversement à un co-indivisaire", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } }, [HOME]: { body: HOME_CO_OWNER_RESPONSE } });
    const { container } = renderApi(<HomeScreen />);

    expect(await screen.findByText("Reversements non visibles")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Reversement en attente" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Dernier reversement" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Prochain reversement" })).toBeNull();
    expect(screen.getByRole("region", { name: "Impayés" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("présente des états vides quand rien n'est encore couvert", async () => {
    stubApi({ [HOME]: { body: HOME_EMPTY_RESPONSE } });
    const { container } = renderApi(<HomeScreen />);

    expect(await screen.findByText("Aucun mandat en cours ne couvre vos lots aujourd’hui.")).toBeTruthy();
    expect(screen.getByText("Aucun compte rendu publié pour le moment.")).toBeTruthy();
    expect(screen.getByText("Aucun lot n’est couvert par un mandat en cours.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Impayés" })).getByText("Aucun impayé")).toBeTruthy();
    expect(screen.queryByText(/attendent votre décision|attend votre décision/)).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("signale un mandat suspendu et les autres mandats couverts", async () => {
    const mandate = { ...HOME_RESPONSE.data.mandate, is_suspended: true, status: "suspended" };
    stubApi({ [HOME]: { body: { data: { ...HOME_RESPONSE.data, mandate, mandates_count: 2 } } } });
    renderApi(<HomeScreen />);

    const region = await screen.findByRole("region", { name: "Mon mandat" });
    expect(within(region).getByText("Suspendu")).toBeTruthy();
    expect(within(region).getByText(/2 mandats couvrent vos lots aujourd’hui/)).toBeTruthy();
  });

  it("affiche un nom de locataire comme du texte, jamais comme du HTML", async () => {
    const units = [{ ...HOME_RESPONSE.data.units[0], tenant: { name: "<img src=x onerror=alert(1)>" } }];
    stubApi({ [HOME]: { body: { data: { ...HOME_RESPONSE.data, units } } } });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("demande de choisir l'agence quand le serveur l'exige (422 owner_agency_required)", async () => {
    stubApi({ [HOME]: problem(422, "owner_agency_required") });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Votre synthèse n’a pas pu être chargée")).toBeTruthy();
    expect(screen.getByText("Votre compte a plusieurs mandats : choisissez l’agence à consulter.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });

  it("traduit un mandant introuvable par le serveur (404 owner_mandant_not_found)", async () => {
    stubApi({ [HOME]: problem(404, "owner_mandant_not_found") });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Votre synthèse n’a pas pu être chargée")).toBeTruthy();
    expect(screen.getByText("Cet élément n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
  });

  it("propose de réessayer après une panne puis affiche la synthèse", async () => {
    let calls = 0;
    stubApi({ [HOME]: () => (++calls === 1 ? problem(500, "boom") : { body: HOME_RESPONSE }) });
    const { user } = renderApi(<HomeScreen />);

    await user.click(await screen.findByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("region", { name: "Impayés" })).toBeTruthy();
  });

  it("signale une réponse hors contrat plutôt que d'afficher des montants faux", async () => {
    const month = { ...HOME_RESPONSE.data.month, collected: { amount: "70000", currency: "EUR" } };
    stubApi({ [HOME]: { body: { data: { ...HOME_RESPONSE.data, month } } } });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Votre synthèse n’a pas pu être chargée")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Impayés" })).toBeNull();
  });
});
