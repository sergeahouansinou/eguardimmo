import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderScreen } from "../../../test/render";
import { resetNavigation, router } from "../../../test/navigation";
import { DemoServerError } from "@/features/shared/errors";
import { createDemoSource } from "@/features/source";
import { DocumentAddPage } from "./DocumentAddPage";
import { DocumentsPage } from "./DocumentsPage";
import { documentsSchema } from "./schemas";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Élément absent à l’index ${String(index)}`);
  return item;
}

beforeEach(() => {
  resetNavigation();
});

const rowsOf = (name: string) => within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);

async function listed(source: ReturnType<typeof createDemoSource>) {
  return documentsSchema.parse(await source.documents.list()).documents;
}

function pdf(name = "devis.pdf", size = 4096) {
  return new File([new Uint8Array(size).fill(1)], name, { type: "application/pdf" });
}

async function pick(user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("données de démonstration", () => {
  it("contient 64 documents actifs et 12 archivés avec des identifiants et noms uniques", async () => {
    const documents = await listed(createDemoSource());
    expect(documents.filter((document) => !document.archived)).toHaveLength(64);
    expect(documents.filter((document) => document.archived)).toHaveLength(12);
    expect(new Set(documents.map((document) => document.id)).size).toBe(76);
    expect(new Set(documents.map((document) => document.fileName)).size).toBe(76);
    expect(documents.slice(0, 7).map((document) => document.fileName)).toEqual([
      "Mandat M-2025-0142 signé.pdf",
      "Attestation RCP 2026.pdf",
      "Garantie financière 2026.pdf",
      "Compte rendu, octobre 2026.pdf",
      "Devis plomberie Studio 4.pdf",
      "Photo fuite évier.jpg",
      "Bail Anaïs Roux.pdf",
    ]);
  });
});

describe("liste des documents", () => {
  it("affiche 10 documents par page sur 64, les onglets et la pagination", async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(<DocumentsPage />);
    expect(await screen.findByRole("heading", { name: "Documents" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Actifs\s*64/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Archives\s*12/ })).toBeTruthy();
    const rows = rowsOf("Documents actifs");
    expect(rows).toHaveLength(10);
    expect(within(at(rows, 0)).getByText("Mandat M-2025-0142 signé.pdf")).toBeTruthy();
    expect(within(at(rows, 0)).getByText("Marc Chevalier")).toBeTruthy();
    expect(within(at(rows, 0)).getByText("Mandant")).toBeTruthy();
    expect(within(at(rows, 0)).getByText("1,2 Mo")).toBeTruthy();
    expect(within(at(rows, 0)).getByText("14/03/2025")).toBeTruthy();
    expect(within(at(rows, 1)).getByText("Interne")).toBeTruthy();
    expect(within(at(rows, 1)).getByText("212 Ko")).toBeTruthy();
    expect(within(at(rows, 6)).getByText("Anaïs Roux")).toBeTruthy();
    expect(screen.getByText("1 à 10 sur 64")).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(screen.getByText("11 à 20 sur 64")).toBeTruthy();
    expect(rowsOf("Documents actifs")).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: /Précédent/ }));
    expect(screen.getByText("1 à 10 sur 64")).toBeTruthy();
  });

  it("recherche, filtre par rattachement et catégorie, puis réinitialise", async () => {
    const user = userEvent.setup();
    renderScreen(<DocumentsPage />);
    await screen.findByRole("heading", { name: "Documents" });
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un document" }), "plomberie");
    expect(rowsOf("Documents actifs")).toHaveLength(1);
    expect(screen.getByText("1 à 1 sur 1")).toBeTruthy();
    await user.clear(screen.getByRole("searchbox", { name: "Rechercher un document" }));
    await pick(user, /Rattaché à/, "Agence");
    expect(screen.getByText("1 à 8 sur 8")).toBeTruthy();
    await pick(user, /Catégorie/, "Mandat");
    expect(screen.getByText("Aucun document ne correspond")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }));
    expect(screen.getByText("1 à 10 sur 64")).toBeTruthy();
  });

  it("filtre avec les pastilles de partage", async () => {
    const user = userEvent.setup();
    renderScreen(<DocumentsPage />);
    await screen.findByRole("heading", { name: "Documents" });
    await user.click(screen.getByRole("button", { name: "Interne" }));
    const internal = rowsOf("Documents actifs");
    internal.forEach((row) => {
      expect(within(row).getByText("Interne")).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: "Interne" }));
    await user.click(screen.getByRole("button", { name: "Partagé avec le mandant" }));
    rowsOf("Documents actifs").forEach((row) => {
      expect(within(row).getByText(/Mandant/)).toBeTruthy();
    });
  });

  it("archive un document après confirmation puis le désarchive", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<DocumentsPage />, source);
    await screen.findByRole("heading", { name: "Documents" });
    await user.click(screen.getByRole("button", { name: "Ouvrir Attestation RCP 2026.pdf" }));
    const dialog = await screen.findByRole("dialog", { name: "Attestation RCP 2026.pdf" });
    expect(within(dialog).getByText("02/01/2026")).toBeTruthy();
    expect(within(dialog).getByText("31/12/2026")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Archiver" }));
    const confirm = await screen.findByRole("dialog", { name: "Archiver ce document ?" });
    expect(within(confirm).getByText("Archiver ce document ?")).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Archiver" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Actifs\s*63/ })).toBeTruthy();
    });
    expect(screen.getByRole("tab", { name: /Archives\s*13/ })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /Archives/ }));
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un document" }), "RCP");
    await user.click(screen.getByRole("button", { name: "Ouvrir Attestation RCP 2026.pdf" }));
    const archived = await screen.findByRole("dialog", { name: "Attestation RCP 2026.pdf" });
    await user.click(within(archived).getByRole("button", { name: "Désarchiver" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Actifs\s*64/ })).toBeTruthy();
    });
    expect((await listed(source)).find((document) => document.fileName === "Attestation RCP 2026.pdf")?.archived).toBe(false);
  });

  it("modifie le partage d’un document", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<DocumentsPage />, source);
    await screen.findByRole("heading", { name: "Documents" });
    await user.click(screen.getByRole("button", { name: "Ouvrir Devis plomberie Studio 4.pdf" }));
    const dialog = await screen.findByRole("dialog", { name: "Devis plomberie Studio 4.pdf" });
    await user.click(within(dialog).getByRole("button", { name: "Modifier le partage" }));
    await user.click(within(dialog).getByRole("switch", { name: "Visible par le mandant" }));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer le partage" }));
    await waitFor(() => {
      expect(within(screen.getByRole("dialog")).getByText("Mandant")).toBeTruthy();
    });
    expect((await listed(source)).find((document) => document.fileName === "Devis plomberie Studio 4.pdf")?.sharedWithMandant).toBe(true);
  });

  it("n’autorise pas le partage au mandant d’un document de l’agence", async () => {
    const user = userEvent.setup();
    renderScreen(<DocumentsPage />);
    await screen.findByRole("heading", { name: "Documents" });
    await user.click(screen.getByRole("button", { name: "Ouvrir Attestation RCP 2026.pdf" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Modifier le partage" }));
    expect(within(dialog).getByRole<HTMLButtonElement>("switch", { name: "Visible par le mandant" }).disabled).toBe(true);
  });

  it("affiche l’erreur de chargement", async () => {
    const source = createDemoSource();
    source.documents.list = () => Promise.reject(new Error("panne"));
    renderScreen(<DocumentsPage />, source);
    expect(await screen.findByText("Les documents n'a pas pu être chargé")).toBeTruthy();
  });
});

describe("ajout d’un document", () => {
  it("valide le formulaire vide", async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(<DocumentAddPage />);
    await user.click(await screen.findByRole("button", { name: "Déposer le document" }));
    expect(await screen.findByText("Choisissez le rattachement.")).toBeTruthy();
    expect(screen.getByText("Choisissez la catégorie.")).toBeTruthy();
    expect(screen.getByText("Déposez le fichier du document.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("dépose un document et redirige vers la liste", async () => {
    const user = userEvent.setup();
    const source = createDemoSource();
    renderScreen(<DocumentAddPage />, source);
    await user.upload(await screen.findByLabelText("Parcourir"), pdf("Devis plomberie Studio 4 bis.pdf", 98304));
    await pick(user, /Rattaché à/, "Marc Chevalier, mandant");
    await pick(user, /^Bien /, "Studio 4");
    await pick(user, /Catégorie/, "Devis");
    await user.type(screen.getByLabelText("Nom affiché"), "Devis plomberie, Studio 4");
    await user.type(screen.getByLabelText("Date de validité"), "2026-12-13");
    await user.type(screen.getByLabelText("Description"), "Devis de Plomberie Sanvi, 380 € TTC.");
    await user.click(screen.getByRole("switch", { name: "Visible par le mandant" }));
    await user.click(screen.getByRole("button", { name: "Déposer le document" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/documents");
    });
    const [created] = await listed(source);
    expect(created).toMatchObject({
      fileName: "Devis plomberie Studio 4 bis.pdf",
      displayName: "Devis plomberie, Studio 4",
      ownerId: "marc-chevalier",
      lotId: "studio-4",
      tenantId: "anais-roux",
      category: "Devis",
      sharedWithMandant: true,
      sharedWithTenant: false,
      sizeBytes: 98304,
      date: "2026-11-13",
      validUntil: "2026-12-13",
    });
    expect((await listed(source)).filter((document) => !document.archived)).toHaveLength(65);
  });

  it("refuse un exécutable et un fichier trop volumineux", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderScreen(<DocumentAddPage />);
    const input = await screen.findByLabelText("Parcourir");
    await user.upload(input, new File(["MZ"], "installer.exe", { type: "application/x-msdownload" }));
    expect(await screen.findByText(/Format non accepté/)).toBeTruthy();
    const heavy = pdf("scan.pdf", 10);
    Object.defineProperty(heavy, "size", { value: 26 * 1024 * 1024 });
    await user.upload(input, heavy);
    expect(await screen.findByText("Fichier trop volumineux (25 Mo au maximum).")).toBeTruthy();
    expect(screen.queryByText("scan.pdf")).toBeNull();
  });

  it("ne propose pas le partage au locataire sans bien", async () => {
    const user = userEvent.setup();
    renderScreen(<DocumentAddPage />);
    await pick(user, /Rattaché à/, "Marc Chevalier, mandant");
    expect(screen.getByRole<HTMLButtonElement>("switch", { name: "Visible par le locataire" }).disabled).toBe(true);
    await pick(user, /^Bien /, "Studio 4");
    expect(screen.getByRole<HTMLButtonElement>("switch", { name: "Visible par le locataire" }).disabled).toBe(false);
  });

  it("annule et revient à la liste", async () => {
    const user = userEvent.setup();
    renderScreen(<DocumentAddPage />);
    await user.click(await screen.findByRole("button", { name: "Annuler" }));
    expect(router.push).toHaveBeenCalledWith("/documents");
  });
});

describe("règles côté serveur de démonstration", () => {
  const valid = {
    file: { name: "bail.pdf", size: 2048, type: "application/pdf" },
    ownerId: "marc-chevalier",
    lotId: "studio-4",
    category: "Bail",
    displayName: "",
    validUntil: null,
    description: "",
    sharedWithMandant: false,
    sharedWithTenant: false,
  };

  it("assainit le nom du fichier et ne garde jamais de chemin", async () => {
    const source = createDemoSource();
    await source.documents.add({ ...valid, file: { name: "../../etc/Devis <1>.pdf", size: 2048, type: "application/pdf" } });
    const [created] = await listed(source);
    expect(created?.fileName).toBe("Devis _1_.pdf");
    expect(created?.displayName).toBe("Devis _1_.pdf");
  });

  it("refuse un fichier interdit, un bien d’un autre mandant et un partage incohérent", async () => {
    const source = createDemoSource();
    await expect(source.documents.add({ ...valid, file: { name: "virus.exe", size: 2048, type: "" } })).rejects.toBeInstanceOf(DemoServerError);
    await expect(source.documents.add({ ...valid, lotId: "apt-9" })).rejects.toMatchObject({ code: "invalid_lot" });
    await expect(source.documents.add({ ...valid, ownerId: "agence", lotId: null, sharedWithMandant: true })).rejects.toMatchObject({ code: "invalid_sharing" });
    await expect(source.documents.add({ ...valid, lotId: null, sharedWithTenant: true })).rejects.toMatchObject({ code: "invalid_sharing" });
    await expect(source.documents.add({ ...valid, ownerId: "inconnu", lotId: null })).rejects.toMatchObject({ code: "invalid_owner" });
    await expect(source.documents.add({ ...valid, category: "Pirate" })).rejects.toMatchObject({ code: "validation" });
    await expect(source.documents.setArchived("doc-9999", { archived: true })).rejects.toMatchObject({ code: "not_found" });
    expect((await listed(source)).filter((document) => !document.archived)).toHaveLength(64);
  });
});
