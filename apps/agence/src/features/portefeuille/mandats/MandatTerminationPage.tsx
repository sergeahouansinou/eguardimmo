"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, CardTitle, ConfirmDialog, Select, Textarea, TextField, useToast } from "@eguardimmo/ui";
import { FileText, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormSection } from "@/components/ui/FormSection";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ListRow } from "@/components/ui/ListRow";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { agenceRoutes, mandatHref } from "@/espace/routes";
import { formatDay, monthName, parseDay } from "@/lib/dates";
import { formatEurosExact } from "@/lib/money";
import { TERMINATION_NOTICE_MONTHS, TERMINATION_REASONS, makeTerminationFormSchema } from "../forms";
import type { TerminationFormValues } from "../forms";
import { UNAVAILABLE, plural } from "../labels";
import { useMandatDetail, usePortefeuille, usePortefeuilleAccess, useTerminateMandat } from "../queries";
import { balanceMinor, isOperational, mandantFigures, mandatState, nextPayoutIso } from "../selectors";
import type { Portefeuille } from "../selectors";
import { MutationFailure } from "../shared/MutationFailure";
import { WriteForbidden } from "../shared/WriteForbidden";

const TODO = [
  "Solder les comptes et verser le reversement final",
  "Remettre au mandant les dépôts de garantie",
  "Informer les locataires par courrier",
  "Transférer les dossiers à un nouveau gestionnaire",
];

export function MandatTerminationPage({ id }: { id: string }) {
  const query = usePortefeuille();
  const { canWrite } = usePortefeuilleAccess();
  if (!canWrite) return <WriteForbidden title="Fin de mandat" backHref={mandatHref(id)} backLabel="Retour au mandat" />;
  return (
    <QueryState query={query} label="La fin de mandat">
      {(index) => (index.isApi ? <ApiTermination index={index} id={id} /> : <MandatTermination index={index} id={id} noticeMonths={TERMINATION_NOTICE_MONTHS} />)}
    </QueryState>
  );
}

function ApiTermination({ index, id }: { index: Portefeuille; id: string }) {
  const detail = useMandatDetail(id);
  return (
    <QueryState query={detail} label="La fin de mandat">
      {(mandat) => <MandatTermination index={index} id={id} noticeMonths={mandat.noticeMonths ?? TERMINATION_NOTICE_MONTHS} />}
    </QueryState>
  );
}

function MandatTermination({ index, id, noticeMonths }: { index: Portefeuille; id: string; noticeMonths: number }) {
  const { data } = index;
  const mandat = index.mandat(id);
  const router = useRouter();
  const toast = useToast();
  const terminate = useTerminateMandat();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<{ message: string; error: unknown }>();
  const api = index.isApi;
  const schema = useMemo(() => makeTerminationFormSchema(data.todayIso, noticeMonths), [data.todayIso, noticeMonths]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TerminationFormValues>({ resolver: zodResolver(schema), defaultValues: { reason: "mandant", effectIso: "", note: "" } });
  const [pending, setPending] = useState<TerminationFormValues>();

  if (!mandat) {
    return <NotFoundState title="Mandat introuvable" description={`Aucun mandat ne porte l'identifiant « ${id} ».`} backHref={agenceRoutes.mandats} backLabel="Retour aux mandats" />;
  }
  const state = mandatState(mandat, data.todayIso);
  if (!isOperational(state) || state === "resilie") {
    return (
      <NotFoundState
        title={`Mandat ${mandat.number}`}
        description={state === "resilie" ? "La fin de ce mandat est déjà programmée." : "Ce mandat n'est plus en cours : il ne peut pas être résilié."}
        backHref={mandatHref(mandat.id)}
        backLabel="Retour au mandat"
      />
    );
  }

  const mandant = index.mandant(mandat.mandantId);
  const biens = index.biensOfMandat(mandat.id);
  const baux = biens.flatMap((bien) => index.currentBail(bien.id) ?? []);
  const deposits = baux.reduce((sum, bail) => sum + bail.depositMinor, 0);
  const overdue = baux.filter((bail) => bail.overdueSinceIso);
  const figures = mandant ? mandantFigures(index, mandant.id) : undefined;
  const reversement = figures && figures.payoutMinor > 0 ? `${formatEurosExact(figures.payoutMinor)} le ${formatDay(nextPayoutIso(data.todayIso, mandat.payoutDay))}` : undefined;

  const submit = handleSubmit((values) => {
    setPending(values);
    setConfirming(true);
  });

  const confirm = () => {
    if (!pending) return;
    setFailure(undefined);
    terminate.mutate(
      { id: mandat.id, termination: { reason: reasonLabel(pending.reason), effectIso: pending.effectIso, noticeIso: data.todayIso, note: pending.note, amicable: pending.reason === "accord" } },
      {
        onSuccess: () => {
          toast.show({ title: "Fin de mandat enregistrée", description: `Mandat ${mandat.number} résilié au ${formatDay(pending.effectIso)}.` });
          router.push(mandatHref(mandat.id));
        },
        onError: (error) => {
          setConfirming(false);
          setFailure({ message: error.message, error });
        },
      },
    );
  };

  const effectIso = pending?.effectIso;
  const nextMonth = effectIso ? `${monthName(effectIso)} ${String(parseDay(effectIso).year)}` : "—";

  return (
    <>
      <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
        <PageHeader
          crumbs={[{ label: "Mandats", href: agenceRoutes.mandats }, { label: mandat.number, href: mandatHref(mandat.id) }, { label: "Fin de mandat" }]}
          title={`Mettre fin au mandat ${mandat.number}`}
          description={`${mandant ? `${mandant.name}, ${mandant.legal}` : "Mandant inconnu"} · ${plural(index.lotCount(mandat), "lot", "lots")} · échéance initiale le ${formatDay(mandat.endIso)}`}
        />
        {failure ? <MutationFailure title="Résiliation impossible" message={failure.message} error={failure.error} /> : null}
        {overdue.length > 0 || reversement ? (
          <Alert tone="warning" title={overdue.length > 0 ? "Un impayé et un reversement sont en cours" : "Un reversement est en cours"}>
            {overdue.map((bail) => `${index.bien(bail.bienId)?.name ?? "Lot"} : ${formatEurosExact(-balanceMinor(bail))} dus par ${index.locataire(bail.locataireId)?.name ?? "le locataire"}. `)}
            {reversement ? `Reversement du mois : ${reversement}. ` : ""}
            Ils seront soldés avant la fin du mandat.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <FormSection title="Fin du mandat">
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <Select
                    label="Motif *"
                    placeholder="Choisir un motif"
                    options={TERMINATION_REASONS}
                    value={field.value}
                    onValueChange={field.onChange}
                    {...(errors.reason?.message ? { error: errors.reason.message } : {})}
                  />
                )}
              />
              <TextField label="Date d'effet *" type="date" placeholder="31/03/2027" {...register("effectIso")} {...(errors.effectIso?.message ? { error: errors.effectIso.message } : {})} />
              <TextField label="Préavis" placeholder="3 mois" value={`${String(noticeMonths)} mois, notifié le ${formatDay(data.todayIso)}`} readOnly />
              <Textarea label="Observations" placeholder="Ex. : le mandant reprend la gestion directe de ses lots." {...register("note")} {...(errors.note?.message ? { error: errors.note.message } : {})} />
            </FormSection>
            <FormSection title="À faire avant la date d'effet">
              <ul className="flex flex-col gap-1.5">
                {TODO.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-body text-fg">
                    <Square size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                    {item}
                  </li>
                ))}
              </ul>
            </FormSection>
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <Card role="group" aria-label="Conséquences">
              <CardTitle as="h2">Conséquences</CardTitle>
              <KeyValueList
                items={[
                  { label: "Baux concernés", value: api ? UNAVAILABLE : String(baux.length) },
                  { label: "Dépôts de garantie", value: api ? UNAVAILABLE : formatEurosExact(deposits) },
                  { label: "Reversement final", value: effectIso ? nextMonth.replace(/^./, (letter) => letter.toUpperCase()) : "À la date d'effet" },
                  { label: "Honoraires dus", value: effectIso ? `Jusqu'au ${formatDay(effectIso)}` : "Jusqu'à la date d'effet" },
                ]}
              />
            </Card>
            {api ? null : (
              <Card role="group" aria-label="Documents générés">
                <CardTitle as="h2">Documents générés</CardTitle>
                <ListRow icon={FileText} tone="info" title="Courrier de fin de mandat" caption="PDF, recommandé avec accusé de réception" />
                <ListRow icon={FileText} tone="info" title="Arrêté de comptes" caption="PDF, à la date d'effet" />
              </Card>
            )}
          </aside>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href={mandatHref(mandat.id)}>Annuler</Link>
          </Button>
          <Button type="submit" variant="danger">
            Mettre fin au mandat
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Mettre fin au mandat ${mandat.number} ?`}
        description={`Le mandat prendra fin le ${effectIso ? formatDay(effectIso) : "—"}. ${api ? "" : "Les locataires seront informés par courrier. "}Cette décision est enregistrée dans l'historique.`}
        confirmLabel="Confirmer la fin du mandat"
        tone="danger"
        loading={terminate.isPending}
        onConfirm={confirm}
      />
    </>
  );
}

function reasonLabel(reason: TerminationFormValues["reason"]): string {
  return TERMINATION_REASONS.find((item) => item.value === reason)?.label ?? reason;
}
