import { Pagination } from "@eguardimmo/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderScreen } from "../../../test/render";
import { IMAGE_RULES } from "@/features/shared/files";
import { DataTable } from "./DataTable";
import { FileDrop } from "./FileDrop";
import { FormSelect, useSchemaForm } from "./form";
import { LinkButton } from "./LinkButton";
import { useNotify } from "./notify";
import { PageFrame } from "./PageFrame";
import { RadioCards } from "./OptionCards";
import { SwitchRow } from "./SwitchRow";
import { usePagination } from "./usePagination";

interface Row {
  id: string;
  name: string;
  amount: string;
}

const rows: Row[] = [
  { id: "a", name: "Anaïs", amount: "450,00 €" },
  { id: "b", name: "Louis", amount: "510,00 €" },
];

function Table({ empty }: { empty?: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return (
    <DataTable
      caption="Impayés"
      rows={empty ? [] : rows}
      getRowId={(row) => row.id}
      empty={<p>Aucun impayé</p>}
      columns={[
        { id: "name", header: "Locataire", role: "title", cell: (row) => row.name },
        { id: "amount", header: "Reste dû", numeric: true, cell: (row) => row.amount },
      ]}
      footer={{ amount: "960,00 €" }}
      selection={{
        selected,
        rowLabel: (row) => `Sélectionner ${row.name}`,
        onToggle: (id) => {
          setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        },
        onToggleAll: (all) => {
          setSelected(all ? new Set(rows.map((row) => row.id)) : new Set());
        },
      }}
    />
  );
}

describe("DataTable", () => {
  it("affiche lignes, total et sélection multiple", async () => {
    const { container } = render(<Table />);
    expect(screen.getByRole("rowheader", { name: "Anaïs" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Reste dû" })).toBeTruthy();
    expect(screen.getByText("960,00 €")).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: "Sélectionner Anaïs" }));
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Sélectionner Anaïs" }).checked).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner" }));
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Sélectionner Louis" }).checked).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("rend la zone de défilement atteignable au clavier", () => {
    render(<Table />);
    const region = screen.getAllByRole("region").find((candidate) => candidate.contains(screen.getByRole("table")));
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.getAttribute("aria-label")).toMatch(/, défilement horizontal$/);
  });

  it("affiche l’état vide", () => {
    render(<Table empty />);
    expect(screen.getByText("Aucun impayé")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("cartes d’options et interrupteurs", () => {
  it("choisit une option et bascule un interrupteur avec son aide", async () => {
    const onValue = vi.fn<(value: string) => void>();
    const onChecked = vi.fn<(checked: boolean) => void>();
    const { container } = render(
      <>
        <RadioCards
          legend="Diffusion"
          value="later"
          onValueChange={onValue}
          options={[
            { value: "later", label: "Publier le 05/12/2026", description: "Avec les reversements" },
            { value: "now", label: "Publier maintenant" },
          ]}
        />
        <SwitchRow label="Prévenir par e-mail" hint="Au locataire" checked={false} onCheckedChange={onChecked} />
      </>,
    );
    await userEvent.click(screen.getByRole("radio", { name: /Publier maintenant/ }));
    expect(onValue).toHaveBeenCalledWith("now");
    await userEvent.click(screen.getByRole("switch", { name: "Prévenir par e-mail" }));
    expect(onChecked).toHaveBeenCalledWith(true);
    expect(screen.getByText("Au locataire")).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

function Pager() {
  const items = Array.from({ length: 23 }, (_, index) => index);
  const paged = usePagination(items, 10);
  return (
    <div>
      <span data-testid="first">{paged.slice[0]}</span>
      <Pagination total={paged.total} page={paged.page} pageSize={paged.pageSize} onPageChange={paged.setPage} />
    </div>
  );
}

describe("usePagination", () => {
  it("découpe la liste et suit la page courante", async () => {
    render(<Pager />);
    expect(screen.getByText("1 à 10 sur 23")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(screen.getByText("11 à 20 sur 23")).toBeTruthy();
    expect(screen.getByTestId("first").textContent).toBe("10");
  });
});

function Notifier() {
  const notify = useNotify();
  return (
    <button
      type="button"
      onClick={() => {
        notify.success("Paiement enregistré", "450 € rattachés à Studio 4");
      }}
    >
      Valider
    </button>
  );
}

describe("useNotify", () => {
  it("affiche une alerte de succès", async () => {
    renderScreen(<Notifier />);
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByText("Paiement enregistré")).toBeTruthy();
    expect(screen.getByText("450 € rattachés à Studio 4")).toBeTruthy();
  });
});

describe("FileDrop", () => {
  function Host({ onChange }: { onChange: (file: File | null) => void }) {
    const [file, setFile] = useState<File | null>(null);
    return (
      <FileDrop
        title="Déposer le logo"
        hint="PNG ou JPG, 2 Mo au maximum"
        rules={IMAGE_RULES}
        file={file}
        onFileChange={(next) => {
          setFile(next);
          onChange(next);
        }}
      />
    );
  }

  it("accepte une image valide puis la retire", async () => {
    const onChange = vi.fn<(file: File | null) => void>();
    render(<Host onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText("Parcourir"), new File(["x"], "logo.png", { type: "image/png" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: "logo.png" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer le fichier logo.png" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("refuse un format interdit avec un message", async () => {
    const onChange = vi.fn<(file: File | null) => void>();
    render(<Host onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText("Parcourir"), new File(["x"], "script.svg", { type: "image/svg+xml" }), { applyAccept: false });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/Format non accepté/)).toBeTruthy();
  });
});

describe("PageFrame", () => {
  it("rend fil d’ariane, titre et actions", async () => {
    const { container } = render(
      <PageFrame
        crumbs={[{ label: "Finances" }, { label: "Impayés", href: "/finances/impayes" }, { label: "Studio 4" }]}
        title="Impayé, Studio 4"
        description="Anaïs Roux"
        actions={<LinkButton href="/finances/encaissements/nouveau">Saisir un paiement</LinkButton>}
      >
        <p>Contenu</p>
      </PageFrame>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Impayé, Studio 4" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Impayés" }).getAttribute("href")).toBe("/finances/impayes");
    expect(screen.getByRole("link", { name: "Saisir un paiement" }).getAttribute("href")).toBe("/finances/encaissements/nouveau");
    await expectNoA11yViolations(container);
  });
});

const formSchema = z.object({
  mandant: z.string().min(1, "Choisissez un mandant"),
  note: z.string().max(10, "Dix caractères au maximum"),
});

function FormHost({ onValid }: { onValid: (values: z.output<typeof formSchema>) => void }) {
  const form = useSchemaForm(formSchema, { mandant: "", note: "" });
  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(onValid)(event);
      }}
      noValidate
    >
      <FormSelect
        control={form.control}
        name="mandant"
        label="Mandant"
        placeholder="Choisir un mandant"
        options={[{ value: "marc-chevalier", label: "Marc Chevalier" }]}
      />
      <input aria-label="Note" {...form.register("note")} />
      {form.formState.errors.note ? <p>{form.formState.errors.note.message}</p> : null}
      <button type="submit">Enregistrer</button>
    </form>
  );
}

describe("useSchemaForm", () => {
  it("affiche les erreurs Zod puis soumet les valeurs valides", async () => {
    const onValid = vi.fn<(values: z.output<typeof formSchema>) => void>();
    render(<FormHost onValid={onValid} />);
    await userEvent.type(screen.getByLabelText("Note"), "texte beaucoup trop long");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Choisissez un mandant")).toBeTruthy();
    expect(screen.getByText("Dix caractères au maximum")).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("combobox", { name: /Mandant/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Marc Chevalier" }));
    await userEvent.clear(screen.getByLabelText("Note"));
    await userEvent.type(screen.getByLabelText("Note"), "ok");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledTimes(1);
    });
    expect(onValid.mock.calls[0]?.[0]).toEqual({ mandant: "marc-chevalier", note: "ok" });
  });
});
