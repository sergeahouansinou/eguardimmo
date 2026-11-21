"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, CardTitle, RadioGroup, Select, TextField, useToast } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { FieldRow, FormSection } from "@/components/ui/FormSection";
import { FilePicker } from "@/components/ui/FilePicker";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { agenceRoutes, mandatHref } from "@/espace/routes";
import { parseRateBasisPoints } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { formatEuros, formatRate } from "@/lib/money";
import { mandatFormSchema, parseDecimal, toMinor } from "../forms";
import type { MandatFormValues } from "../forms";
import { plural } from "../labels";
import { useCreateMandat, useMandatFormOptions, usePortefeuille, useTermDefaults } from "../queries";
import type { Portefeuille } from "../selectors";
import type { NewMandat } from "../source";
import { PortefeuilleError } from "../source";
import { MandatApiForm } from "./MandatApiForm";

const EMPTY_LOT = { name: "", kind: "", surface: "", street: "", postalCode: "", city: "" };

const PAYOUT_DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: `Le ${String(index + 1)} du mois` }));

const RENEWAL_OPTIONS = [
  { value: "aucune", label: "Sans reconduction" },
  { value: "tacite", label: "Reconduction tacite" },
];

export function toNewMandat(values: MandatFormValues, signed: boolean): NewMandat {
  return {
    mandantId: values.mandantId,
    lots: values.lots.map((lot) => ({
      name: lot.name.trim(),
      kind: lot.kind.trim(),
      surfaceM2: parseDecimal(lot.surface) ?? 0,
      street: lot.street.trim(),
      postalCode: lot.postalCode,
      city: lot.city.trim(),
    })),
    feeBasisPoints: parseRateBasisPoints(values.feePercent) ?? 0,
    payoutDay: Number(values.payoutDay),
    worksLimitMinor: toMinor(values.worksLimit),
    renewal: values.renewal,
    startIso: values.startIso,
    endIso: values.endIso,
    signed,
  };
}

export function MandatFormPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="Le formulaire de mandat">
      {(index) => (index.isApi ? <MandatApiFormLoader todayIso={index.data.todayIso} /> : <MandatForm index={index} />)}
    </QueryState>
  );
}

function MandatApiFormLoader({ todayIso }: { todayIso: string }) {
  const options = useMandatFormOptions();
  const defaults = useTermDefaults();
  return (
    <QueryState query={{ isPending: options.isPending || defaults.kind === "loading", isError: options.isError, data: options.data }} label="Les choix du formulaire de mandat">
      {(loaded) => (
        <>
          {defaults.kind === "unverifiable" ? (
            <Alert tone="warning" title="Conditions par défaut indisponibles">
              <span className="flex flex-wrap items-center gap-2">
                Le formulaire n&apos;est pas prérempli : saisissez les conditions à la main.
                <Button variant="secondary" size="sm" onClick={defaults.retry}>Réessayer</Button>
              </span>
            </Alert>
          ) : null}
          <MandatApiForm key={defaults.kind === "ready" ? "prefilled" : "blank"} options={loaded} todayIso={todayIso} defaults={defaults.kind === "ready" ? defaults.defaults : null} />
        </>
      )}
    </QueryState>
  );
}

function MandatForm({ index }: { index: Portefeuille }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const create = useCreateMandat();
  const [failure, setFailure] = useState<string>();
  const requested = params.get("mandant") ?? "";
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<MandatFormValues>({
    resolver: zodResolver(mandatFormSchema),
    defaultValues: {
      mandantId: index.mandant(requested) ? requested : "",
      lots: [EMPTY_LOT],
      feePercent: "7,00",
      payoutDay: "5",
      worksLimit: "500",
      startIso: "",
      endIso: "",
      renewal: "aucune",
      signedFileName: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lots" });
  const values = watch();
  const mandant = index.mandant(values.mandantId);
  const fee = parseRateBasisPoints(values.feePercent);

  const save = (draft: boolean) =>
    handleSubmit(async (formValues) => {
      setFailure(undefined);
      if (!draft && !formValues.signedFileName) {
        setError("signedFileName", { message: "Joignez le mandat signé pour le créer, ou enregistrez un brouillon." });
        return;
      }
      try {
        const mandat = await create.mutateAsync(toNewMandat(formValues, !draft));
        toast.show({ title: draft ? "Brouillon enregistré" : "Mandat créé", description: `Mandat ${mandat.number}` });
        router.push(mandatHref(mandat.id));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "L'enregistrement a échoué.";
        if (error instanceof PortefeuilleError && error.field === "lots") setError("lots", { message });
        else setFailure(message);
      }
    });

  const mandantOptions = index.data.mandants.map((item) => ({ value: item.id, label: item.name, description: item.legal }));
  const lotsError = errors.lots?.message ?? errors.lots?.root?.message;

  return (
    <form onSubmit={(event) => { void save(false)(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        crumbs={[{ label: "Mandats", href: agenceRoutes.mandats }, { label: "Nouveau mandat" }]}
        title="Nouveau mandat"
        description="Biens confiés, honoraires et reversement. Le mandat doit être signé avant tout encaissement."
      />
      {failure ? <Alert tone="danger" title="Enregistrement impossible">{failure}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Mandant et biens">
            <Controller
              control={control}
              name="mandantId"
              render={({ field }) => (
                <Select
                  label="Mandant *"
                  placeholder="Choisir un mandant, ex. : Claire Vasseur"
                  options={mandantOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  searchable
                  searchPlaceholder="Rechercher un mandant"
                  {...(errors.mandantId?.message ? { error: errors.mandantId.message } : {})}
                />
              )}
            />
            <div className="flex flex-col gap-2">
              <span className="text-caption text-fg-muted">Biens confiés *</span>
              {fields.map((field, position) => {
                const lotErrors = errors.lots?.[position];
                return (
                  <fieldset key={field.id} className="flex flex-col gap-2 rounded-md border border-line p-3">
                    <legend className="px-1 text-caption text-fg-subtle">{`Lot ${String(position + 1)}`}</legend>
                    <FieldRow>
                      <TextField label="Nom du lot *" placeholder="Apt 8" {...register(`lots.${String(position)}.name` as `lots.${number}.name`)} {...(lotErrors?.name?.message ? { error: lotErrors.name.message } : {})} />
                      <TextField label="Type *" placeholder="T3" {...register(`lots.${String(position)}.kind` as `lots.${number}.kind`)} {...(lotErrors?.kind?.message ? { error: lotErrors.kind.message } : {})} />
                    </FieldRow>
                    <FieldRow>
                      <TextField label="Surface, m² *" placeholder="40" inputMode="decimal" {...register(`lots.${String(position)}.surface` as `lots.${number}.surface`)} {...(lotErrors?.surface?.message ? { error: lotErrors.surface.message } : {})} />
                      <TextField label="Adresse *" placeholder="40 rue de Brest" {...register(`lots.${String(position)}.street` as `lots.${number}.street`)} {...(lotErrors?.street?.message ? { error: lotErrors.street.message } : {})} />
                    </FieldRow>
                    <FieldRow>
                      <TextField label="Code postal *" placeholder="69002" inputMode="numeric" {...register(`lots.${String(position)}.postalCode` as `lots.${number}.postalCode`)} {...(lotErrors?.postalCode?.message ? { error: lotErrors.postalCode.message } : {})} />
                      <TextField label="Ville *" placeholder="Lyon" {...register(`lots.${String(position)}.city` as `lots.${number}.city`)} {...(lotErrors?.city?.message ? { error: lotErrors.city.message } : {})} />
                    </FieldRow>
                    {fields.length > 1 ? (
                      <div>
                        <Button variant="ghost" size="sm" onClick={() => { remove(position); }}>
                          {`Retirer le lot ${String(position + 1)}`}
                        </Button>
                      </div>
                    ) : null}
                  </fieldset>
                );
              })}
              {lotsError ? <p className="text-caption text-fg-danger">{lotsError}</p> : null}
              <div>
                <Button variant="secondary" size="sm" onClick={() => { append(EMPTY_LOT); }}>
                  Ajouter un lot
                </Button>
              </div>
              <p className="text-caption text-fg-subtle">Seuls les biens du mandant peuvent être ajoutés.</p>
            </div>
          </FormSection>

          <FormSection title="Honoraires et reversement">
            <FieldRow>
              <TextField label="Honoraires de gestion, % TTC *" placeholder="7,00" inputMode="decimal" {...register("feePercent")} {...(errors.feePercent?.message ? { error: errors.feePercent.message } : {})} />
              <TextField label="Base de calcul" placeholder="Loyers encaissés" value="Loyers encaissés" readOnly />
            </FieldRow>
            <FieldRow>
              <Controller
                control={control}
                name="payoutDay"
                render={({ field }) => (
                  <Select label="Jour de reversement" placeholder="Choisir un jour" options={PAYOUT_DAY_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.payoutDay?.message ? { error: errors.payoutDay.message } : {})} />
                )}
              />
              <TextField label="Travaux sans accord, jusqu'à (€)" placeholder="500" inputMode="decimal" {...register("worksLimit")} {...(errors.worksLimit?.message ? { error: errors.worksLimit.message } : {})} />
            </FieldRow>
          </FormSection>

          <FormSection title="Durée">
            <FieldRow>
              <TextField label="Prise d'effet *" type="date" placeholder="01/12/2026" {...register("startIso")} {...(errors.startIso?.message ? { error: errors.startIso.message } : {})} />
              <TextField label="Échéance *" type="date" placeholder="30/11/2029" {...register("endIso")} {...(errors.endIso?.message ? { error: errors.endIso.message } : {})} />
            </FieldRow>
            <Controller control={control} name="renewal" render={({ field }) => <RadioGroup label="Reconduction" options={RENEWAL_OPTIONS} value={field.value} onValueChange={(next) => { field.onChange(next); }} />} />
          </FormSection>

          <FormSection title="Mandat signé">
            <FilePicker
              label="Joindre le mandat signé"
              hint="PDF, 10 Mo au maximum"
              accept="application/pdf"
              maxBytes={10_000_000}
              fileName={values.signedFileName}
              onFileName={(name) => { setValue("signedFileName", name, { shouldValidate: false }); }}
            />
            {errors.signedFileName?.message ? <p className="text-caption text-fg-danger">{errors.signedFileName.message}</p> : null}
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="group" aria-label="Récapitulatif">
            <CardTitle as="h2">Récapitulatif</CardTitle>
            <KeyValueList
              items={[
                { label: "Mandant", value: mandant?.name ?? "—" },
                { label: "Biens", value: plural(values.lots.filter((lot) => lot.name.trim() !== "").length, "lot", "lots") },
                { label: "Honoraires", value: fee === null ? "—" : `${formatRate(fee)} TTC` },
                { label: "Reversement", value: `Le ${values.payoutDay || "—"}` },
                { label: "Échéance", value: values.endIso ? formatDay(values.endIso) : "—" },
                { label: "Travaux sans accord", value: parseDecimal(values.worksLimit) === null ? "—" : formatEuros(toMinor(values.worksLimit)) },
              ]}
            />
          </Card>
          <Card role="group" aria-label="Contrôles">
            <CardTitle as="h2">Contrôles</CardTitle>
            {mandant ? (
              <Alert tone="success">Compte de reversement vérifié (IBAN •••• {mandant.ibanLast4}), garantie financière en cours de validité.</Alert>
            ) : (
              <Alert tone="info">Choisissez un mandant pour vérifier son compte de reversement.</Alert>
            )}
          </Card>
        </aside>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={agenceRoutes.mandats}>Annuler</Link>
        </Button>
        <Button variant="secondary" loading={create.isPending} onClick={(event) => { void save(true)(event); }}>
          Enregistrer le brouillon
        </Button>
        <Button type="submit" loading={create.isPending}>
          Créer le mandat
        </Button>
      </div>
    </form>
  );
}
