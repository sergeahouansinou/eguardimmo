"use client";

import { Alert, Button, Card, CardTitle, Select, TextField, useToast } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { FieldRow, FormSection } from "@/components/ui/FormSection";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { agenceRoutes, bailNewHref, bienHref } from "@/espace/routes";
import { useSchemaForm } from "@/features/kit/form";
import { formatDay } from "@/lib/dates";
import { applyRate, formatEuros, formatRate } from "@/lib/money";
import { bienFormSchema, parseDecimal, toMinor } from "../forms";
import type { BienFormValues } from "../forms";
import { plural } from "../labels";
import { useCreateBien, usePortefeuille } from "../queries";
import { isOperational, mandatState } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { NewBien } from "../source";
import { PortefeuilleError } from "../source";

const SERVER_FIELDS = ["mandatId", "name"] as const;
type ServerField = (typeof SERVER_FIELDS)[number];
const isServerField = (field: string | undefined): field is ServerField => SERVER_FIELDS.some((name) => name === field);

export function toNewBien(values: BienFormValues): NewBien {
  return {
    mandatId: values.mandatId,
    name: values.name,
    kind: values.kind,
    surfaceM2: parseDecimal(values.surface) ?? 0,
    street: values.street,
    postalCode: values.postalCode,
    city: values.city,
    floor: values.floor,
    dpe: values.dpe,
    heating: values.heating,
    syndic: values.syndic,
    propertyTax: values.propertyTax,
    targetRentMinor: toMinor(values.rent),
    targetChargesMinor: toMinor(values.charges),
  };
}

export function BienFormPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="Le formulaire de bien">
      {(index) => <BienForm index={index} />}
    </QueryState>
  );
}

function BienForm({ index }: { index: Portefeuille }) {
  const { data } = index;
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const create = useCreateBien();
  const [failure, setFailure] = useState<string>();

  const mandats = data.mandats.filter((mandat) => isOperational(mandatState(mandat, data.todayIso)));
  const requested = params.get("mandat") ?? "";
  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useSchemaForm(bienFormSchema, {
    mandatId: mandats.some((mandat) => mandat.id === requested) ? requested : "",
    name: "",
    kind: "",
    surface: "",
    street: "",
    postalCode: "",
    city: "",
    floor: "",
    dpe: "",
    heating: "",
    syndic: "",
    propertyTax: "",
    rent: "",
    charges: "",
  });
  const values = watch();
  const mandat = index.mandat(values.mandatId);
  const mandant = mandat ? index.mandant(mandat.mandantId) : undefined;
  const rent = parseDecimal(values.rent);
  const charges = parseDecimal(values.charges);
  const called = rent !== null && charges !== null ? toMinor(values.rent) + toMinor(values.charges) : null;
  const address = [values.street.trim(), `${values.postalCode.trim()} ${values.city.trim()}`.trim()].filter(Boolean).join(", ");

  const save = (thenLease: boolean) =>
    handleSubmit(async (formValues) => {
      setFailure(undefined);
      try {
        const bien = await create.mutateAsync(toNewBien(formValues));
        toast.show({ title: "Bien créé", description: `${bien.name}, ${bien.street}` });
        router.push(thenLease ? bailNewHref(bien.id) : bienHref(bien.id));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "L'enregistrement a échoué.";
        if (error instanceof PortefeuilleError && isServerField(error.field)) setError(error.field, { message });
        else setFailure(message);
      }
    });

  const mandatOptions = mandats.map((item) => {
    const owner = index.mandant(item.mandantId);
    return {
      value: item.id,
      label: `${item.number}, ${owner?.name ?? "Mandant inconnu"}`,
      description: `${plural(index.biensOfMandat(item.id).length, "lot", "lots")} · échéance ${formatDay(item.endIso)}`,
    };
  });

  return (
    <form onSubmit={(event) => { void save(false)(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        crumbs={[{ label: "Biens sous mandat", href: agenceRoutes.biens }, { label: "Nouveau bien" }]}
        title="Nouveau bien"
        description="Un lot appartient toujours à un seul mandat. Le bail se crée ensuite, quand un locataire est trouvé."
      />
      {failure ? <Alert tone="danger" title="Enregistrement impossible">{failure}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Mandat de rattachement">
            <Controller
              control={control}
              name="mandatId"
              render={({ field }) => (
                <Select
                  label="Mandat *"
                  placeholder="Choisir un mandat, ex. : M-2025-0142, Marc Chevalier"
                  options={mandatOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  searchable
                  searchPlaceholder="Rechercher un mandat ou un mandant"
                  emptyLabel="Aucun mandat en cours"
                  {...(errors.mandatId?.message ? { error: errors.mandatId.message } : {})}
                />
              )}
            />
            <p className="text-caption text-fg-subtle">
              Le mandant n&apos;a pas encore de mandat ?{" "}
              <Link href={agenceRoutes.mandatNew} className="text-fg-link hover:underline">
                Créer un mandat
              </Link>
            </p>
          </FormSection>

          <FormSection title="Adresse">
            <FieldRow>
              <TextField label="Nom du lot *" placeholder="Apt 8" {...register("name")} {...(errors.name?.message ? { error: errors.name.message } : {})} />
              <TextField label="Type *" placeholder="T3" {...register("kind")} {...(errors.kind?.message ? { error: errors.kind.message } : {})} />
            </FieldRow>
            <TextField label="Adresse *" placeholder="40 rue de Brest" {...register("street")} {...(errors.street?.message ? { error: errors.street.message } : {})} />
            <FieldRow>
              <TextField label="Code postal *" placeholder="69002" inputMode="numeric" {...register("postalCode")} {...(errors.postalCode?.message ? { error: errors.postalCode.message } : {})} />
              <TextField label="Ville *" placeholder="Lyon" {...register("city")} {...(errors.city?.message ? { error: errors.city.message } : {})} />
            </FieldRow>
          </FormSection>

          <FormSection title="Caractéristiques">
            <FieldRow>
              <TextField label="Surface, m² *" placeholder="40" inputMode="decimal" {...register("surface")} {...(errors.surface?.message ? { error: errors.surface.message } : {})} />
              <TextField label="Étage" placeholder="3e sur 5, ascenseur" {...register("floor")} {...(errors.floor?.message ? { error: errors.floor.message } : {})} />
            </FieldRow>
            <FieldRow>
              <TextField label="DPE" placeholder="C, valable jusqu'en 2034" {...register("dpe")} {...(errors.dpe?.message ? { error: errors.dpe.message } : {})} />
              <TextField label="Chauffage" placeholder="Individuel, gaz" {...register("heating")} {...(errors.heating?.message ? { error: errors.heating.message } : {})} />
            </FieldRow>
            <FieldRow>
              <TextField label="Syndic" placeholder="Cabinet Lefèvre" {...register("syndic")} {...(errors.syndic?.message ? { error: errors.syndic.message } : {})} />
              <TextField label="Taxe foncière" placeholder="Payée par le mandant" {...register("propertyTax")} {...(errors.propertyTax?.message ? { error: errors.propertyTax.message } : {})} />
            </FieldRow>
          </FormSection>

          <FormSection title="Loyer visé">
            <FieldRow>
              <TextField label="Loyer hors charges, € *" placeholder="620" inputMode="decimal" {...register("rent")} {...(errors.rent?.message ? { error: errors.rent.message } : {})} />
              <TextField label="Provisions sur charges, € *" placeholder="60" inputMode="decimal" {...register("charges")} {...(errors.charges?.message ? { error: errors.charges.message } : {})} />
            </FieldRow>
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="group" aria-label="Récapitulatif">
            <CardTitle as="h2">Récapitulatif</CardTitle>
            <KeyValueList
              items={[
                { label: "Lot", value: values.name.trim() ? `${values.name.trim()}${values.kind.trim() ? `, ${values.kind.trim()}` : ""}` : "—" },
                { label: "Adresse", value: address || "—" },
                { label: "Mandat", value: mandat?.number ?? "—" },
                { label: "Mandant", value: mandant?.name ?? "—" },
                { label: "Loyer charges comprises visé", value: called === null ? "—" : `${formatEuros(called)} par mois` },
                { label: "Honoraires attendus", value: mandat && mandat.termsMissing !== true && called !== null ? `${formatEuros(applyRate(called, mandat.feeBasisPoints))} par mois (${formatRate(mandat.feeBasisPoints)})` : "—" },
              ]}
            />
          </Card>
          <Card role="group" aria-label="Contrôles">
            <CardTitle as="h2">Contrôles</CardTitle>
            {mandat ? (
              <Alert tone="success">{`Le lot sera couvert par le mandat ${mandat.number} jusqu'au ${formatDay(mandat.endIso)}.`}</Alert>
            ) : (
              <Alert tone="info">Choisissez un mandat pour rattacher le lot.</Alert>
            )}
          </Card>
        </aside>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={agenceRoutes.biens}>Annuler</Link>
        </Button>
        <Button variant="secondary" loading={create.isPending} onClick={(event) => { void save(true)(event); }}>
          Créer et ajouter un bail
        </Button>
        <Button type="submit" loading={create.isPending}>
          Créer le bien
        </Button>
      </div>
    </form>
  );
}
