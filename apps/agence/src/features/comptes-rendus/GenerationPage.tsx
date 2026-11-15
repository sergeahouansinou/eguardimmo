"use client";

import { Alert, Button, Card, CardHeader, CardTitle, SegmentedControl, Skeleton, TextField } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import type { SubmitEventHandler } from "react";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { FormCheckCards, FormRadioCards, FormSwitch, LinkButton, PageFrame, SummaryLines, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { formatDate, isIsoDate } from "@/features/shared/dates";
import { formatMoneyExact, sum } from "@/features/shared/money";
import { CURRENT_PERIOD, lastDayOf, transferDateOf } from "./compose";
import { apercuHref } from "./labels";
import { useGenerate, usePreview, useReport } from "./queries";
import { CONTENT_KEYS, CONTENT_LABELS, DEFAULT_CONTENT, generationSchema } from "./schemas";
import type { GenerationInput, MandantPreview, PeriodKind } from "./schemas";

const KIND_OPTIONS = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "personnalise", label: "Personnalisé" },
];

const CONTENT_OPTIONS = CONTENT_KEYS.map((key) => ({ value: key, label: CONTENT_LABELS[key] }));

const DIFFUSION_OPTIONS = [
  { value: "planifiee", label: `Publier le ${formatDate(transferDateOf(CURRENT_PERIOD))}`, description: "Avec les reversements" },
  { value: "maintenant", label: "Publier maintenant" },
];

const DEFAULT_RANGE = { from: `${CURRENT_PERIOD}-01`, to: lastDayOf(CURRENT_PERIOD) };

const QUARTER_RANGE = { from: "2026-10-01", to: "2026-12-31" };

function defaultsFor(mandantIds: string[]): GenerationInput {
  return { kind: "mensuel", ...DEFAULT_RANGE, mandantIds, content: [...DEFAULT_CONTENT], publication: "planifiee", notify: true };
}

export function GenerationPage() {
  const params = useSearchParams();
  const reprise = params.get("reprise");
  const mandant = params.get("mandant");
  if (reprise) return <Reprise id={reprise} />;
  return <Loader initial={defaultsFor(mandant ? [mandant] : [])} selectAll={!mandant} />;
}

function Reprise({ id }: { id: string }) {
  const report = useReport(id);
  return (
    <QueryState query={report} label="Le compte rendu">
      {(data) =>
        data === null ? (
          <NotFoundState title="Compte rendu introuvable" description="Ce compte rendu n'existe pas ou n'est plus modifiable." backHref="/comptes-rendus" backLabel="Retour aux comptes rendus" />
        ) : (
          <Loader
            initial={{
              kind: data.kind,
              from: data.from,
              to: data.to,
              mandantIds: [data.statement.mandantId],
              content: data.content,
              publication: data.publication,
              notify: data.notify,
            }}
            selectAll={false}
          />
        )
      }
    </QueryState>
  );
}

function Loader({ initial, selectAll }: { initial: GenerationInput; selectAll: boolean }) {
  const preview = usePreview(initial.from, initial.to);
  return (
    <PageFrame
      crumbs={[{ label: "Comptes rendus", href: "/comptes-rendus" }, { label: "Générer" }]}
      title="Générer les comptes rendus"
      description="Un compte rendu de gestion par mandant, pour la période choisie. Rien n'est envoyé avant votre validation."
    >
      <QueryState query={preview} label="Les mandants à traiter">
        {(data) => <GenerationForm initial={selectAll ? { ...initial, mandantIds: data.map((item) => item.mandantId) } : initial} />}
      </QueryState>
    </PageFrame>
  );
}

function GenerationForm({ initial }: { initial: GenerationInput }) {
  const router = useRouter();
  const notify = useNotify();
  const generate = useGenerate();
  const form = useSchemaForm<GenerationInput, GenerationInput>(generationSchema, initial);
  const [range, setRange] = useState({ from: initial.from, to: initial.to });
  const [formError, setFormError] = useState<string | null>(null);
  const preview = usePreview(range.from, range.to);
  const kind = useWatch({ control: form.control, name: "kind" });
  const selected = useWatch({ control: form.control, name: "mandantIds" });
  const content = useWatch({ control: form.control, name: "content" });
  const { errors } = form.formState;

  const syncRange = (from: string, to: string) => {
    if (isIsoDate(from) && isIsoDate(to) && from <= to) setRange({ from, to });
  };

  const changeKind = (next: PeriodKind) => {
    if (next === "mensuel") {
      form.setValue("from", DEFAULT_RANGE.from);
      form.setValue("to", DEFAULT_RANGE.to);
      syncRange(DEFAULT_RANGE.from, DEFAULT_RANGE.to);
    }
    if (next === "trimestriel") {
      form.setValue("from", QUARTER_RANGE.from);
      form.setValue("to", QUARTER_RANGE.to);
      syncRange(QUARTER_RANGE.from, QUARTER_RANGE.to);
    }
  };

  const available: readonly MandantPreview[] = preview.data ?? [];
  const chosen = available.filter((item) => selected.includes(item.mandantId));
  const withReceipts = content.includes("quittances");

  const run = async (values: GenerationInput, draft: boolean) => {
    setFormError(null);
    const ids = values.mandantIds.filter((id) => available.some((item) => item.mandantId === id));
    if (ids.length === 0) {
      form.setError("mandantIds", { type: "server", message: "Sélectionnez au moins un mandant disponible sur cette période." });
      return;
    }
    try {
      const { ids: created } = await generate.mutateAsync({ ...values, mandantIds: ids, draft });
      const count = created.length;
      const plural = count > 1 ? "s" : "";
      notify.success(draft ? "Brouillon enregistré" : `${String(count)} compte${plural} rendu${plural} généré${plural}`, draft ? "Vous pouvez le reprendre à tout moment." : "Rien n'est envoyé avant la publication.");
      if (draft) router.push("/comptes-rendus");
      else if (count === 1 && created[0]) router.push(apercuHref(created[0]));
      else router.push(values.publication === "maintenant" ? "/comptes-rendus?onglet=envoyes" : "/comptes-rendus?onglet=generes");
    } catch (error) {
      setFormError(applyServerError(form.setError, error));
    }
  };

  const submit = form.handleSubmit((values) => run(values, false));
  const saveDraft = form.handleSubmit((values) => run(values, true));
  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void submit(event);
  };

  const options = available.map((item) => ({
    value: item.mandantId,
    label: item.mandantName,
    description: `${item.mandantKind} · ${String(item.lots)} lot${item.lots > 1 ? "s" : ""}`,
    trailing: formatMoneyExact(item.netMinor),
  }));
  const count = chosen.length;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Période">
            <CardHeader>
              <CardTitle as="h2">Période</CardTitle>
            </CardHeader>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <SegmentedControl
                  label="Type de période"
                  options={KIND_OPTIONS}
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    changeKind(next as PeriodKind);
                  }}
                />
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Du *"
                type="date"
                placeholder="JJ/MM/AAAA"
                readOnly={kind !== "personnalise"}
                error={errors.from?.message}
                {...form.register("from", {
                  onChange: (event: { target: { value: string } }) => {
                    syncRange(event.target.value, form.getValues("to"));
                  },
                })}
              />
              <TextField
                label="Au *"
                type="date"
                placeholder="JJ/MM/AAAA"
                readOnly={kind !== "personnalise"}
                error={errors.to?.message}
                {...form.register("to", {
                  onChange: (event: { target: { value: string } }) => {
                    syncRange(form.getValues("from"), event.target.value);
                  },
                })}
              />
            </div>
          </Card>
          <Card role="region" aria-label="Mandants">
            <CardHeader>
              <CardTitle as="h2">Mandants</CardTitle>
            </CardHeader>
            {preview.isError ? (
              <Alert tone="danger">Les mandants n'ont pas pu être chargés pour cette période.</Alert>
            ) : preview.data === undefined ? (
              <Skeleton shape="block" className="h-40" />
            ) : options.length === 0 ? (
              <Alert tone="warning">Aucun encaissement sur cette période : choisissez d'autres dates.</Alert>
            ) : (
              <FormCheckCards control={form.control} name="mandantIds" legend="Mandants" hideLegend options={options} />
            )}
          </Card>
          <Card role="region" aria-label="Contenu">
            <CardHeader>
              <CardTitle as="h2">Contenu</CardTitle>
            </CardHeader>
            <FormCheckCards control={form.control} name="content" legend="Contenu du compte rendu" hideLegend options={CONTENT_OPTIONS} />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Diffusion">
            <CardHeader>
              <CardTitle as="h2">Diffusion</CardTitle>
            </CardHeader>
            <FormRadioCards control={form.control} name="publication" legend="Diffusion" hideLegend options={DIFFUSION_OPTIONS} />
            <FormSwitch control={form.control} name="notify" label="Prévenir par e-mail" />
          </Card>
          <Card role="region" aria-label="Récapitulatif">
            <CardHeader>
              <CardTitle as="h2">Récapitulatif</CardTitle>
            </CardHeader>
            <SummaryLines
              lines={[
                { label: "Documents", value: count },
                { label: "Lots", value: sum(chosen.map((item) => item.lots)) },
                { label: "Net à reverser", value: formatMoneyExact(sum(chosen.map((item) => item.netMinor))) },
                { label: "Quittances jointes", value: withReceipts ? sum(chosen.map((item) => item.receipts)) : 0 },
              ]}
            />
          </Card>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <LinkButton href="/comptes-rendus" variant="ghost">
          Annuler
        </LinkButton>
        <Button
          variant="secondary"
          disabled={generate.isPending}
          onClick={() => {
            void saveDraft();
          }}
        >
          Enregistrer le brouillon
        </Button>
        <Button type="submit" loading={generate.isPending}>
          {`Générer ${String(count)} compte${count > 1 ? "s" : ""} rendu${count > 1 ? "s" : ""}`}
        </Button>
      </div>
    </form>
  );
}
