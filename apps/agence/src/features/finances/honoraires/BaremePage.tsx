"use client";

import { Alert, Button, Select, TextField } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { FormSelect, LinkButton, PageFrame, SummaryLines, useNotify, useSchemaForm } from "@/features/kit";
import { DEMO_TODAY, addMonths, formatDate } from "@/features/shared/dates";
import { DemoServerError, messageOf } from "@/features/shared/errors";
import { formatMoney, formatMoneyExact } from "@/features/shared/money";
import { BASE_LABELS, basisPointsText, csvAmount, plural, rateText } from "../format";
import { useBaremes, useSaveBareme, useSimulation } from "../hooks";
import type { Baremes } from "../schemas";
import { baremeFormSchema, toBaremeInput } from "./baremeForm";
import type { BaremeFormInput, BaremeFormValues } from "./baremeForm";

type Entry = Baremes[number];

const BASE_OPTIONS = Object.entries(BASE_LABELS).map(([value, label]) => ({ value, label }));
const FIELD_TARGETS: Record<string, keyof BaremeFormInput> = {
  mandateId: "mandateId",
  rateBp: "rate",
  minFeeMinor: "minFee",
  lettingBp: "letting",
  worksBp: "works",
  effectiveFrom: "effectiveFrom",
};

function defaultsOf(entry: Entry): Omit<BaremeFormInput, "effectiveFrom"> {
  return {
    mandateId: entry.mandateId,
    rate: basisPointsText(entry.current.rateBp),
    base: entry.current.base,
    minFee: csvAmount(entry.current.minFeeMinor),
    letting: basisPointsText(entry.current.lettingBp),
    works: basisPointsText(entry.current.worksBp),
  };
}

export function BaremePage() {
  const query = useBaremes();
  const requested = useSearchParams().get("mandat");
  return (
    <QueryState query={query} label="Le barème des honoraires">
      {(entries) => <BaremeForm entries={entries} requested={requested} />}
    </QueryState>
  );
}

function BaremeForm({ entries, requested }: { entries: Baremes; requested: string | null }) {
  const router = useRouter();
  const notify = useNotify();
  const save = useSaveBareme();
  const [formError, setFormError] = useState<string | null>(null);
  const first = entries.find((entry) => entry.mandateId === requested) ?? entries[0];
  const form = useSchemaForm<BaremeFormInput, BaremeFormValues>(baremeFormSchema, {
    ...(first ? defaultsOf(first) : { mandateId: "", rate: "", base: "rent", minFee: "", letting: "", works: "" }),
    effectiveFrom: addMonths(`${DEMO_TODAY.slice(0, 8)}01`, 1),
  });
  const { control, register, setValue, setError, formState } = form;
  const values = useWatch({ control });
  const entry = entries.find((item) => item.mandateId === values.mandateId);
  const simulationInput = toBaremeInput({
    mandateId: values.mandateId ?? "",
    rate: values.rate ?? "",
    base: values.base ?? "rent",
    minFee: values.minFee ?? "",
    letting: values.letting ?? "",
    works: values.works ?? "",
    effectiveFrom: values.effectiveFrom ?? "",
  });
  const simulation = useSimulation(simulationInput);

  const chooseMandate = (mandateId: string) => {
    const next = entries.find((item) => item.mandateId === mandateId);
    if (!next) return;
    const defaults = defaultsOf(next);
    const options = { shouldValidate: formState.isSubmitted };
    setValue("rate", defaults.rate, options);
    setValue("base", defaults.base, options);
    setValue("minFee", defaults.minFee, options);
    setValue("letting", defaults.letting, options);
    setValue("works", defaults.works, options);
  };

  const submit = form.handleSubmit(() => {
    setFormError(null);
    const input = toBaremeInput(form.getValues());
    if (!input) return;
    save.mutate(input, {
      onSuccess: (result) => {
        notify.success("Barème enregistré", `Avenant à signer pour le mandat ${result.mandateRef} envoyé à ${result.mandantName}. Entrée en vigueur le ${formatDate(result.effectiveFrom)}.`);
        router.push("/finances/honoraires");
      },
      onError: (error) => {
        if (!(error instanceof DemoServerError) || Object.keys(error.fieldErrors).length === 0) {
          setFormError(messageOf(error));
          return;
        }
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          const target = FIELD_TARGETS[field];
          if (target) setError(target, { type: "server", message });
          else setFormError(message);
        });
      },
    });
  });

  const simData = simulation.data;
  const difference = simData?.differenceMinor ?? 0;

  return (
    <PageFrame
      crumbs={[{ label: "Honoraires", href: "/finances/honoraires" }, { label: "Barème" }]}
      title="Barème des honoraires"
      description="Les honoraires se règlent mandat par mandat. Toute modification passe par un avenant signé du mandant."
    >
      {formError ? (
        <Alert tone="danger" title="Le barème n'a pas été enregistré">
          {formError}
        </Alert>
      ) : null}
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <SectionCard title="Mandat concerné">
              <div className="px-4 pb-4">
                <Controller
                  control={control}
                  name="mandateId"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Mandat *"
                      placeholder="Choisir un mandat"
                      options={entries.map((item) => ({ value: item.mandateId, label: item.label }))}
                      value={field.value}
                      onValueChange={(next) => {
                        field.onChange(next);
                        chooseMandate(next);
                      }}
                      error={fieldState.error?.message}
                      hint={entry ? `${plural(entry.lots, "lot", "lots")}, loyers de ${formatMoney(entry.monthlyMinor)} par mois, charges comprises.` : undefined}
                    />
                  )}
                />
              </div>
            </SectionCard>
            <SectionCard title="Gestion courante">
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Honoraires de gestion, % TTC *" placeholder="7,00" inputMode="decimal" autoComplete="off" error={formState.errors.rate?.message} {...register("rate")} />
                  <FormSelect control={control} name="base" label="Base de calcul" placeholder="Choisir une base" options={BASE_OPTIONS} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Minimum par lot et par mois, €" placeholder="0,00" inputMode="decimal" autoComplete="off" error={formState.errors.minFee?.message} {...register("minFee")} />
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Prestations annexes">
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Mise en location, % d'un mois de loyer" placeholder="50" inputMode="decimal" autoComplete="off" error={formState.errors.letting?.message} {...register("letting")} />
                  <TextField label="Suivi de travaux, % TTC" placeholder="5,00" inputMode="decimal" autoComplete="off" error={formState.errors.works?.message} {...register("works")} />
                </div>
                <TextField label="Entrée en vigueur *" placeholder="JJ/MM/AAAA" type="date" min={DEMO_TODAY} error={formState.errors.effectiveFrom?.message} {...register("effectiveFrom")} />
              </div>
            </SectionCard>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SectionCard title={`Simulation, ${simData?.periodLabel ?? "dernier mois clos"}`}>
              <div className="px-4 pb-4">
                {simData && simulationInput ? (
                  <SummaryLines
                    lines={[
                      { label: "Loyers encaissés", value: formatMoneyExact(simData.collectedMinor) },
                      { label: `Taux actuel, ${rateText(simData.currentRateBp)}`, value: formatMoneyExact(simData.currentFeeMinor) },
                      { label: `Nouveau taux, ${rateText(simulationInput.rateBp)}`, value: formatMoneyExact(simData.newFeeMinor) },
                      { label: "Écart", value: difference === 0 ? formatMoneyExact(0) : `${difference > 0 ? "+" : "−"}${formatMoneyExact(Math.abs(difference))}` },
                    ]}
                  />
                ) : (
                  <p className="text-body text-fg-subtle">Renseignez un taux valide pour simuler l'effet du nouveau barème sur les loyers encaissés du dernier mois clos.</p>
                )}
              </div>
            </SectionCard>
            <SectionCard title="Avenant">
              <div className="px-4 pb-4">
                <Alert tone="info">
                  {`Un avenant sera généré pour ce mandat et envoyé à ${entry?.name ?? "ce mandant"} pour signature. Il n'est jamais rétroactif.`}
                </Alert>
              </div>
            </SectionCard>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href="/finances/honoraires" variant="ghost">
            Annuler
          </LinkButton>
          <Button type="submit" loading={save.isPending}>
            Enregistrer le barème
          </Button>
        </div>
      </form>
    </PageFrame>
  );
}
