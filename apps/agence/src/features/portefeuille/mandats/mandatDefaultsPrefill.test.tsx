import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetNavigation } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, termDefaultsJson } from "../api/testing";
import type { MockRoute } from "../api/testing";
import { pickOption, renderPortefeuille } from "../testing";
import { MandatFormPage } from "./MandatFormPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const defaultsPath = orgPath("/mandates/term-defaults");

const options: Record<string, MockRoute> = {
  [`GET ${orgPath("/mandates")}`]: { body: page([mandateSummary()]) },
  [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
  [`GET ${orgPath("/parties")}`]: { body: page([{ id: ID.mandant, kind: "person", display_name: "Claire Vasseur", is_anonymized: false, archived_at: null }]) },
  [`GET ${orgPath("/units")}`]: { body: page([{ id: ID.unitA, reference: "A12", property: { id: ID.property, name: "Résidence du Port" }, archived_at: null }]) },
  [`GET ${orgPath("/catalog/vocabularies/mandate_type/terms")}`]: { body: { data: [{ id: ID.type, key: "gestion", labels: { fr: "Mandat de gestion" }, semantic_key: "management", archived: false }] } },
};

function renderForm(routes: Record<string, MockRoute>) {
  const api = mockApi({ ...options, ...routes });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite: true, now: () => NOW });
  return { ...api, ...renderPortefeuille(<MandatFormPage />, source) };
}

const value = (label: RegExp): string => screen.getByLabelText<HTMLInputElement>(label).value;

beforeEach(() => {
  resetNavigation();
});

describe("préremplissage du mandat par les conditions par défaut", () => {
  it("préremplit les conditions et rien d'autre : ni mandant, ni lot, ni dates", async () => {
    renderForm({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } } });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });

    expect(await screen.findByText(/Conditions préremplies/)).toBeTruthy();
    expect(value(/Taux des loyers encaissés/)).toBe("6,50");
    expect(value(/Minimum par mois/)).toBe("15");
    expect(value(/Travaux sans accord/)).toBe("600");
    expect(value(/relocation/i)).toBe("50");
    expect(value(/Dernier jour du mandat/)).toBe("");
    expect(screen.getByRole("combobox", { name: /Mandant/ }).textContent).toContain("Choisir un mandant");
  });

  it("envoie les conditions préremplies, relocation comprise, à la création du brouillon", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderForm({
      [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } },
      [`POST ${orgPath("/mandates")}`]: { status: 201, body: { data: mandateDetail({ status: "draft", lock_version: 1 }) } },
    });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await screen.findByText(/Conditions préremplies/);
    await pickOption(user, /Mandant/, /Claire Vasseur/);
    await pickOption(user, /Lot 1/, /A12/);
    await user.type(screen.getByLabelText(/Dernier jour du mandat/), "2029-11-30");

    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    await waitFor(() => { expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(1); });
    expect(callsTo("POST", orgPath("/mandates"))[0]?.body).toMatchObject({
      terms: { fee_kind: "percentage", fee_basis_points: 650, payout_day: 7, works_limit_amount: 60_000, fee_base: "rent_and_charges", fee_minimum_amount: 1_500, fee_tax_mode: "excl_tax", letting_fee_basis_points: 5_000 },
    });
  });

  it("laisse le formulaire vierge quand aucun défaut n'est posé, sans message d'erreur", async () => {
    renderForm({ [`GET ${defaultsPath}`]: problem(404, "mandate_term_defaults_not_found", "Aucune condition par défaut.") });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });

    expect(screen.queryByText(/Conditions préremplies/)).toBeNull();
    expect(screen.queryByText("Conditions par défaut indisponibles")).toBeNull();
    expect(value(/Taux des loyers encaissés/)).toBe("7,00");
  });

  it("signale des défauts non vérifiables sans bloquer la saisie, puis se préremplit au réessai", async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderForm({
      [`GET ${defaultsPath}`]: () => {
        calls += 1;
        return calls === 1 ? problem(500, "server_error", "Erreur interne.") : { body: { data: termDefaultsJson() } };
      },
    });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });

    expect(await screen.findByText("Conditions par défaut indisponibles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enregistrer le brouillon" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText(/Conditions préremplies/)).toBeTruthy();
    expect(screen.queryByText("Conditions par défaut indisponibles")).toBeNull();
    expect(value(/Taux des loyers encaissés/)).toBe("6,50");
  });
});
