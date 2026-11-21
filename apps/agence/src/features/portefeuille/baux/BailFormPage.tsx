"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, CardTitle, RadioGroup, Select, Textarea, TextField, useToast } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FieldRow, FormSection } from "@/components/ui/FormSection";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { agenceRoutes, bailHref } from "@/espace/routes";
import { formatDay, isoDayOrNull } from "@/lib/dates";
import { applyRate, formatEuros, formatRate } from "@/lib/money";
import { BAIL_KINDS, bailEndIso, bailKindOf, makeBailFormSchema, parseDecimal, toMinor } from "../forms";
import type { BailFormValues } from "../forms";
import { PAYMENT_MODE_LABELS } from "../labels";
import { useCreateBail, usePortefeuille } from "../queries";
import { isOperational, mandatState } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { NewBail } from "../source";
import { PortefeuilleError } from "../source";

const KIND_OPTIONS = BAIL_KINDS.map((kind) => ({ value: kind.value, label: kind.label }));
const DUE_DAY_OPTIONS = Array.from({ length: 28 }, (_, position) => ({ value: String(position + 1), label: `Le ${String(position + 1)} du mois` }));
const PAYMENT_OPTIONS = Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }));

const FIELD_ERRORS = ["bienId", "locataireId", "startIso"] as const;
type ServerField = (typeof FIELD_ERRORS)[number];
const isServerField = (field: string | undefined): field is ServerField => FIELD_ERRORS.some((name) => name === field);

export function toNewBail(values: BailFormValues, draft: boolean): NewBail {
  const kind = bailKindOf(values.kind);
  return {
    bienId: values.bienId,
    locataireId: values.locataireId,
    startIso: values.startIso,
    endIso: bailEndIso(values.startIso, values.kind),
    furnished: kind.furnished,
    rentMinor: toMinor(values.rent),
    chargesMinor: toMinor(values.charges),
    depositMinor: toMinor(values.deposit),
    dueDay: Number(values.dueDay),
    paymentMode: values.paymentMode,
    ...(values.note ? { note: values.note } : {}),
    draft,
  };
}

export function BailFormPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="Le formulaire de bail">
      {(index) => <BailForm index={index} />}
    </QueryState>
  );
}

function BailForm({ index }: { index: Portefeuille }) {
  const { data } = index;
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const create = useCreateBail();
  const [failure, setFailure] = useState<string>();

  const occupiedUntil = useMemo(() => {
    const entries = data.baux.filter((bail) => bail.status === "en_cours" || bail.status === "a_venir").map((bail) => [bail.bienId, bail.endIso] as const);
    return Object.fromEntries(entries);
  }, [data.baux]);
  const schema = useMemo(() => makeBailFormSchema({ occupiedUntil }), [occupiedUntil]);

  const lots = data.biens.filter((bien) => {
    const mandat = index.mandat(bien.mandatId);
    return mandat !== undefined && isOperational(mandatState(mandat, data.todayIso));
  });
  const housed = new Set(data.baux.filter((bail) => bail.status === "en_cours" || bail.status === "a_venir").map((bail) => bail.locataireId));
  const tenants = data.locataires.filter((tenant) => !tenant.archived && !housed.has(tenant.id));

  const requestedLot = params.get("bien") ?? "";
  const requestedTenant = params.get("locataire") ?? "";
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<BailFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bienId: lots.some((bien) => bien.id === requestedLot) ? requestedLot : "",
      locataireId: tenants.some((tenant) => tenant.id === requestedTenant) ? requestedTenant : "",
      startIso: "",
      kind: "vide-3",
      rent: "",
      charges: "",
      deposit: "",
      dueDay: "5",
      paymentMode: "virement",
      note: "",
    },
  });
  const values = watch();
  const bien = index.bien(values.bienId);
  const mandat = bien ? index.mandat(bien.mandatId) : undefined;
  const mandant = bien ? index.mandantOfBien(bien) : undefined;
  const tenant = index.locataire(values.locataireId);
  const rent = parseDecimal(values.rent);
  const charges = parseDecimal(values.charges);
  const called = rent !== null && charges !== null ? toMinor(values.rent) + toMinor(values.charges) : null;
  const end = isoDayOrNull(values.startIso) ? bailEndIso(values.startIso, values.kind) : undefined;
  const depositCap = bailKindOf(values.kind).furnished ? "2 mois" : "1 mois";

  const save = (draft: boolean) =>
    handleSubmit(async (formValues) => {
      setFailure(undefined);
      try {
        const bail = await create.mutateAsync(toNewBail(formValues, draft));
        toast.show({ title: draft ? "Brouillon enregistré" : "Bail créé", description: `Bail ${bail.number}` });
        router.push(bailHref(bail.id));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "L'enregistrement a échoué.";
        if (error instanceof PortefeuilleError && isServerField(error.field)) setError(error.field, { message });
        else setFailure(message);
      }
    });

  const lotOptions = lots.map((lot) => {
    const until = occupiedUntil[lot.id];
    return { value: lot.id, label: `${lot.name}, ${lot.street}`, description: until ? `Occupé jusqu'au ${formatDay(until)}` : "Libre" };
  });
  const tenantOptions = tenants.map((item) => ({ value: item.id, label: item.name, description: item.email }));

  return (
    <form onSubmit={(event) => { void save(false)(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        crumbs={[{ label: "Baux", href: agenceRoutes.baux }, { label: "Nouveau bail" }]}
        title="Nouveau bail"
        description="Un bail relie un lot, un locataire et des conditions. Les honoraires se calculent sur le loyer encaissé."
      />
      {failure ? <Alert tone="danger" title="Enregistrement impossible">{failure}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Lot et locataire">
            <Controller
              control={control}
              name="bienId"
              render={({ field }) => (
                <Select
                  label="Lot *"
                  placeholder="Choisir un lot, ex. : Apt 12"
                  options={lotOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  searchable
                  searchPlaceholder="Rechercher un lot"
                  {...(errors.bienId?.message ? { error: errors.bienId.message } : {})}
                />
              )}
            />
            <Controller
              control={control}
              name="locataireId"
              render={({ field }) => (
                <Select
                  label="Locataire *"
                  placeholder="Choisir un locataire, ex. : Chloé Martin"
                  options={tenantOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  searchable
                  searchPlaceholder="Rechercher un locataire"
                  emptyLabel="Aucun locataire disponible"
                  {...(errors.locataireId?.message ? { error: errors.locataireId.message } : {})}
                />
              )}
            />
            <p className="text-caption text-fg-subtle">
              Le locataire n&apos;est pas dans la liste ?{" "}
              <Link href={agenceRoutes.locataireInvitation} className="text-fg-link hover:underline">
                Inviter un locataire
              </Link>
            </p>
          </FormSection>

          <FormSection title="Durée du bail">
            <Controller control={control} name="kind" render={({ field }) => <RadioGroup label="Type de bail" options={KIND_OPTIONS} value={field.value} onValueChange={field.onChange} />} />
            <FieldRow>
              <TextField label="Date de début *" type="date" placeholder="01/12/2026" {...register("startIso")} {...(errors.startIso?.message ? { error: errors.startIso.message } : {})} />
              <TextField label="Date de fin" placeholder="Calculée à partir du début" value={end ? formatDay(end) : ""} readOnly />
            </FieldRow>
          </FormSection>

          <FormSection title="Loyer et charges">
            <FieldRow>
              <TextField label="Loyer hors charges, € *" placeholder="620" inputMode="decimal" {...register("rent")} {...(errors.rent?.message ? { error: errors.rent.message } : {})} />
              <TextField label="Provisions sur charges, € *" placeholder="60" inputMode="decimal" {...register("charges")} {...(errors.charges?.message ? { error: errors.charges.message } : {})} />
            </FieldRow>
            <FieldRow>
              <TextField
                label="Dépôt de garantie, € *"
                placeholder="620"
                inputMode="decimal"
                hint={`Au plus ${depositCap} de loyer hors charges.`}
                {...register("deposit")}
                {...(errors.deposit?.message ? { error: errors.deposit.message } : {})}
              />
              <Controller
                control={control}
                name="dueDay"
                render={({ field }) => <Select label="Jour d'échéance" placeholder="Choisir un jour" options={DUE_DAY_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.dueDay?.message ? { error: errors.dueDay.message } : {})} />}
              />
            </FieldRow>
            <Controller control={control} name="paymentMode" render={({ field }) => <RadioGroup label="Mode de paiement" options={PAYMENT_OPTIONS} value={field.value} onValueChange={field.onChange} />} />
          </FormSection>

          <FormSection title="Note interne">
            <Textarea label="Note" placeholder="Ex. : visite effectuée le 4 novembre, garant à joindre au dossier." {...register("note")} {...(errors.note?.message ? { error: errors.note.message } : {})} />
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="group" aria-label="Récapitulatif">
            <CardTitle as="h2">Récapitulatif</CardTitle>
            <KeyValueList
              items={[
                { label: "Lot", value: bien ? `${bien.name}, ${bien.street}` : "—" },
                { label: "Locataire", value: tenant?.name ?? "—" },
                { label: "Mandant", value: mandant?.name ?? "—" },
                { label: "Loyer charges comprises", value: called === null ? "—" : `${formatEuros(called)} par mois` },
                { label: "Fin du bail", value: end ? formatDay(end) : "—" },
                { label: "Honoraires", value: mandat && mandat.termsMissing !== true && called !== null ? `${formatEuros(applyRate(called, mandat.feeBasisPoints))} par mois (${formatRate(mandat.feeBasisPoints)})` : "—" },
              ]}
            />
          </Card>
          <Card role="group" aria-label="Contrôles">
            <CardTitle as="h2">Contrôles</CardTitle>
            {bien ? (
              occupiedUntil[bien.id] ? (
                <Alert tone="warning">{`Ce lot est occupé jusqu'au ${formatDay(occupiedUntil[bien.id] ?? "")}. Le bail commence après cette date.`}</Alert>
              ) : (
                <Alert tone="success">Le lot est libre et couvert par le mandat {mandat?.number}.</Alert>
              )
            ) : (
              <Alert tone="info">Choisissez un lot pour vérifier sa disponibilité.</Alert>
            )}
          </Card>
        </aside>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={agenceRoutes.baux}>Annuler</Link>
        </Button>
        <Button variant="secondary" loading={create.isPending} onClick={(event) => { void save(true)(event); }}>
          Enregistrer le brouillon
        </Button>
        <Button type="submit" loading={create.isPending}>
          Créer le bail
        </Button>
      </div>
    </form>
  );
}
