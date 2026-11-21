import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation } from "../../../test/navigation";
import { createApiPortefeuilleSource } from "../portefeuille/api/apiPortefeuille";
import { createApiMandatesSource } from "../portefeuille/api/mandatesSource";
import { ORG, mandantRow, mandateSummary, mockApi, orgPath, page, problem, termDefaultsJson } from "../portefeuille/api/testing";
import type { MockRoute } from "../portefeuille/api/testing";
import { pickOption, renderPortefeuille } from "../portefeuille/testing";
import { DefaultsPage } from "./DefaultsPage";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const defaultsPath = orgPath("/mandates/term-defaults");
const absent = problem(404, "mandate_term_defaults_not_found", "Aucune condition par défaut.");

function renderDefaults(routes: Record<string, MockRoute>, canEditDefaults = true) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: { body: page([mandateSummary()]) },
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    ...routes,
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite: true, canEditDefaults, now: () => NOW });
  return { ...api, ...renderPortefeuille(<DefaultsPage />, source) };
}

const field = (label: RegExp) => screen.getByRole("textbox", { name: label });
const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Enregistrer" }));

beforeEach(() => {
  resetNavigation();
});

describe("réglages finances en mode api : conditions par défaut", () => {
  it("affiche les conditions posées, en lecture des réponses du serveur", async () => {
    const { container } = renderDefaults({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } } });

    expect(await screen.findByDisplayValue("6,50")).toBeTruthy();
    expect((field(/Minimum mensuel par lot/) as HTMLInputElement).value).toBe("15");
    expect((field(/Travaux sans accord/) as HTMLInputElement).value).toBe("600");
    expect((field(/relocation/i) as HTMLInputElement).value).toBe("50");
    expect((field(/suivi de travaux/i) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("link", { name: /identité légale/ }).getAttribute("href")).toBe("/reglages");
    expect(screen.getByRole("link", { name: /comptes bancaires/ }).getAttribute("href")).toBe("/finances/banque/comptes");
    await expectNoA11yViolations(container);
  });

  it("explique l'absence de défauts (404) sans la présenter comme une erreur, et laisse les poser", async () => {
    renderDefaults({ [`GET ${defaultsPath}`]: absent });

    expect(await screen.findByText("Aucune condition par défaut n’est posée")).toBeTruthy();
    expect(screen.queryByText(/n’ont pas pu être chargées/)).toBeNull();
    expect(screen.getByRole("combobox", { name: /Devise/ })).toBeTruthy();
    expect((field(/Taux par défaut/) as HTMLInputElement).value).toBe("");
  });

  it("propose de réessayer quand le chargement échoue, puis affiche les conditions", async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderDefaults({
      [`GET ${defaultsPath}`]: () => {
        calls += 1;
        return calls === 1 ? problem(500, "server_error", "Erreur interne.") : { body: { data: termDefaultsJson() } };
      },
    });

    expect(await screen.findByText("Les conditions par défaut n’ont pas pu être chargées")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByDisplayValue("6,50")).toBeTruthy();
  });

  it("met à jour avec le lock_version lu, en unités mineures et points de base, puis confirme", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDefaults({
      [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } },
      [`PUT ${defaultsPath}`]: { body: { data: termDefaultsJson({ fee_basis_points: 800, lock_version: 3 }) } },
    });
    const rate = await screen.findByDisplayValue("6,50");
    await user.clear(rate);
    await user.type(rate, "8");

    await save(user);

    await waitFor(() => { expect(callsTo("PUT", defaultsPath)).toHaveLength(1); });
    expect(callsTo("PUT", defaultsPath)[0]?.body).toEqual({
      lock_version: 2,
      fee_kind: "percentage",
      fee_basis_points: 800,
      fee_base: "rent_and_charges",
      fee_minimum_amount: 1_500,
      fee_tax_mode: "excl_tax",
      payout_day: 7,
      works_limit_amount: 60_000,
      letting_fee_basis_points: 5_000,
      works_fee_basis_points: null,
    });
    expect(await screen.findByText("Conditions par défaut enregistrées")).toBeTruthy();
  });

  it("première écriture : PUT sans lock_version", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDefaults({
      [`GET ${defaultsPath}`]: absent,
      [`PUT ${defaultsPath}`]: { status: 200, body: { data: termDefaultsJson({ fee_basis_points: 700, fee_base: "rent", fee_minimum_amount: { amount: 0, currency: "EUR" }, works_limit_amount: { amount: 50_000, currency: "EUR" }, letting_fee_basis_points: null, payout_day: 5, lock_version: 1 }) } },
    });
    await screen.findByText("Aucune condition par défaut n’est posée");
    await user.type(field(/Taux par défaut/), "7");
    await pickOption(user, /Base de calcul/, /Loyer hors charges/);
    const works = field(/Travaux sans accord/);
    await user.clear(works);
    await user.type(works, "500");

    await save(user);

    await waitFor(() => { expect(callsTo("PUT", defaultsPath)).toHaveLength(1); });
    const body = callsTo("PUT", defaultsPath)[0]?.body;
    expect(body).not.toHaveProperty("lock_version");
    expect(body).toMatchObject({ fee_kind: "percentage", fee_basis_points: 700, fee_base: "rent", works_limit_amount: 50_000, payout_day: 5 });
    expect(await screen.findByText("Conditions par défaut enregistrées")).toBeTruthy();
  });

  it("n'envoie rien quand la saisie est invalide", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDefaults({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } } });
    const rate = await screen.findByDisplayValue("6,50");
    await user.clear(rate);
    await user.type(rate, "abc");

    await save(user);

    expect(await screen.findByText(/Saisissez un taux entre 0,01 et 100 %/)).toBeTruthy();
    expect(callsTo("PUT", defaultsPath)).toHaveLength(0);
  });

  it("sur un 409 mandate_stale_version, explique le conflit et recharge sur demande avec la nouvelle version", async () => {
    const user = userEvent.setup();
    let reads = 0;
    let writes = 0;
    const { callsTo } = renderDefaults({
      [`GET ${defaultsPath}`]: () => {
        reads += 1;
        return { body: { data: reads === 1 ? termDefaultsJson() : termDefaultsJson({ fee_basis_points: 900, lock_version: 3 }) } };
      },
      [`PUT ${defaultsPath}`]: () => {
        writes += 1;
        return writes === 1 ? problem(409, "mandate_stale_version", "Version périmée.") : { body: { data: termDefaultsJson({ fee_basis_points: 950, lock_version: 4 }) } };
      },
    });
    const rate = await screen.findByDisplayValue("6,50");
    await user.clear(rate);
    await user.type(rate, "8");
    await save(user);

    expect(await screen.findByText("Conditions modifiées entre-temps")).toBeTruthy();
    expect(screen.getAllByText(/ont été modifiées par quelqu’un d’autre/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Recharger" }));

    const reloaded = await screen.findByDisplayValue("9");
    expect(screen.queryByText("Conditions modifiées entre-temps")).toBeNull();
    await user.clear(reloaded);
    await user.type(reloaded, "9,5");
    await save(user);
    await waitFor(() => { expect(callsTo("PUT", defaultsPath)).toHaveLength(2); });
    expect(callsTo("PUT", defaultsPath)[1]?.body).toMatchObject({ lock_version: 3, fee_basis_points: 950 });
  });

  it("rattache un 422 sur fee_basis_points au champ du taux", async () => {
    const user = userEvent.setup();
    renderDefaults({
      [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } },
      [`PUT ${defaultsPath}`]: problem(422, "validation_failed", "Données invalides.", { fee_basis_points: ["Le taux est trop élevé."] }),
    });
    const rate = await screen.findByDisplayValue("6,50");
    await user.clear(rate);
    await user.type(rate, "8");

    await save(user);

    expect(await screen.findByText("Le taux est trop élevé.")).toBeTruthy();
  });

  it.each([
    ["fee_minimum_amount", /Minimum mensuel par lot/],
    ["works_limit_amount", /Travaux sans accord/],
  ])("affiche sous son champ le refus 422 de %s (montant au-delà du plafond)", async (serverField, label) => {
    const user = userEvent.setup();
    renderDefaults({
      [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } },
      [`PUT ${defaultsPath}`]: problem(422, "validation_failed", "Données invalides.", { [serverField]: ["Le montant ne peut pas dépasser 100 000 000 000."] }),
    });
    const rate = await screen.findByDisplayValue("6,50");
    await user.clear(rate);
    await user.type(rate, "8");

    await save(user);

    expect(await screen.findByText("Le montant ne peut pas dépasser 100 000 000 000.")).toBeTruthy();
    expect(field(label).getAttribute("aria-invalid")).toBe("true");
  });

  it("affiche le refus 422 du forfait mensuel sous le champ du forfait, pas sur le taux masqué", async () => {
    const user = userEvent.setup();
    renderDefaults({
      [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } },
      [`PUT ${defaultsPath}`]: problem(422, "validation_failed", "Données invalides.", { fee_flat_amount: ["Le forfait ne peut pas dépasser 100 000 000 000."] }),
    });
    await screen.findByDisplayValue("6,50");
    await user.click(screen.getByRole("radio", { name: "Forfait mensuel" }));
    await user.type(await screen.findByRole("textbox", { name: /Forfait mensuel par lot/ }), "45");

    await save(user);

    expect(await screen.findByText("Le forfait ne peut pas dépasser 100 000 000 000.")).toBeTruthy();
    expect(field(/Forfait mensuel par lot/).getAttribute("aria-invalid")).toBe("true");
  });

  it.each([
    ["Minimum mensuel par lot", /Minimum mensuel par lot/],
    ["Travaux sans accord", /Travaux sans accord/],
  ])("refuse côté client, en euros, %s au-delà du plafond, sans appeler le serveur", async (_name, label) => {
    const user = userEvent.setup();
    const { callsTo } = renderDefaults({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } } });
    await screen.findByDisplayValue("6,50");
    const input = field(label);
    await user.clear(input);
    await user.type(input, "100 000 000 000");

    await save(user);

    expect(await screen.findByText(/en euros/)).toBeTruthy();
    expect(callsTo("PUT", defaultsPath)).toHaveLength(0);
  });

  it("avertit quand le serveur enregistre dans une autre devise que celle choisie à la première écriture", async () => {
    const user = userEvent.setup();
    renderDefaults({
      [`GET ${defaultsPath}`]: absent,
      [`PUT ${defaultsPath}`]: { body: { data: termDefaultsJson({ lock_version: 1 }) } },
    });
    await screen.findByText("Aucune condition par défaut n’est posée");
    await pickOption(user, /Devise/, /CFA/);
    await user.type(field(/Taux par défaut/), "7");
    await pickOption(user, /Base de calcul/, /Loyer hors charges/);

    await save(user);

    expect(await screen.findByText(/Montants enregistrés en/)).toBeTruthy();
    expect(screen.queryByText("Conditions par défaut enregistrées")).toBeNull();
  });

  it("garde les conditions en lecture seule pour un rôle sans droit d'écriture sur les défauts", async () => {
    renderDefaults({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } } }, false);

    expect(await screen.findByDisplayValue("6,50")).toBeTruthy();
    expect(screen.getByText("Seuls le titulaire et les administrateurs modifient ces conditions.")).toBeTruthy();
    expect((field(/Taux par défaut/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });

  it("n'affiche pas de formulaire à un rôle sans droit quand rien n'est posé", async () => {
    renderDefaults({ [`GET ${defaultsPath}`]: absent }, false);

    expect(await screen.findByText("Aucune condition par défaut n’est posée")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /Taux par défaut/ })).toBeNull();
  });
});
