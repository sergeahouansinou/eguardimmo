"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, CardTitle, RadioGroup, Select, TextField, useToast } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { FieldRow, FormSection } from "@/components/ui/FormSection";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { agenceRoutes, mandatHref } from "@/espace/routes";
import { CURRENCIES, currencySymbol, parseAmount, parseRateBasisPoints } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { FEE_BASE_LABELS, FEE_BASE_OPTIONS, FEE_TAX_MODE_LABELS, FEE_TAX_MODE_OPTIONS } from "../feeTerms";
import { UNAVAILABLE, plural } from "../labels";
import { useCreateMandat } from "../queries";
import { PortefeuilleError } from "../source";
import type { MandatFormOptions } from "../source";
import { MutationFailure } from "../shared/MutationFailure";
import type { TermDefaults } from "../api/apiDefaults";
import { defaultsToFormValues, termsFieldOf } from "../termsForm";
import { mandatApiFormSchema, toNewApiMandat } from "./apiForm";
import type { MandatApiFormValues } from "./apiForm";

const PAYOUT_DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: `Le ${String(index + 1)} du mois` }));
const RENEWAL_OPTIONS = [
  { value: "aucune", label: "Sans reconduction" },
  { value: "tacite", label: "Reconduction tacite" },
];
const CURRENCY_OPTIONS = CURRENCIES.map((value) => ({ value, label: value === "EUR" ? "Euro (EUR)" : "Franc CFA (XOF)" }));
const FEE_KIND_OPTIONS = [
  { value: "percentage", label: "Pourcentage des loyers" },
  { value: "flat", label: "Forfait mensuel" },
];

const FIELD_OF_ERROR: Readonly<Record<string, keyof MandatApiFormValues>> = { lots: "units", signedOn: "signedOn", mandantId: "mandantId", typeId: "typeId", startIso: "startIso", endIso: "endIso", feePercent: "feePercent", flatFee: "flatFee", payoutDay: "payoutDay", worksLimit: "worksLimit", feeBase: "feeBase", feeMinimumAmount: "feeMinimum", feeMinimum: "feeMinimum", feeTaxMode: "feeTaxMode", currency: "currency", lettingRate: "lettingRate", worksFeeRate: "worksFeeRate" };

const BLANK_TERMS = {
  currency: "EUR",
  feeKind: "percentage",
  feePercent: "7,00",
  flatFee: "",
  feeMinimum: "0",
  feeBase: "",
  feeTaxMode: "excl_tax",
  payoutDay: "5",
  worksLimit: "500",
  lettingRate: "",
  worksFeeRate: "",
} as const;

export function MandatApiForm({ options, todayIso, defaults }: { options: MandatFormOptions; todayIso: string; defaults: TermDefaults | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const create = useCreateMandat();
  const [failure, setFailure] = useState<{ message: string; error: unknown }>();
  const requested = params.get("mandant") ?? "";
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<MandatApiFormValues>({
    resolver: zodResolver(mandatApiFormSchema),
    defaultValues: {
      mandantId: options.mandants.some((item) => item.id === requested) ? requested : "",
      typeId: options.types.length === 1 ? (options.types[0]?.id ?? "") : "",
      units: [{ unitId: "" }],
      ...(defaults === null ? BLANK_TERMS : defaultsToFormValues(defaults)),
      startIso: todayIso,
      endIso: "",
      renewal: "aucune",
      signedOn: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "units" });
  const values = watch();
  const mandant = options.mandants.find((item) => item.id === values.mandantId);
  const unitsError = errors.units?.message ?? errors.units?.root?.message;

  const save = (draft: boolean) =>
    handleSubmit(async (formValues) => {
      setFailure(undefined);
      if (!draft && formValues.signedOn === "") {
        setError("signedOn", { message: "Indiquez la date de signature pour activer le mandat, ou enregistrez un brouillon." });
        return;
      }
      if (formValues.signedOn > todayIso) {
        setError("signedOn", { message: "La date de signature ne peut pas être dans le futur." });
        return;
      }
      try {
        const mandat = await create.mutateAsync(toNewApiMandat(formValues, draft));
        toast.show({ title: draft || !mandat.signed ? "Brouillon enregistré" : "Mandat créé", description: `Mandat ${mandat.number}` });
        router.push(mandatHref(mandat.id));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "L'enregistrement a échoué.";
        const field = error instanceof PortefeuilleError && error.field ? FIELD_OF_ERROR[termsFieldOf(error.field, formValues.feeKind)] : undefined;
        if (field) setError(field, { message });
        else setFailure({ message, error });
      }
    });

  const mandantOptions = options.mandants.map((item) => ({ value: item.id, label: item.name, description: item.legal }));
  const typeOptions = options.types.map((item) => ({ value: item.id, label: item.label }));
  const unitOptions = options.units.map((item) => ({ value: item.id, label: item.reference, description: item.propertyName }));
  const currency = values.currency;
  const symbol = currencySymbol(currency);
  const fee = values.feeKind === "percentage" ? parseRateBasisPoints(values.feePercent) : parseAmount(values.flatFee, currency);
  const worksLimit = parseAmount(values.worksLimit, currency);

  return (
    <form onSubmit={(event) => { void save(false)(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        crumbs={[{ label: "Mandats", href: agenceRoutes.mandats }, { label: "Nouveau mandat" }]}
        title="Nouveau mandat"
        description="Lots confiés, honoraires et reversement. Un mandat activé couvre ses lots : aucun autre mandat de l'agence ne peut les couvrir sur la même période."
      />
      {defaults === null ? null : (
        <Alert tone="info" title="Conditions préremplies">
          Les honoraires, le reversement et le plafond de travaux viennent des conditions par défaut de l&apos;agence. Modifiez-les librement : seul ce mandat est concerné.{" "}
          <Link href={agenceRoutes.reglagesFinances} className="font-medium underline">Voir les conditions par défaut</Link>
        </Alert>
      )}
      {failure ? <MutationFailure title="Enregistrement impossible" message={failure.message} error={failure.error} /> : null}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Mandant et lots">
            <Controller
              control={control}
              name="mandantId"
              render={({ field }) => (
                <Select label="Mandant *" placeholder="Choisir un mandant, ex. : Claire Vasseur" options={mandantOptions} value={field.value} onValueChange={field.onChange} searchable searchPlaceholder="Rechercher un mandant" {...(errors.mandantId?.message ? { error: errors.mandantId.message } : {})} />
              )}
            />
            <Controller
              control={control}
              name="typeId"
              render={({ field }) => (
                <Select label="Type de mandat *" placeholder="Choisir un type, ex. : Mandat de gestion" options={typeOptions} value={field.value} onValueChange={field.onChange} {...(errors.typeId?.message ? { error: errors.typeId.message } : {})} />
              )}
            />
            <div className="flex flex-col gap-2">
              <span className="text-caption text-fg-muted">Lots confiés *</span>
              {fields.map((field, position) => (
                <div key={field.id} className="flex items-end gap-2">
                  <Controller
                    control={control}
                    name={`units.${String(position)}.unitId` as `units.${number}.unitId`}
                    render={({ field: unit }) => (
                      <Select label={`Lot ${String(position + 1)}`} placeholder="Choisir un lot, ex. : A12" options={unitOptions} value={unit.value} onValueChange={unit.onChange} searchable searchPlaceholder="Rechercher un lot" className="min-w-0 flex-1" />
                    )}
                  />
                  {fields.length > 1 ? (
                    <Button variant="ghost" size="sm" onClick={() => { remove(position); }}>
                      {`Retirer le lot ${String(position + 1)}`}
                    </Button>
                  ) : null}
                </div>
              ))}
              {unitsError ? <p className="text-caption text-fg-danger">{unitsError}</p> : null}
              <div>
                <Button variant="secondary" size="sm" onClick={() => { append({ unitId: "" }); }}>
                  Ajouter un lot
                </Button>
              </div>
            </div>
          </FormSection>

          <FormSection title="Honoraires et reversement">
            <Controller control={control} name="currency" render={({ field }) => <Select label="Devise du mandat *" placeholder="Choisir une devise" options={CURRENCY_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.currency?.message ? { error: errors.currency.message } : {})} />} />
            <Controller control={control} name="feeKind" render={({ field }) => <RadioGroup label="Honoraires" options={FEE_KIND_OPTIONS} value={field.value} onValueChange={field.onChange} />} />
            <FieldRow>
              {values.feeKind === "percentage" ? (
                <TextField label="Taux des loyers encaissés, % *" placeholder="7,00" inputMode="decimal" {...register("feePercent")} {...(errors.feePercent?.message ? { error: errors.feePercent.message } : {})} />
              ) : (
                <TextField label={`Forfait mensuel, ${symbol} *`} placeholder={currency === "XOF" ? "25 000" : "45"} inputMode="decimal" {...register("flatFee")} {...(errors.flatFee?.message ? { error: errors.flatFee.message } : {})} />
              )}
              <Controller control={control} name="payoutDay" render={({ field }) => <Select label="Jour de reversement" placeholder="Choisir un jour" options={PAYOUT_DAY_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.payoutDay?.message ? { error: errors.payoutDay.message } : {})} />} />
            </FieldRow>
            <FieldRow>
              <Controller control={control} name="feeBase" render={({ field }) => <Select label="Base de calcul des honoraires *" placeholder="Choisir une base, ex. : Loyer hors charges" options={FEE_BASE_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.feeBase?.message ? { error: errors.feeBase.message } : {})} />} />
              <Controller control={control} name="feeTaxMode" render={({ field }) => <Select label="Honoraires exprimés *" placeholder="Choisir un mode" options={FEE_TAX_MODE_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.feeTaxMode?.message ? { error: errors.feeTaxMode.message } : {})} />} />
            </FieldRow>
            <FieldRow>
              <TextField label="Honoraires de relocation, % d'un mois de loyer" placeholder="50" inputMode="decimal" hint="Laissez vide si le mandat ne le prévoit pas. La facturation reste manuelle." {...register("lettingRate")} {...(errors.lettingRate?.message ? { error: errors.lettingRate.message } : {})} />
              <TextField label="Suivi de travaux, % du montant des travaux" placeholder="5" inputMode="decimal" hint="Laissez vide si le mandat ne le prévoit pas. La facturation reste manuelle." {...register("worksFeeRate")} {...(errors.worksFeeRate?.message ? { error: errors.worksFeeRate.message } : {})} />
            </FieldRow>
            <FieldRow>
              <TextField label={`Minimum par mois, ${symbol}`} placeholder={currency === "XOF" ? "5 000" : "15"} inputMode="decimal" {...register("feeMinimum")} {...(errors.feeMinimum?.message ? { error: errors.feeMinimum.message } : {})} />
              <TextField label={`Travaux sans accord, jusqu'à (${symbol})`} placeholder={currency === "XOF" ? "250 000" : "500"} inputMode="decimal" {...register("worksLimit")} {...(errors.worksLimit?.message ? { error: errors.worksLimit.message } : {})} />
            </FieldRow>
          </FormSection>

          <FormSection title="Durée">
            <FieldRow>
              <TextField label="Prise d'effet *" type="date" placeholder="01/12/2026" {...register("startIso")} {...(errors.startIso?.message ? { error: errors.startIso.message } : {})} />
              <TextField label="Dernier jour du mandat *" type="date" placeholder="30/11/2029" {...register("endIso")} {...(errors.endIso?.message ? { error: errors.endIso.message } : {})} />
            </FieldRow>
            <Controller control={control} name="renewal" render={({ field }) => <RadioGroup label="Reconduction" options={RENEWAL_OPTIONS} value={field.value} onValueChange={field.onChange} />} />
          </FormSection>

          <FormSection title="Signature">
            <TextField label="Date de signature" type="date" placeholder="13/11/2026" hint="Nécessaire pour activer le mandat. Laissez vide pour enregistrer un brouillon." {...register("signedOn")} {...(errors.signedOn?.message ? { error: errors.signedOn.message } : {})} />
            <p className="text-caption text-fg-subtle">{`${UNAVAILABLE} : le dépôt du mandat signé n'est pas encore relié.`}</p>
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="group" aria-label="Récapitulatif">
            <CardTitle as="h2">Récapitulatif</CardTitle>
            <KeyValueList
              items={[
                { label: "Mandant", value: mandant?.name ?? "—" },
                { label: "Lots", value: plural(values.units.filter((unit) => unit.unitId !== "").length, "lot", "lots") },
                { label: "Honoraires", value: fee === null ? "—" : values.feeKind === "percentage" ? `${values.feePercent} %` : `${formatEuros(fee, currency)} par mois` },
                { label: "Base de calcul", value: values.feeBase === "" ? "—" : FEE_BASE_LABELS[values.feeBase] },
                { label: "Honoraires exprimés", value: FEE_TAX_MODE_LABELS[values.feeTaxMode] },
                { label: "Reversement", value: `Le ${values.payoutDay || "—"}` },
                { label: "Dernier jour", value: values.endIso ? formatDay(values.endIso) : "—" },
                { label: "Travaux sans accord", value: worksLimit === null ? "—" : formatEuros(worksLimit, currency) },
              ]}
            />
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
          Créer et activer le mandat
        </Button>
      </div>
    </form>
  );
}
