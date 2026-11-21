import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetNavigation } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { AMENDMENT_LOCKED_MESSAGE } from "../api/apiErrors";
import { ID, ORG, documentJson, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, storedFileJson } from "../api/testing";
import type { MockRoute } from "../api/testing";
import { pickOption, renderPortefeuille } from "../testing";
import { MandatDetailPage } from "./MandatDetailPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);
const documentsPath = mandatePath("/documents");
const uploadPath = orgPath("/documents/files");
const pdf = () => new File(["%PDF-1.4"], "diagnostic.pdf", { type: "application/pdf" });
const amendment = documentJson({ id: ID.documentB, kind: "amendment", stored_file_id: ID.signedFile });

function renderDocuments(routes: Record<string, MockRoute> = {}, canWrite = true) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: { body: page([mandateSummary()]) },
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    [`GET ${mandatePath()}`]: { body: { data: mandateDetail() } },
    [`GET ${mandatePath("/end-request")}`]: { body: { data: null } },
    [`GET ${documentsPath}`]: { body: page([documentJson(), amendment]) },
    ...routes,
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, ...renderPortefeuille(<MandatDetailPage id={ID.mandate} />, source) };
}

async function openDocuments(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" });
  await user.click(screen.getByRole("tab", { name: /Documents/ }));
}

beforeEach(() => {
  resetNavigation();
});

describe("documents d'un mandat en mode api", () => {
  it("liste les documents partagés ; l'avenant signé n'est pas retirable", async () => {
    const user = userEvent.setup();
    renderDocuments();
    await openDocuments(user);

    const table = await screen.findByRole("list", { name: "Documents partagés avec le mandant" });

    expect(within(table).getByText("Diagnostic")).toBeTruthy();
    expect(within(table).getByText("Avenant signé")).toBeTruthy();
    expect(within(table).getByRole("button", { name: "Retirer le partage : Diagnostic" })).toBeTruthy();
    expect(within(table).queryByRole("button", { name: /Retirer le partage : Avenant/ })).toBeNull();
    expect(within(table).getByText("Non retirable")).toBeTruthy();
  });

  it("annonce l'absence de document", async () => {
    const user = userEvent.setup();
    renderDocuments({ [`GET ${documentsPath}`]: { body: page([]) } });
    await openDocuments(user);

    expect(await screen.findByText("Aucun document partagé avec le mandant pour le moment.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Documents partagés avec le mandant" })).toBeNull();
  });

  it("propose de réessayer quand la liste ne se charge pas", async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderDocuments({
      [`GET ${documentsPath}`]: () => {
        calls += 1;
        return calls === 1 ? problem(500, "server_error", "Erreur interne.") : { body: page([documentJson()]) };
      },
    });
    await openDocuments(user);

    expect(await screen.findByText("Les documents du mandat n'ont pas pu être chargés")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("list", { name: "Documents partagés avec le mandant" })).toBeTruthy();
  });

  it("téléverse puis partage avec la nature choisie, et recharge la liste", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDocuments({
      [`POST ${uploadPath}`]: { status: 201, body: { data: storedFileJson() } },
      [`POST ${documentsPath}`]: { status: 201, body: { data: documentJson() } },
    });
    await openDocuments(user);
    await screen.findByRole("list", { name: "Documents partagés avec le mandant" });
    await pickOption(user, /Nature du document/, "Diagnostic");
    await user.upload(screen.getByLabelText("Choisir le fichier à partager"), pdf());

    await user.click(screen.getByRole("button", { name: "Téléverser et partager" }));

    await waitFor(() => { expect(callsTo("POST", documentsPath)).toHaveLength(1); });
    expect(callsTo("POST", documentsPath)[0]?.body).toEqual({ stored_file_id: ID.storedFile, kind: "diagnostic" });
    const form = callsTo("POST", uploadPath)[0]?.form;
    expect(form?.get("category")).toBe("supporting");
    expect(form?.get("subject_type")).toBe("mandate");
    expect(form?.get("subject_id")).toBe(ID.mandate);
    expect(await screen.findByText("Document partagé")).toBeTruthy();
    await waitFor(() => { expect(callsTo("GET", documentsPath).length).toBeGreaterThan(1); });
  });

  it("exige un fichier avant tout envoi", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDocuments();
    await openDocuments(user);
    await screen.findByRole("list", { name: "Documents partagés avec le mandant" });

    await user.click(screen.getByRole("button", { name: "Téléverser et partager" }));

    expect(await screen.findByText("Choisissez le fichier à partager.")).toBeTruthy();
    expect(callsTo("POST", uploadPath)).toHaveLength(0);
  });

  it("explique l'analyse antivirus en cours et réessaie le partage sans téléverser de nouveau", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { callsTo } = renderDocuments({
      [`POST ${uploadPath}`]: { status: 201, body: { data: storedFileJson() } },
      [`POST ${documentsPath}`]: () => {
        attempts += 1;
        return attempts === 1 ? problem(409, "document_not_clean", "Analyse en cours.") : { status: 201, body: { data: documentJson() } };
      },
    });
    await openDocuments(user);
    await screen.findByRole("list", { name: "Documents partagés avec le mandant" });
    await user.upload(screen.getByLabelText("Choisir le fichier à partager"), pdf());
    await user.click(screen.getByRole("button", { name: "Téléverser et partager" }));

    expect(await screen.findByText("Analyse antivirus en cours")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer le partage" }));

    await waitFor(() => { expect(callsTo("POST", documentsPath)).toHaveLength(2); });
    expect(callsTo("POST", uploadPath)).toHaveLength(1);
    expect(await screen.findByText("Document partagé")).toBeTruthy();
    expect(screen.queryByText("Analyse antivirus en cours")).toBeNull();
  });

  it("affiche le refus 422 du serveur sans le prendre pour un partage réussi", async () => {
    const user = userEvent.setup();
    renderDocuments({
      [`POST ${uploadPath}`]: { status: 201, body: { data: storedFileJson() } },
      [`POST ${documentsPath}`]: problem(422, "mandate_document_invalid", "Ce fichier ne peut pas être partagé."),
    });
    await openDocuments(user);
    await screen.findByRole("list", { name: "Documents partagés avec le mandant" });
    await user.upload(screen.getByLabelText("Choisir le fichier à partager"), pdf());

    await user.click(screen.getByRole("button", { name: "Téléverser et partager" }));

    expect(await screen.findByText("Ce fichier ne peut pas être partagé.")).toBeTruthy();
    expect(screen.queryByText("Document partagé")).toBeNull();
  });

  it("demande confirmation avant de retirer le partage, et n'appelle rien si l'on annule", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderDocuments({ [`DELETE ${documentsPath}/${ID.documentA}`]: { body: { data: documentJson({ revoked_at: "2026-11-16T10:00:00+00:00" }) } } });
    await openDocuments(user);

    await user.click(await screen.findByRole("button", { name: "Retirer le partage : Diagnostic" }));
    const dialog = await screen.findByRole("dialog");
    expect(callsTo("DELETE", `${documentsPath}/${ID.documentA}`)).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: /Annuler/ }));
    expect(callsTo("DELETE", `${documentsPath}/${ID.documentA}`)).toHaveLength(0);

    await user.click(await screen.findByRole("button", { name: "Retirer le partage : Diagnostic" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer le partage" }));

    await waitFor(() => { expect(callsTo("DELETE", `${documentsPath}/${ID.documentA}`)).toHaveLength(1); });
    expect(await screen.findByText("Partage retiré")).toBeTruthy();
  });

  it("annonce l'échec d'un retrait refusé par le serveur", async () => {
    const user = userEvent.setup();
    renderDocuments({ [`DELETE ${documentsPath}/${ID.documentA}`]: problem(409, "mandate_amendment_document_locked", "Locked.") });
    await openDocuments(user);

    await user.click(await screen.findByRole("button", { name: "Retirer le partage : Diagnostic" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer le partage" }));

    expect(await screen.findByText("Le retrait a échoué")).toBeTruthy();
    expect(await screen.findByText(AMENDMENT_LOCKED_MESSAGE)).toBeTruthy();
    expect(screen.queryByText("Locked.")).toBeNull();
  });

  it("n'offre ni partage ni retrait à un rôle sans droit d'écriture", async () => {
    const user = userEvent.setup();
    renderDocuments({}, false);
    await openDocuments(user);

    await screen.findByRole("list", { name: "Documents partagés avec le mandant" });

    expect(screen.queryByRole("form", { name: "Partager un document avec le mandant" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Retirer le partage/ })).toBeNull();
  });
});
