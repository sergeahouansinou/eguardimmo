"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Select, Textarea, TextField } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formatDate } from "../data/dates";
import { END_REASON_LABELS, earliestEndDate, mandateEndSchema } from "../data/inputs";
import type { MandateEndInput } from "../data/inputs";
import { errorMessage, useConfie, useRequestMandateEnd } from "../data/queries";
import { END_REASONS } from "../data/schemas";
import type { ConfieData } from "../data/schemas";
import { confieRoutes } from "../routes";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataList } from "../ui/DataList";
import { OptionGroup } from "../ui/OptionGroup";
import type { Option } from "../ui/OptionGroup";
import { PageHeader } from "../ui/PageHeader";
import { Section, Split } from "../ui/Section";
import { QueryBoundary } from "../ui/States";
import { useToast } from "../ui/Toast";

const REASON_OPTIONS = END_REASONS.map((value) => ({ value, label: END_REASON_LABELS[value] }));

export function MandatFinScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <MandatFin data={data} />}</QueryBoundary>;
}

type Kind = MandateEndInput["kind"];

function MandatFin({ data }: { data: ConfieData }) {
  const { mandate, agency } = data;
  const router = useRouter();
  const { notify } = useToast();
  const request = useRequestMandateEnd();
  const minDate = earliestEndDate(data.today, mandate.noticeMonths);
  const schema = useMemo(() => mandateEndSchema(minDate), [minDate]);
  const [confirming, setConfirming] = useState<MandateEndInput | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<MandateEndInput>({ resolver: zodResolver(schema), defaultValues: { kind: "early", desiredOn: "", reason: "", details: "" } });
  const { errors } = form.formState;

  const options: Option<Kind>[] = [
    { value: "at_term", label: "À l'échéance du mandat", description: `Le ${formatDate(mandate.endOn)}, sans reconduction` },
    { value: "early", label: "Fin anticipée", description: `Avec un préavis de ${String(mandate.noticeMonths)} mois` },
  ];

  const send = async (values: MandateEndInput) => {
    setFailure(null);
    try {
      await request.mutateAsync(values);
      setConfirming(null);
      notify(`Demande de fin de mandat envoyée à ${agency.name}. Réponse sous 5 jours ouvrés.`);
      router.push(confieRoutes.mandat);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const submit = form.handleSubmit((values) => {
    setFailure(null);
    setConfirming(values);
  });

  const header = (
    <PageHeader
      title="Demander la fin du mandat"
      crumbs={[{ label: "Mon agence", href: confieRoutes.agence }, { label: `Mandat ${mandate.reference}`, href: confieRoutes.mandat }, { label: "Fin du mandat" }]}
      subtitle={`Votre demande est transmise à ${agency.name}, qui vous répond sous 5 jours ouvrés.`}
    />
  );

  if (mandate.endRequest) {
    return (
      <>
        {header}
        <Alert tone="info" title="Une demande de fin de mandat est déjà en cours">
          Vous l&apos;avez envoyée le {formatDate(mandate.endRequest.requestedOn)}. Vous pouvez l&apos;annuler depuis la page du mandat.
          {" "}<Link href={confieRoutes.mandat} className="underline underline-offset-3">Retour au mandat</Link>
        </Alert>
      </>
    );
  }

  return (
    <>
      {header}
      <Alert tone="warning" title="Le mandat reste actif jusqu'à la date de fin confirmée">
        Les loyers continuent d&apos;être encaissés et reversés, et les honoraires restent dus jusqu&apos;à cette date.
      </Alert>
      <form onSubmit={(event) => { void submit(event); }} noValidate className="contents">
        <Split>
          <Section title="Votre demande">
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <OptionGroup legend="Type de fin de mandat" options={options} value={field.value} onValueChange={field.onChange}>
                  {(value) =>
                    value === "early" ? (
                      <div className="flex flex-col gap-3">
                        <TextField
                          type="date"
                          label="Date de fin souhaitée *"
                          placeholder="jj/mm/aaaa"
                          min={minDate}
                          hint={`Au plus tôt le ${formatDate(minDate)}, après ${String(mandate.noticeMonths)} mois de préavis.`}
                          error={errors.desiredOn?.message}
                          {...form.register("desiredOn")}
                        />
                        <Controller
                          control={form.control}
                          name="reason"
                          render={({ field: reason }) => (
                            <Select label="Motif *" placeholder="Choisir un motif" options={REASON_OPTIONS} value={reason.value} onValueChange={reason.onChange} error={errors.reason?.message} />
                          )}
                        />
                        <Textarea label="Précisions" placeholder="Ex. : Je souhaite gérer mes lots directement à partir du 1er mars 2027." error={errors.details?.message} {...form.register("details")} />
                      </div>
                    ) : (
                      <Textarea label="Précisions" placeholder="Ex. : Merci de m'indiquer les documents à récupérer." error={errors.details?.message} {...form.register("details")} />
                    )
                  }
                </OptionGroup>
              )}
            />
          </Section>
          <div className="flex flex-col gap-3">
            <Section title="Récapitulatif">
              <DataList
                width="sm"
                items={[
                  { label: "Mandat", value: mandate.reference },
                  { label: "Agence", value: agency.name },
                  { label: "Préavis", value: `${String(mandate.noticeMonths)} mois` },
                  { label: "Lots", value: data.lots.filter((lot) => mandate.lotIds.includes(lot.id)).map((lot) => lot.label).join(", ") },
                ]}
              />
            </Section>
            <Section title="Ensuite">
              <p className="text-body text-fg-muted">L&apos;agence établit un solde de tout compte et vous reverse les loyers encaissés. Vos documents restent disponibles dans votre espace.</p>
            </Section>
          </div>
        </Split>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" asChild><Link href={confieRoutes.mandat}>Annuler</Link></Button>
          <Button type="submit">Envoyer la demande</Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) setConfirming(null); }}
        title="Confirmer la demande de fin de mandat"
        description={
          confirming?.kind === "early"
            ? `Vous demandez la fin anticipée du mandat ${mandate.reference} au ${formatDate(confirming.desiredOn)}. ${agency.name} vous répond sous 5 jours ouvrés.`
            : `Vous demandez la fin du mandat ${mandate.reference} à son échéance, le ${formatDate(mandate.endOn)}, sans reconduction.`
        }
        confirmLabel="Envoyer la demande"
        pending={request.isPending}
        error={failure}
        onConfirm={() => { if (confirming) void send(confirming); }}
      />
    </>
  );
}
