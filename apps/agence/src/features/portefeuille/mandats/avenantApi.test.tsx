import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetNavigation, router } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, storedFileJson, termsJson, xofTermsJson } from "../api/testing";
import type { MockRoute } from "../api/testing";
import { pickOption, renderPortefeuille } from "../testing";
import { AvenantFormPage } from "./AvenantFormPage";
import { MandatsPage } from "./MandatsPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);
const detail = (overrides = {}) => ({ status: 200, body: { data: mandateDetail(overrides) } });
const uploadPath = orgPath("/documents/files");
const signedPdf = () => new File(["%PDF-1.4"], "avenant-signe.pdf", { type: "application/pdf" });

function renderApi(ui: ReactElement, summaries: Record<string, unknown>[] = [mandateSummary()], routes: Record<string, MockRoute> = {}, canWrite = true) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : summaries) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    [`GET ${mandatePath()}`]: detail({ terms_history: [mandateDetail().terms_history, mandateDetail().terms_history].flat() }),
    [`POST ${uploadPath}`]: { status: 201, body: { data: storedFileJson({ id: ID.signedFile, name: "avenant-signe.pdf" }) } },
    ...routes,
  });
  const source = createApiPortefeuilleSource({ mandates: createApiMandatesSource({ client: api.client, organizationId: ORG }), agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, ...renderPortefeuille(ui, source) };
}

beforeEach(() => {
  resetNavigation(`mandat=${ID.mandate}`);
});

describe("avenant en mode api", () => {
  const attachSigned = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.upload(await screen.findByLabelText("Joindre l'avenant signé"), signedPdf());
  };

  async function submitFee(user: ReturnType<typeof userEvent.setup>, { signed = true }: { signed?: boolean } = {}) {
    await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
    const fee = await screen.findByRole("textbox", { name: /Nouveaux honoraires/ });
    await user.clear(fee);
    await user.type(fee, "6,5");
    if (signed) await attachSigned(user);
    await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));
  }

  it("téléverse la pièce signée puis envoie les conditions avec sa référence, la version du mandat et la date d'effet", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<AvenantFormPage />, [mandateSummary()], { [`POST ${mandatePath("/terms")}`]: detail({ lock_version: 4 }) });

    await submitFee(user);

    await waitFor(() => { expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/terms"))[0]?.body).toEqual({
      lock_version: 3,
      effective_on: "2026-11-16",
      fee_kind: "percentage",
      fee_basis_points: 650,
      fee_base: "rent_and_charges",
      fee_minimum_amount: 0,
      fee_tax_mode: "excl_tax",
      signed_file_id: ID.signedFile,
    });
    const form = callsTo("POST", uploadPath)[0]?.form;
    expect(form?.get("category")).toBe("supporting");
    expect(form?.get("subject_type")).toBe("mandate");
    expect(form?.get("subject_id")).toBe(ID.mandate);
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith(`/mandats/${ID.mandate}`); });
  });

  it("envoie la base, le minimum et le mode de taxe choisis", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<AvenantFormPage />, [mandateSummary()], { [`POST ${mandatePath("/terms")}`]: detail({ lock_version: 4 }) });
    await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
    await pickOption(user, /Base de calcul \*/, /Loyer hors charges/);
    await pickOption(user, /Honoraires exprimés/, /Toutes taxes comprises/);
    const minimum = screen.getByRole("textbox", { name: /Minimum par mois/ });
    await user.clear(minimum);
    await user.type(minimum, "15,5");
    await attachSigned(user);

    await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/terms"))[0]?.body).toMatchObject({ fee_base: "rent", fee_minimum_amount: 1_550, fee_tax_mode: "incl_tax" });
  });

  it("exige une base de calcul sur un mandat qui n'en porte pas, sans en inventer une", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<AvenantFormPage />, [mandateSummary({ terms: termsJson({ fee_base: null }) })]);

    await submitFee(user);

    expect(await screen.findByText("Choisissez la base de calcul des honoraires.")).toBeTruthy();
    expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(0);
  });

  it("modifie le plafond de travaux d'un mandat en FCFA sans multiplier par 100", async () => {
    const user = userEvent.setup();
    const summary = mandateSummary({ currency: "XOF", terms: xofTermsJson() });
    const { callsTo } = renderApi(<AvenantFormPage />, [summary], { [`POST ${mandatePath("/terms")}`]: detail({ lock_version: 4, currency: "XOF", terms: xofTermsJson() }) });
    await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
    await user.click(screen.getByRole("radio", { name: "Travaux" }));
    const works = await screen.findByRole("textbox", { name: /plafond de travaux sans accord, F CFA/ });
    expect((works as HTMLInputElement).value).toBe("300000");
    await user.clear(works);
    await user.type(works, "400 000");
    await attachSigned(user);

    await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/terms"))[0]?.body).toEqual({ lock_version: 3, effective_on: "2026-11-16", works_limit_amount: 400_000, signed_file_id: ID.signedFile });
  });

  it("refuse des centimes sur un mandat en FCFA", async () => {
    const user = userEvent.setup();
    const summary = mandateSummary({ currency: "XOF", terms: xofTermsJson() });
    const { callsTo } = renderApi(<AvenantFormPage />, [summary]);
    await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
    await user.click(screen.getByRole("radio", { name: "Travaux" }));
    const works = await screen.findByRole("textbox", { name: /plafond de travaux sans accord, F CFA/ });
    await user.clear(works);
    await user.type(works, "400000,50");

    await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

    expect(await screen.findByText(/Saisissez un montant en francs CFA/)).toBeTruthy();
    expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(0);
  });

  it("n'affiche ni motif libre ni avenant de démonstration, mais l'historique des conditions", async () => {
    renderApi(<AvenantFormPage />);

    await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });

    expect(screen.queryByRole("textbox", { name: "Motif" })).toBeNull();
    expect(await screen.findByRole("table", { name: "Historique des conditions du mandat" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("AV-");
  });

  it("propose de recharger le mandat après un conflit de version", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<AvenantFormPage />, [mandateSummary()], { [`POST ${mandatePath("/terms")}`]: problem(409, "mandate_stale_version", "Périmée") });
    await submitFee(user);

    expect(await screen.findByText("Mandat modifié entre-temps")).toBeTruthy();
    const before = callsTo("GET", orgPath("/mandates")).length;
    await user.click(screen.getByRole("button", { name: "Recharger le mandat" }));

    await waitFor(() => { expect(callsTo("GET", orgPath("/mandates")).length).toBeGreaterThan(before); });
  });

  it("rattache un conflit de période à la date d'effet", async () => {
    const user = userEvent.setup();
    renderApi(<AvenantFormPage />, [mandateSummary()], { [`POST ${mandatePath("/terms")}`]: problem(409, "mandate_term_conflict", "Une condition existe déjà à cette date.") });

    await submitFee(user);

    expect(await screen.findByText("Une condition existe déjà à cette date.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("refuse un avenant sans pièce signée, sans téléverser ni écrire", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<AvenantFormPage />);

    await submitFee(user, { signed: false });

    expect(await screen.findByText("Joignez l'avenant signé par le mandant.")).toBeTruthy();
    expect(callsTo("POST", uploadPath)).toHaveLength(0);
    expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(0);
  });

  it("envoie la relocation et le suivi de travaux en points de base", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<AvenantFormPage />, [mandateSummary()], { [`POST ${mandatePath("/terms")}`]: detail({ lock_version: 4 }) });
    await screen.findByRole("heading", { level: 1, name: "Nouvel avenant" });
    await user.type(await screen.findByRole("textbox", { name: /Honoraires de relocation/ }), "50");
    await user.type(screen.getByRole("textbox", { name: /Suivi de travaux/ }), "5,5");

    await submitFee(user);

    await waitFor(() => { expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/terms"))[0]?.body).toMatchObject({ letting_fee_basis_points: 5_000, works_fee_basis_points: 550 });
  });

  it("explique l'analyse antivirus en cours et rejoue l'envoi sans téléverser une seconde fois", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { callsTo } = renderApi(<AvenantFormPage />, [mandateSummary()], {
      [`POST ${mandatePath("/terms")}`]: () => {
        attempts += 1;
        return attempts === 1 ? problem(409, "document_not_clean", "Analyse en cours.") : detail({ lock_version: 4 });
      },
    });

    await submitFee(user);

    expect(await screen.findByText(/n’a pas fini son analyse antivirus/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Valider l'avenant/ }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/terms"))).toHaveLength(2); });
    expect(callsTo("POST", uploadPath)).toHaveLength(1);
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith(`/mandats/${ID.mandate}`); });
  });

  it.each([
    ["mandate_amendment_signature_required", 422],
    ["mandate_document_invalid", 422],
    ["mandate_document_not_found", 404],
  ])("affiche sous la pièce signée le refus %s du serveur", async (code, status) => {
    const user = userEvent.setup();
    renderApi(<AvenantFormPage />, [mandateSummary()], { [`POST ${mandatePath("/terms")}`]: problem(status, code, `Refus ${code}`) });

    await submitFee(user);

    expect(await screen.findByText(`Refus ${code}`)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("refuse l'écran à un comptable", async () => {
    renderApi(<AvenantFormPage />, [mandateSummary()], {}, false);

    expect(await screen.findByText("Action réservée")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Valider l'avenant/ })).toBeNull();
  });
});

describe("renouvellement en mode api", () => {
  it("renouvelle pour la durée de reconduction du mandat", async () => {
    const user = userEvent.setup();
    const expiring = mandateSummary({ end_date: "2027-01-31" });
    const { callsTo } = renderApi(<MandatsPage />, [expiring], { [`POST ${mandatePath("/renew")}`]: detail({ lock_version: 4, end_date: "2028-01-31" }) });
    await user.click(await screen.findByRole("button", { name: "Actions pour le mandat M-2026-0001" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renouveler" }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByText(/reconduit pour 1 an aux mêmes conditions/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Renouveler le mandat" }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/renew"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/renew"))[0]?.body).toEqual({ lock_version: 3, months: 12 });
  });
});
