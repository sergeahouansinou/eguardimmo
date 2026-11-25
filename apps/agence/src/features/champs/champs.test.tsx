import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { OrgApiError } from "@/features/org/errors";
import { renderOrg } from "@/features/org/testRender";
import { ChampsPage } from "./ChampsPage";
import { ChampsSourceProvider } from "./ChampsSourceProvider";
import { createDemoChamps } from "./demo";
import type { ChampsSource } from "./source";

const access = vi.hoisted(() => ({ settings: true }));

vi.mock("@/features/org/access", () => ({
  useModuleAccess: () => ({ accounting: true, listings: true, settings: access.settings }),
}));

function withSource(source: ChampsSource = createDemoChamps()) {
  return renderOrg(
    <ChampsSourceProvider source={source}>
      <ChampsPage />
    </ChampsSourceProvider>,
  );
}

async function pick(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement | null, name: RegExp, option: string) {
  const scope = dialog === null ? screen : within(dialog);
  await user.click(scope.getByRole("combobox", { name }));
  await user.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  access.settings = true;
});

describe("champs personnalisés, lecture", () => {
  it("liste les champs actifs d’un objet puis change d’objet", async () => {
    const user = userEvent.setup();
    const { container } = withSource();
    const table = await screen.findByRole("table", { name: "Champs personnalisés : lots" });
    expect(within(table).getByText("Code d’accès")).toBeTruthy();
    expect(within(table).getByText("3 options")).toBeTruthy();
    expect(within(table).getByText("Montant")).toBeTruthy();
    expect(within(table).queryByText("Ancien numéro de lot")).toBeNull();
    await expectNoA11yViolations(container);
    await pick(user, null, /Objet/, "Contacts");
    const contacts = await screen.findByRole("table", { name: "Champs personnalisés : contacts" });
    expect(within(contacts).getByText("Forme juridique")).toBeTruthy();
    expect(within(contacts).getByText("Formes juridiques")).toBeTruthy();
  });

  it("affiche les champs archivés à la demande", async () => {
    const user = userEvent.setup();
    withSource();
    await screen.findByRole("table", { name: "Champs personnalisés : lots" });
    await user.click(screen.getByRole("switch", { name: "Afficher les champs archivés" }));
    const row = await screen.findByRole("row", { name: /Ancien numéro de lot/ });
    expect(within(row).getByText("Archivé")).toBeTruthy();
    expect(within(row).getByRole("button", { name: /Restaurer/ })).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /Modifier/ })).toBeNull();
  });

  it("annonce l’absence de champ, l’accès refusé et une panne non vérifiable", async () => {
    const empty: ChampsSource = { ...createDemoChamps(), list: () => Promise.resolve([]) };
    const first = withSource(empty);
    expect(await screen.findByText("Aucun champ personnalisé")).toBeTruthy();
    first.unmount();

    const forbidden: ChampsSource = { ...createDemoChamps(), list: () => Promise.reject(new OrgApiError("forbidden", "Seuls le titulaire et les administrateurs de l’agence modifient les champs personnalisés.", { status: 403 })) };
    const second = withSource(forbidden);
    expect(await screen.findByText("Accès refusé")).toBeTruthy();
    second.unmount();

    const down: ChampsSource = { ...createDemoChamps(), list: () => Promise.reject(new OrgApiError("unavailable", "Le serveur est injoignable.")) };
    withSource(down);
    expect(await screen.findByText(/non vérifiable pour le moment/)).toBeTruthy();
    expect(screen.queryByText("Aucun champ personnalisé")).toBeNull();
  });

  it("n’offre aucune écriture hors titulaire et administrateurs", async () => {
    access.settings = false;
    withSource();
    await screen.findByRole("table", { name: "Champs personnalisés : lots" });
    expect(screen.getByText("Lecture seule")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nouveau champ" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Archiver/ })).toBeNull();
  });
});

describe("champs personnalisés, écriture", () => {
  it("crée un champ à choix avec ses options", async () => {
    const user = userEvent.setup();
    const source = createDemoChamps();
    const create = vi.spyOn(source, "create");
    withSource(source);
    await user.click(await screen.findByRole("button", { name: "Nouveau champ" }));
    const dialog = await screen.findByRole("dialog", { name: "Nouveau champ personnalisé" });
    await user.type(within(dialog).getByRole("textbox", { name: "Libellé" }), "Type de chauffage");
    await user.type(within(dialog).getByRole("textbox", { name: "Clé technique" }), "chauffage");
    await pick(user, dialog, /Type de valeur/, "Choix unique");
    await user.click(within(dialog).getByRole("button", { name: "Ajouter une option" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Option 1" }), "Gaz collectif");
    await user.click(within(dialog).getByRole("button", { name: "Ajouter une option" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Option 2" }), "Électrique");
    await user.click(within(dialog).getByRole("switch", { name: "Champ obligatoire" }));
    await user.click(within(dialog).getByRole("button", { name: "Créer le champ" }));
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith("unit", {
        key: "chauffage",
        labels: { fr: "Type de chauffage" },
        type: "select",
        vocabulary: null,
        options: [
          { key: "gaz_collectif", labels: { fr: "Gaz collectif" } },
          { key: "electrique", labels: { fr: "Électrique" } },
        ],
        required: true,
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByText("Champ créé")).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "Champs personnalisés : lots" })).getByText("Type de chauffage")).toBeTruthy();
  });

  it("bloque l’envoi d’un formulaire incomplet sans appeler le serveur", async () => {
    const user = userEvent.setup();
    const source = createDemoChamps();
    const create = vi.spyOn(source, "create");
    withSource(source);
    await user.click(await screen.findByRole("button", { name: "Nouveau champ" }));
    const dialog = await screen.findByRole("dialog");
    await pick(user, dialog, /Type de valeur/, "Choix multiples");
    await user.click(within(dialog).getByRole("button", { name: "Créer le champ" }));
    expect(await within(dialog).findByText("Indiquez le libellé du champ.")).toBeTruthy();
    expect(within(dialog).getByText(/Utilisez 2 à 40 caractères/)).toBeTruthy();
    expect(within(dialog).getByText("Ajoutez au moins une option.")).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("affiche l’erreur de clé renvoyée par le serveur dans le champ concerné", async () => {
    const user = userEvent.setup();
    withSource();
    await user.click(await screen.findByRole("button", { name: "Nouveau champ" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "Libellé" }), "Code");
    await user.type(within(dialog).getByRole("textbox", { name: "Clé technique" }), "code_acces");
    await user.click(within(dialog).getByRole("button", { name: "Créer le champ" }));
    expect(await within(dialog).findByText("Un champ de cet objet porte déjà cette clé.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("fige le type et la clé d’un champ déjà utilisé et conserve ses options", async () => {
    const user = userEvent.setup();
    const source = createDemoChamps();
    const update = vi.spyOn(source, "update");
    withSource(source);
    await screen.findByRole("table", { name: "Champs personnalisés : lots" });
    await user.click(screen.getByRole("button", { name: /Modifier le champ exposition/ }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier le champ" });
    expect(within(dialog).getByRole<HTMLButtonElement>("combobox", { name: /Type de valeur/ }).disabled).toBe(true);
    expect(within(dialog).getByRole<HTMLInputElement>("textbox", { name: "Clé technique" }).disabled).toBe(true);
    expect(within(dialog).queryByRole("button", { name: /Retirer/ })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Ajouter une option" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Option 4" }), "Nord-ouest");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    const [id, payload] = update.mock.calls[0] ?? [];
    expect(id).toBe("cf-unit-2");
    expect(payload?.options?.map((option) => option.key)).toEqual(["nord", "sud", "est_ouest", "nord_ouest"]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("archive après confirmation puis restaure", async () => {
    const user = userEvent.setup();
    const source = createDemoChamps();
    const archive = vi.spyOn(source, "archive");
    const restore = vi.spyOn(source, "restore");
    withSource(source);
    await screen.findByRole("table", { name: "Champs personnalisés : lots" });
    await user.click(screen.getByRole("button", { name: /Archiver le champ code_acces/ }));
    const dialog = await screen.findByRole("dialog", { name: "Archiver ce champ ?" });
    expect(archive).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Ses valeurs sont conservées/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Archiver" }));
    await waitFor(() => {
      expect(archive).toHaveBeenCalledWith("cf-unit-1");
    });
    await waitFor(() => {
      expect(screen.queryByRole("row", { name: /Code d’accès/ })).toBeNull();
    });
    await user.click(screen.getByRole("switch", { name: "Afficher les champs archivés" }));
    await user.click(await screen.findByRole("button", { name: /Restaurer le champ code_acces/ }));
    await user.click(within(await screen.findByRole("dialog", { name: "Restaurer ce champ ?" })).getByRole("button", { name: "Restaurer" }));
    await waitFor(() => {
      expect(restore).toHaveBeenCalledWith("cf-unit-1");
    });
  });

  it("garde la boîte ouverte et explique l’échec d’un archivage", async () => {
    const user = userEvent.setup();
    const source = createDemoChamps();
    source.archive = () => Promise.reject(new OrgApiError("unavailable", "Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant."));
    withSource(source);
    await screen.findByRole("table", { name: "Champs personnalisés : lots" });
    await user.click(screen.getByRole("button", { name: /Archiver le champ code_acces/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Archiver" }));
    expect(await within(dialog).findByText(/Rien n’a été enregistré/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
