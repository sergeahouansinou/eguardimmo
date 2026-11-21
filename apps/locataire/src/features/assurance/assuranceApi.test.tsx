import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ID, LEASE_ID, insurance, problem, submission } from "@/tenant/complementsResponses.fixtures";
import { leasePage, summary } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { renderApi, stubApi } from "../../../test/api";
import { captureDownloads } from "../rent/testKit";
import { ApiAssuranceScreen } from "./ApiAssuranceScreen";
import { ApiDepotScreen } from "./ApiDepotScreen";

const LEASES = { "GET /api/v1/tenant/leases": { body: leasePage([summary()]) } };
const INSURANCE = `GET /api/v1/tenant/leases/${LEASE_ID}/insurance`;
const DEPOSIT = `POST /api/v1/tenant/leases/${LEASE_ID}/insurance-submissions`;
const WITHDRAW = `DELETE /api/v1/tenant/insurance-submissions/${ID.submission}`;
const DOWNLOAD = `GET /api/v1/tenant/insurance-submissions/${ID.submission}/download`;
const DEMO_TEXTS = ["Mutuelle Horizon SA", "Koffi Adjovi", "Les Tilleuls"];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 20, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pdf = (name = "attestation.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });

describe("assurance : suivi", () => {
  it("affiche la couverture, les dépôts et le lien de dépôt", async () => {
    stubApi({ ...LEASES, [INSURANCE]: { body: insurance("valid", [submission({ status: "accepted", decided_at: "2026-11-11T08:00:00+00:00" })], "2027-10-31") } });

    const { container } = renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });

    expect(await screen.findByText("Mutuelle Horizon · contrat HAB-2027-48213")).toBeTruthy();
    expect(screen.getAllByText("Couverture valide").length).toBeGreaterThan(0);
    expect(screen.getByText("Acceptée")).toBeTruthy();
    expect(screen.getByText("31/10/2027")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Déposer une attestation" }).getAttribute("href")).toBe(`/assurance/deposer?bail=${LEASE_ID}`);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("alerte quand aucune attestation n’est valable et annonce l’absence de dépôt", async () => {
    stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") } });

    renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });

    expect(await screen.findByText("Aucune attestation valide", { selector: "h3, b, strong, div, p" })).toBeTruthy();
    expect(screen.getByText("Vous n’avez déposé aucune attestation pour ce bail.")).toBeTruthy();
  });

  it("explique un refus avec son motif et sa précision", async () => {
    stubApi({
      ...LEASES,
      [INSURANCE]: { body: insurance("missing", [submission({ status: "rejected", rejection_reason: "wrong_address", note: "Adresse de l’ancien logement." })]) },
    });

    renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });

    expect(await screen.findByText("L’adresse assurée n’est pas celle du logement loué.")).toBeTruthy();
    expect(screen.getByText("Adresse de l’ancien logement.")).toBeTruthy();
    expect(screen.getByText("Attestation refusée")).toBeTruthy();
  });

  it("retire un dépôt en attente après confirmation", async () => {
    const api = stubApi({
      ...LEASES,
      [INSURANCE]: { body: insurance("missing", [submission()]) },
      [WITHDRAW]: { body: { data: submission({ status: "withdrawn", decided_at: "2026-11-20T10:00:00+00:00" }) } },
    });

    const { user } = renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });
    await user.click(await screen.findByRole("button", { name: /Retirer le dépôt Mutuelle Horizon/ }));
    expect(api.count("DELETE", `/api/v1/tenant/insurance-submissions/${ID.submission}`)).toBe(0);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Retirer le dépôt" }));

    await waitFor(() => { expect(api.count("DELETE", `/api/v1/tenant/insurance-submissions/${ID.submission}`)).toBe(1); });
    expect(await screen.findByText("Dépôt retiré")).toBeTruthy();
  });

  it.each(["accepted", "rejected", "withdrawn"] as const)("ne propose pas de retirer un dépôt %s", async (status) => {
    stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing", [submission({ status })]) } });

    renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });
    await screen.findByText("Mutuelle Horizon · contrat HAB-2027-48213");

    expect(screen.queryByRole("button", { name: /Retirer le dépôt/ })).toBeNull();
  });

  it("n’appelle rien quand on renonce à retirer le dépôt", async () => {
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing", [submission()]) } });

    const { user } = renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });
    await user.click(await screen.findByRole("button", { name: /Retirer le dépôt Mutuelle Horizon/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler" }));

    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("traduit le refus du serveur au retrait d’un dépôt déjà traité", async () => {
    stubApi({
      ...LEASES,
      [INSURANCE]: { body: insurance("missing", [submission()]) },
      [WITHDRAW]: { status: 409, body: problem(409, "insurance_submission_not_pending", "x") },
    });

    const { user } = renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });
    await user.click(await screen.findByRole("button", { name: /Retirer le dépôt Mutuelle Horizon/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer le dépôt" }));

    expect(await screen.findByText("Ce dépôt a déjà été accepté, refusé ou retiré : il ne peut plus être modifié.")).toBeTruthy();
  });

  it("télécharge l’attestation déposée", async () => {
    const saved = captureDownloads();
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing", [submission()]) }, [DOWNLOAD]: { pdf: "%PDF-1.4" } });

    const { user } = renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });
    await user.click(await screen.findByRole("button", { name: /Télécharger l’attestation Mutuelle Horizon/ }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(api.count("GET", `/api/v1/tenant/insurance-submissions/${ID.submission}/download`)).toBe(1);
  });

  it("n’offre plus le dépôt sur un bail en période de grâce", async () => {
    stubApi({ ...{ "GET /api/v1/tenant/leases": { body: leasePage([summary({ access: { until: "2027-01-01", in_grace: true } })]) } }, [INSURANCE]: { body: insurance("missing") } });

    renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });

    expect(await screen.findByText("Bail terminé : dépôt impossible")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Déposer une attestation" })).toBeNull();
  });

  it("signale une panne du serveur avec possibilité de réessayer", async () => {
    stubApi({ ...LEASES, [INSURANCE]: { status: 500, body: problem(500, "server_error", "Boom") } });

    renderApi(<ApiAssuranceScreen />, { pathname: "/assurance" });

    expect(await screen.findByText("Votre assurance n’a pas pu être chargée")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});

describe("assurance : dépôt", () => {
  async function fill(user: ReturnType<typeof renderApi>["user"]) {
    await user.type(await screen.findByLabelText("Assureur *"), "Mutuelle Horizon");
    await user.type(screen.getByLabelText("N° de contrat *"), "HAB-2027-48213");
  }

  it("envoie le fichier et les champs au serveur puis revient au suivi", async () => {
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") }, [DEPOSIT]: { status: 201, body: { data: submission() } } });

    const { user } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await fill(user);
    await user.upload(screen.getByLabelText("Déposer l’attestation d’assurance"), pdf());
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));

    await waitFor(() => { expect(api.count("POST", `/api/v1/tenant/leases/${LEASE_ID}/insurance-submissions`)).toBe(1); });
    const call = api.calls.find((item) => item.method === "POST");
    expect(call?.fields).toMatchObject({ insurer: "Mutuelle Horizon", policy_number: "HAB-2027-48213", starts_on: "2026-11-20", ends_on: "2027-11-19" });
    expect(call?.fields.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.files.file).toEqual(["attestation.pdf"]);
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/assurance?bail=${LEASE_ID}`); });
  });

  it("exige le fichier, l’assureur et le numéro avant tout appel", async () => {
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") } });

    const { user } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await user.click(await screen.findByRole("button", { name: "Envoyer l’attestation" }));

    expect(await screen.findByText("Joignez l’attestation.")).toBeTruthy();
    expect(screen.getByText(/L’assureur est obligatoire/)).toBeTruthy();
    expect(screen.getByText(/Le numéro de contrat est obligatoire/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("refuse un fichier d’un format non accepté sans appeler le serveur", async () => {
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") } });

    const { user } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await fill(user);
    fireEvent.change(screen.getByLabelText("Déposer l’attestation d’assurance"), { target: { files: [new File(["x"], "script.exe", { type: "application/x-msdownload" })] } });
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));

    expect(await screen.findByText(/n'est pas d'un format accepté/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("refuse un fichier de plus de 10 Mo", async () => {
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") } });
    const heavy = pdf("lourd.pdf");
    Object.defineProperty(heavy, "size", { value: 11 * 1024 * 1024 });

    const { user } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await fill(user);
    await user.upload(screen.getByLabelText("Déposer l’attestation d’assurance"), heavy);
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));

    expect(await screen.findByText(/dépasse 10 Mo/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("refuse une fin de couverture antérieure au début ou déjà passée", async () => {
    const api = stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") } });

    const { user } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await fill(user);
    await user.upload(screen.getByLabelText("Déposer l’attestation d’assurance"), pdf());
    fireEvent.change(screen.getByLabelText("Date de début *"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("Date de fin *"), { target: { value: "2025-12-31" } });
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));

    expect(await screen.findByText("Cette attestation est déjà expirée.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Date de fin *"), { target: { value: "2024-12-31" } });
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));
    expect(await screen.findByText("La date de fin doit suivre la date de début.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("traduit le refus du fichier par le serveur et rejoue avec le même identifiant après une panne", async () => {
    let attempt = 0;
    const api = stubApi({
      ...LEASES,
      [INSURANCE]: { body: insurance("missing") },
      [DEPOSIT]: () => {
        attempt += 1;
        return attempt === 1 ? { status: 503, body: problem(503, "server_error", "Boom") } : { status: 422, body: problem(422, "file_unsafe", "x") };
      },
    });

    const { user } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await fill(user);
    await user.upload(screen.getByLabelText("Déposer l’attestation d’assurance"), pdf());
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));
    await screen.findByText("L’attestation n’a pas pu être envoyée");
    await user.click(screen.getByRole("button", { name: "Envoyer l’attestation" }));

    expect(await screen.findByText("Ce fichier a été refusé car il contient du code exécutable.")).toBeTruthy();
    const ids = api.calls.filter((call) => call.method === "POST").map((call) => call.fields.client_id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("n’offre pas le formulaire quand un dépôt attend déjà son traitement", async () => {
    stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing", [submission()]) } });

    renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });

    expect(await screen.findByText("Un dépôt est déjà en attente")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer l’attestation" })).toBeNull();
  });

  it("n’offre pas le formulaire sur un bail en période de grâce", async () => {
    stubApi({ "GET /api/v1/tenant/leases": { body: leasePage([summary({ access: { until: "2027-01-01", in_grace: true } })]) }, [INSURANCE]: { body: insurance("missing") } });

    renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });

    expect(await screen.findByText("Dépôt impossible")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer l’attestation" })).toBeNull();
  });

  it("est accessible", async () => {
    stubApi({ ...LEASES, [INSURANCE]: { body: insurance("missing") } });

    const { container } = renderApi(<ApiDepotScreen />, { pathname: "/assurance/deposer" });
    await screen.findByRole("button", { name: "Envoyer l’attestation" });

    await expectNoA11yViolations(container);
  });
});
