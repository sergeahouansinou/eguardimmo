import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetNavigation, router } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, storedFileJson } from "../api/testing";
import type { MockRoute } from "../api/testing";
import { pickOption, renderPortefeuille } from "../testing";
import { AvenantFormPage } from "./AvenantFormPage";
import { MandatFormPage } from "./MandatFormPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);
const detail = (overrides = {}) => ({ status: 200, body: { data: mandateDetail(overrides) } });
const tooLarge = (field: string) => problem(422, "validation_failed", "Données invalides.", { [field]: [`Le champ ${field} ne peut pas dépasser 100 000 000 000.`] });
const refusal = (field: string) => `Le champ ${field} ne peut pas dépasser 100 000 000 000.`;

const baseRoutes: Record<string, MockRoute> = {
  [`GET ${orgPath("/mandates")}`]: { body: page([mandateSummary()]) },
  [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
  [`GET ${mandatePath()}`]: detail(),
  [`GET ${orgPath("/mandates/term-defaults")}`]: problem(404, "mandate_term_defaults_not_found", "Aucune condition par défaut."),
  [`GET ${orgPath("/parties")}`]: { body: page([{ id: ID.mandant, kind: "person", display_name: "Claire Vasseur", is_anonymized: false, archived_at: null }]) },
  [`GET ${orgPath("/units")}`]: { body: page([{ id: ID.unitA, reference: "A12", property: { id: ID.property, name: "Résidence du Port" }, archived_at: null }]) },
  [`GET ${orgPath("/catalog/vocabularies/mandate_type/terms")}`]: { body: { data: [{ id: ID.type, key: "gestion", labels: { fr: "Mandat de gestion" }, semantic_key: "management", archived: false }] } },
  [`POST ${orgPath("/documents/files")}`]: { status: 201, body: { data: storedFileJson({ id: ID.signedFile }) } },
};

function renderWith(ui: React.ReactElement, routes: Record<string, MockRoute>) {
  const api = mockApi({ ...baseRoutes, ...routes });
  const source = createApiPortefeuilleSource({ mandates: createApiMandatesSource({ client: api.client, organizationId: ORG }), agencyName: "Agence Soleil", canWrite: true, now: () => NOW });
  return { ...api, ...renderPortefeuille(ui, source) };
}

beforeEach(() => {
  resetNavigation(`mandat=${ID.mandate}`);
});

describe("refus serveur d'un montant trop élevé, sous le champ concerné", () => {
  describe("avenant", () => {
    it("affiche le refus du minimum mensuel sous ce champ", async () => {
      const user = userEvent.setup();
      renderWith(<AvenantFormPage />, { [`POST ${mandatePath("/terms")}`]: tooLarge("fee_minimum_amount") });
      await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
      await user.clear(await screen.findByRole("textbox", { name: /Nouveaux honoraires/ }));
      await user.type(screen.getByRole("textbox", { name: /Nouveaux honoraires/ }), "6");
      await user.upload(screen.getByLabelText("Joindre l'avenant signé"), new File(["%PDF"], "avenant.pdf", { type: "application/pdf" }));

      await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

      expect(await screen.findByText(refusal("fee_minimum_amount"))).toBeTruthy();
      expect(screen.getByRole("textbox", { name: /Minimum par mois/ }).getAttribute("aria-invalid")).toBe("true");
      expect(router.push).not.toHaveBeenCalled();
    });

    it("affiche le refus du plafond de travaux sous ce champ", async () => {
      const user = userEvent.setup();
      renderWith(<AvenantFormPage />, { [`POST ${mandatePath("/terms")}`]: tooLarge("works_limit_amount") });
      await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
      await user.click(screen.getByRole("radio", { name: "Travaux" }));
      await user.upload(screen.getByLabelText("Joindre l'avenant signé"), new File(["%PDF"], "avenant.pdf", { type: "application/pdf" }));

      await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

      expect(await screen.findByText(refusal("works_limit_amount"))).toBeTruthy();
      expect(screen.getByRole("textbox", { name: /plafond de travaux/ }).getAttribute("aria-invalid")).toBe("true");
    });

    it("refuse côté client, en euros, un montant au-delà du plafond sans appeler le serveur", async () => {
      const user = userEvent.setup();
      const { callsTo } = renderWith(<AvenantFormPage />, {});
      await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
      await user.click(screen.getByRole("radio", { name: "Travaux" }));
      const works = await screen.findByRole("textbox", { name: /plafond de travaux/ });
      await user.clear(works);
      await user.type(works, "100 000 000 000");

      await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

      expect(await screen.findByText(/Saisissez un montant en euros/)).toBeTruthy();
      expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(0);
      expect(callsTo("POST", orgPath("/documents/files"))).toHaveLength(0);
    });
  });

  describe("création de mandat", () => {
    async function fill(user: ReturnType<typeof userEvent.setup>) {
      await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
      await pickOption(user, /Mandant/, /Claire Vasseur/);
      await pickOption(user, /Lot 1/, /A12/);
      await pickOption(user, /Base de calcul des honoraires/, /Loyer hors charges/);
      await user.type(screen.getByLabelText(/Dernier jour du mandat/), "2029-11-30");
    }

    it.each([
      ["terms.fee_minimum_amount", /Minimum par mois/],
      ["terms.works_limit_amount", /Travaux sans accord/],
    ])("affiche le refus %s sous son champ", async (serverField, label) => {
      const user = userEvent.setup();
      renderWith(<MandatFormPage />, { [`POST ${orgPath("/mandates")}`]: tooLarge(serverField) });
      await fill(user);

      await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

      expect(await screen.findByText(refusal(serverField))).toBeTruthy();
      expect(screen.getByLabelText(label).getAttribute("aria-invalid")).toBe("true");
      expect(router.push).not.toHaveBeenCalled();
    });

    it("affiche le refus du forfait mensuel sous le champ du forfait, visible, et non sur le taux masqué", async () => {
      const user = userEvent.setup();
      renderWith(<MandatFormPage />, { [`POST ${orgPath("/mandates")}`]: tooLarge("terms.fee_flat_amount") });
      await fill(user);
      await user.click(screen.getByRole("radio", { name: "Forfait mensuel" }));
      await user.type(await screen.findByLabelText(/Forfait mensuel, €/), "45");

      await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

      expect(await screen.findByText(refusal("terms.fee_flat_amount"))).toBeTruthy();
      expect(screen.getByLabelText(/Forfait mensuel, €/).getAttribute("aria-invalid")).toBe("true");
    });

    it("refuse côté client un forfait au-delà du plafond, en euros, sans appeler le serveur", async () => {
      const user = userEvent.setup();
      const { callsTo } = renderWith(<MandatFormPage />, {});
      await fill(user);
      await user.click(screen.getByRole("radio", { name: "Forfait mensuel" }));
      await user.type(await screen.findByLabelText(/Forfait mensuel, €/), "100 000 000 000");

      await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

      await waitFor(() => { expect(screen.getByText(/Saisissez le forfait mensuel en euros/)).toBeTruthy(); });
      expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(0);
    });
  });
});
