"use client";

import { Alert, Button, Card, CardTitle, RadioGroup, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Textarea, TextField, useToast } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { FormSection } from "@/components/ui/FormSection";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { agenceRoutes, mandatHref } from "@/espace/routes";
import { useSchemaForm } from "@/features/kit/form";
import { currencySymbol, parseAmount, parseRateBasisPoints } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { applyRate, formatEuros, formatRate } from "@/lib/money";
import { FEE_BASE_LABELS, FEE_BASE_OPTIONS, FEE_TAX_MODE_LABELS, FEE_TAX_MODE_OPTIONS } from "../feeTerms";
import { AVENANT_KINDS, makeAvenantFormSchema } from "../forms";
import { currencyOfMandat, feeText } from "../labels";
import { useCreateAvenant, useMandatDetail, useMandatFileUpload, usePortefeuille, usePortefeuilleAccess } from "../queries";
import { calledMinor, isOperational, mandatState } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { Avenant, AvenantKind } from "../schemas";
import { PortefeuilleError } from "../source";
import { MutationFailure } from "../shared/MutationFailure";
import { TermsHistoryTable } from "../shared/TermsHistoryTable";
import { WriteForbidden } from "../shared/WriteForbidden";
import { AvenantSignedFile } from "./AvenantSignedFile";
import { termDefaults, toNewAvenant } from "./avenantPayload";

const PAYOUT_OPTIONS = Array.from({ length: 28 }, (_, position) => ({ value: String(position + 1), label: `Le ${String(position + 1)} du mois` }));
const KIND_OPTIONS = AVENANT_KINDS.map((kind) => ({ value: kind.value, label: kind.label }));
const KIND_LABELS: Record<AvenantKind, string> = { honoraires: "Honoraires", duree: "Durée", reversement: "Reversement", travaux: "Travaux" };

const SERVER_FIELDS = ["mandatId", "effectIso", "endIso", "feePercent", "payoutDay", "worksLimit", "feeBase", "feeMinimum", "feeTaxMode", "lettingRate", "worksFeeRate"] as const;
type ServerField = (typeof SERVER_FIELDS)[number];
const isServerField = (field: string | undefined): field is ServerField => SERVER_FIELDS.some((name) => name === field);

export function AvenantFormPage() {
  const query = usePortefeuille();
  const { canWrite } = usePortefeuilleAccess();
  if (!canWrite) return <WriteForbidden title="Nouvel avenant" backHref={agenceRoutes.mandats} backLabel="Retour aux mandats" />;
  return (
    <QueryState query={query} label="Le formulaire d'avenant">
      {(index) => <AvenantForm index={index} />}
    </QueryState>
  );
}

function AvenantForm({ index }: { index: Portefeuille }) {
  const { data } = index;
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const create = useCreateAvenant();
  const [failure, setFailure] = useState<{ message: string; error: unknown }>();
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const uploadSigned = useMandatFileUpload();
  const api = index.isApi;

  const mandats = data.mandats.filter((mandat) => {
    const state = mandatState(mandat, data.todayIso);
    return !mandat.archived && isOperational(state) && state !== "resilie";
  });
  const endIsoByMandat = useMemo(() => Object.fromEntries(data.mandats.map((mandat) => [mandat.id, mandat.endIso])), [data.mandats]);
  const currencyByMandat = useMemo(() => Object.fromEntries(data.mandats.map((mandat) => [mandat.id, currencyOfMandat(mandat)])), [data.mandats]);
  const schema = useMemo(() => makeAvenantFormSchema({ todayIso: data.todayIso, endIsoByMandat, currencyByMandat, api }), [data.todayIso, endIsoByMandat, currencyByMandat, api]);

  const requested = params.get("mandat") ?? "";
  const initial = mandats.find((mandat) => mandat.id === requested);
  const { register, control, handleSubmit, watch, setValue, setError, formState: { errors } } = useSchemaForm(schema, {
    mandatId: initial?.id ?? "",
    kind: "honoraires",
    effectIso: data.todayIso,
    ...termDefaults(initial),
    endIso: "",
    payoutDay: initial ? String(initial.payoutDay) : "5",
    note: "",
  });
  const values = watch();
  const mandat = index.mandat(values.mandatId);
  const currency = currencyOfMandat(mandat);
  const mandant = mandat ? index.mandant(mandat.mandantId) : undefined;
  const history = data.avenants.filter((avenant) => avenant.mandatId === values.mandatId);
  const detail = useMandatDetail(api ? values.mandatId : "").data;
  const lots = mandat ? index.biensOfMandat(mandat.id) : [];
  const called = lots.flatMap((lot) => index.currentBail(lot.id) ?? []).reduce((sum, bail) => sum + calledMinor(bail), 0);

  const buildPreview = () => {
    if (!mandat) return undefined;
    if (values.kind === "honoraires") {
      const next = parseRateBasisPoints(values.feePercent) ?? undefined;
      return {
        label: "Honoraires de gestion",
        previous: feeText(mandat, false),
        next: next === undefined ? "—" : formatRate(next),
        impact: next === undefined || api ? undefined : `${formatEuros(applyRate(called, next))} par mois sur ${formatEuros(called)} de loyers appelés, contre ${formatEuros(applyRate(called, mandat.feeBasisPoints))} aujourd'hui.`,
      };
    }
    if (values.kind === "duree") return { label: "Échéance du mandat", previous: formatDay(mandat.endIso), next: /^\d{4}-\d{2}-\d{2}$/.test(values.endIso) ? formatDay(values.endIso) : "—" };
    if (values.kind === "reversement") return { label: "Jour de reversement", previous: `Le ${String(mandat.payoutDay)}`, next: `Le ${values.payoutDay}` };
    const limit = parseAmount(values.worksLimit, currency);
    return { label: "Travaux sans accord", previous: formatEuros(mandat.worksLimitMinor, currency), next: limit === null ? "—" : formatEuros(limit, currency) };
  };
  const preview = buildPreview();

  const needsSignedFile = api && values.kind !== "duree";

  const submit = handleSubmit(async (formValues) => {
    setFailure(undefined);
    setFileError(undefined);
    if (needsSignedFile && signedFile === null) {
      setFileError("Joignez l'avenant signé par le mandant.");
      return;
    }
    try {
      const signedFileId = needsSignedFile && signedFile !== null ? await uploadSigned(formValues.mandatId, signedFile) : undefined;
      const avenant = await create.mutateAsync({ ...toNewAvenant(formValues, { api, currency, ...(mandat ? { current: mandat } : {}) }), ...(signedFileId === undefined ? {} : { signedFileId }) });
      toast.show({
        title: avenant.applied ? "Avenant appliqué" : "Avenant programmé",
        description: `${[avenant.number, mandat?.number].filter(Boolean).join(", ")}${avenant.applied ? "" : `, effet le ${formatDay(avenant.effectIso)}`}`,
      });
      router.push(mandatHref(avenant.mandatId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "L'enregistrement a échoué.";
      if (error instanceof PortefeuilleError && (error.field === "signedFile" || error.field === "file")) setFileError(message);
      else if (error instanceof PortefeuilleError && isServerField(error.field)) setError(error.field, { message });
      else setFailure({ message, error });
    }
  });

  const mandatOptions = mandats.map((item) => ({
    value: item.id,
    label: `${item.number}, ${index.mandant(item.mandantId)?.name ?? "Mandant inconnu"}`,
    description: `${feeText(item, !api)} · échéance ${formatDay(item.endIso)}`,
  }));
  const immediate = values.effectIso === data.todayIso;

  const historyColumns = (avenant: Avenant) => (
    <TableRow key={avenant.id}>
      <TableCell strong>{avenant.number}</TableCell>
      <TableCell>{KIND_LABELS[avenant.kind]}</TableCell>
      <TableCell>{`${avenant.previous} → ${avenant.next}`}</TableCell>
      <TableCell>{formatDay(avenant.effectIso)}</TableCell>
      <TableCell>
        <PillBadge pill={avenant.applied ? { tone: "success", label: "Appliqué" } : { tone: "info", label: "Programmé" }} />
      </TableCell>
    </TableRow>
  );

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        crumbs={[{ label: "Mandats", href: agenceRoutes.mandats }, ...(mandat ? [{ label: mandat.number, href: mandatHref(mandat.id) }] : []), { label: "Nouvel avenant" }]}
        title="Nouvel avenant"
        description="Un avenant modifie une condition du mandat sans le refaire. Il s'ajoute à l'historique du mandat."
      />
      {failure ? <MutationFailure title="Enregistrement impossible" message={failure.message} error={failure.error} /> : null}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Mandat concerné">
            <Controller
              control={control}
              name="mandatId"
              render={({ field }) => (
                <Select
                  label="Mandat *"
                  placeholder="Choisir un mandat, ex. : M-2025-0142, Marc Chevalier"
                  options={mandatOptions}
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    const chosen = index.mandat(next);
                    if (chosen) {
                      const defaults = termDefaults(chosen);
                      setValue("feePercent", defaults.feePercent);
                      setValue("payoutDay", String(chosen.payoutDay));
                      setValue("worksLimit", defaults.worksLimit);
                      setValue("feeBase", defaults.feeBase);
                      setValue("feeMinimum", defaults.feeMinimum);
                      setValue("feeTaxMode", defaults.feeTaxMode);
                      setValue("lettingRate", defaults.lettingRate);
                      setValue("worksFeeRate", defaults.worksFeeRate);
                    }
                  }}
                  searchable
                  searchPlaceholder="Rechercher un mandat ou un mandant"
                  emptyLabel="Aucun mandat modifiable"
                  {...(errors.mandatId?.message ? { error: errors.mandatId.message } : {})}
                />
              )}
            />
            {mandat ? (
              <KeyValueList
                columns={2}
                items={[
                  { label: "Mandant", value: mandant?.name ?? "—" },
                  { label: "Période", value: `${formatDay(mandat.startIso)} au ${formatDay(mandat.endIso)}` },
                  { label: "Honoraires", value: feeText(mandat, !api) },
                  { label: "Reversement", value: `Le ${String(mandat.payoutDay)} du mois` },
                  ...(api
                    ? [
                        { label: "Base de calcul", value: mandat.feeBase ? FEE_BASE_LABELS[mandat.feeBase] : "Non renseignée" },
                        { label: "Minimum par mois", value: formatEuros(mandat.feeMinimumMinor ?? 0, currency) },
                        { label: "Honoraires exprimés", value: mandat.feeTaxMode ? FEE_TAX_MODE_LABELS[mandat.feeTaxMode] : "Non renseigné" },
                        { label: "Relocation", value: mandat.lettingFeeBasisPoints === undefined ? "Non prévue" : `${formatRate(mandat.lettingFeeBasisPoints)} d'un mois de loyer` },
                        { label: "Suivi de travaux", value: mandat.worksFeeBasisPoints === undefined ? "Non prévu" : `${formatRate(mandat.worksFeeBasisPoints)} des travaux` },
                      ]
                    : []),
                ]}
              />
            ) : null}
          </FormSection>

          <FormSection title="Objet de l'avenant">
            <Controller control={control} name="kind" render={({ field }) => <RadioGroup label="Type d'avenant" options={KIND_OPTIONS} value={field.value} onValueChange={field.onChange} />} />
            <p className="text-caption text-fg-subtle">{AVENANT_KINDS.find((kind) => kind.value === values.kind)?.description}</p>
            {values.kind === "honoraires" ? (
              <>
                <TextField label={api ? "Nouveaux honoraires, % des loyers *" : "Nouveaux honoraires, % TTC *"} placeholder="6,50" inputMode="decimal" {...register("feePercent")} {...(errors.feePercent?.message ? { error: errors.feePercent.message } : {})} />
                {api ? (
                  <>
                    <Controller control={control} name="feeBase" render={({ field }) => <Select label="Base de calcul *" placeholder="Choisir une base, ex. : Loyer hors charges" options={FEE_BASE_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.feeBase?.message ? { error: errors.feeBase.message } : {})} />} />
                    <TextField label={`Minimum par mois, ${currencySymbol(currency)} *`} placeholder={currency === "XOF" ? "5 000" : "15"} inputMode="decimal" {...register("feeMinimum")} {...(errors.feeMinimum?.message ? { error: errors.feeMinimum.message } : {})} />
                    <TextField label="Honoraires de relocation, % d'un mois de loyer" placeholder="50" inputMode="decimal" hint="Laissez vide si le mandat ne le prévoit pas." {...register("lettingRate")} {...(errors.lettingRate?.message ? { error: errors.lettingRate.message } : {})} />
                    <TextField label="Suivi de travaux, % du montant des travaux" placeholder="5" inputMode="decimal" hint="Laissez vide si le mandat ne le prévoit pas." {...register("worksFeeRate")} {...(errors.worksFeeRate?.message ? { error: errors.worksFeeRate.message } : {})} />
                    <Controller control={control} name="feeTaxMode" render={({ field }) => <Select label="Honoraires exprimés *" placeholder="Choisir un mode, ex. : Hors taxes" options={FEE_TAX_MODE_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.feeTaxMode?.message ? { error: errors.feeTaxMode.message } : {})} />} />
                  </>
                ) : null}
              </>
            ) : null}
            {values.kind === "duree" ? (
              <TextField label="Nouvelle échéance *" type="date" placeholder="31/12/2029" {...register("endIso")} {...(errors.endIso?.message ? { error: errors.endIso.message } : {})} />
            ) : null}
            {values.kind === "reversement" ? (
              <Controller
                control={control}
                name="payoutDay"
                render={({ field }) => <Select label="Nouveau jour de reversement *" placeholder="Choisir un jour" options={PAYOUT_OPTIONS} value={field.value} onValueChange={field.onChange} {...(errors.payoutDay?.message ? { error: errors.payoutDay.message } : {})} />}
              />
            ) : null}
            {values.kind === "travaux" ? (
              <TextField label={`Nouveau plafond de travaux sans accord, ${currencySymbol(currency)} *`} placeholder={currency === "XOF" ? "250 000" : "500"} inputMode="decimal" {...register("worksLimit")} {...(errors.worksLimit?.message ? { error: errors.worksLimit.message } : {})} />
            ) : null}
          </FormSection>

          {needsSignedFile ? <AvenantSignedFile file={signedFile} error={fileError} onFile={(file) => { setSignedFile(file); setFileError(undefined); }} /> : null}

          <FormSection title="Effet et motif">
            <TextField label="Date d'effet *" type="date" placeholder="13/11/2026" hint="Aujourd'hui ou plus tard : un avenant n'est pas rétroactif." {...register("effectIso")} {...(errors.effectIso?.message ? { error: errors.effectIso.message } : {})} />
            {api ? null : <Textarea label="Motif" placeholder="Ex. : accord du mandant du 10 novembre, baisse des honoraires contre reconduction." {...register("note")} {...(errors.note?.message ? { error: errors.note.message } : {})} />}
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="group" aria-label="Aperçu de l'avenant">
            <CardTitle as="h2">Aperçu de l&apos;avenant</CardTitle>
            {mandat && preview ? (
              <div className="flex flex-col gap-2">
                <KeyValueList
                  items={[
                    { label: "Mandat", value: `${mandat.number}, ${mandant?.name ?? ""}` },
                    { label: preview.label, value: `${preview.previous} → ${preview.next}` },
                    { label: "Date d'effet", value: /^\d{4}-\d{2}-\d{2}$/.test(values.effectIso) ? formatDay(values.effectIso) : "—" },
                  ]}
                />
                {preview.impact ? <p className="text-caption text-fg-muted">{preview.impact}</p> : null}
                <p className="text-caption text-fg-subtle">Les autres conditions du mandat restent inchangées.</p>
              </div>
            ) : (
              <Alert tone="info">Choisissez un mandat pour voir l&apos;avenant.</Alert>
            )}
          </Card>
          <Card role="group" aria-label="Contrôles">
            <CardTitle as="h2">Contrôles</CardTitle>
            {mandat ? (
              <Alert tone={immediate ? "success" : "info"}>
                {immediate ? "L'avenant s'applique dès sa validation et entre dans l'historique du mandat." : "L'avenant est programmé : il entre dans l'historique dès maintenant et prendra effet à la date indiquée."}
              </Alert>
            ) : (
              <Alert tone="info">Le mandat doit être en cours pour recevoir un avenant.</Alert>
            )}
          </Card>
        </aside>
      </div>

      {mandat ? (
        <SectionCard title="Avenants du mandat">
          {api ? (
            <TermsHistoryTable terms={detail?.termsHistory ?? []} currency={currency} />
          ) : history.length === 0 ? (
            <p className="py-2 text-body text-fg-subtle">Aucun avenant sur ce mandat pour le moment.</p>
          ) : (
            <Table aria-label="Avenants du mandat">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Numéro</TableHeaderCell>
                  <TableHeaderCell>Objet</TableHeaderCell>
                  <TableHeaderCell>Modification</TableHeaderCell>
                  <TableHeaderCell>Effet</TableHeaderCell>
                  <TableHeaderCell>État</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>{history.map(historyColumns)}</TableBody>
            </Table>
          )}
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={mandat ? mandatHref(mandat.id) : agenceRoutes.mandats}>Annuler</Link>
        </Button>
        <Button type="submit" loading={create.isPending}>
          Valider l&apos;avenant
        </Button>
      </div>
    </form>
  );
}
