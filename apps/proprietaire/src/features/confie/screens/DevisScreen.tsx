"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Badge, Button, Textarea } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formatDate } from "../data/dates";
import { findLot, lotLabel } from "../data/derive";
import { quoteDecisionSchema } from "../data/inputs";
import type { QuoteDecisionInput } from "../data/inputs";
import { errorMessage, useConfie, useDecideQuote } from "../data/queries";
import type { ConfieData, Intervention } from "../data/schemas";
import { eur, eurFixed, vatIncluded } from "../data/money";
import { confieRoutes } from "../routes";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataList } from "../ui/DataList";
import { OptionGroup } from "../ui/OptionGroup";
import type { Option } from "../ui/OptionGroup";
import { PageHeader } from "../ui/PageHeader";
import { INTERVENTION_STATUS, TextLink } from "../ui/parts";
import { Caption, Section, Split } from "../ui/Section";
import { NotFoundState, QueryBoundary } from "../ui/States";
import { useToast } from "../ui/Toast";

export function DevisScreen({ id }: { id: string }) {
  const query = useConfie();
  return (
    <QueryBoundary query={query}>
      {(data) => {
        const intervention = data.interventions.find((item) => item.id === id);
        return intervention?.quote ? <Devis data={data} intervention={intervention} /> : <NotFoundState title="Devis introuvable" backHref={confieRoutes.interventions} backLabel="Retour aux interventions" />;
      }}
    </QueryBoundary>
  );
}

type Decision = QuoteDecisionInput["decision"];

const DECISION_LABELS: Record<Decision, string> = { accept: "accepter", refuse: "refuser", precision: "demander une précision sur" };

function Devis({ data, intervention }: { data: ConfieData; intervention: Intervention }) {
  const quote = intervention.quote;
  const router = useRouter();
  const { notify } = useToast();
  const decide = useDecideQuote();
  const [confirming, setConfirming] = useState<QuoteDecisionInput | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<QuoteDecisionInput>({
    resolver: zodResolver(quoteDecisionSchema),
    defaultValues: { interventionId: intervention.id, decision: "accept", comment: "" },
  });
  if (!quote) return null;

  const lot = findLot(data, intervention.lotId);
  const label = lotLabel(data, intervention.lotId);
  const title = `Devis de ${intervention.category.toLowerCase()}, ${label}`;
  const pending = intervention.status === "quote_pending";
  const vat = vatIncluded(intervention.totalTtc, intervention.vatRatePercent);
  const excess = intervention.totalTtc - data.mandate.worksThreshold;
  const options: Option<Decision>[] = [
    { value: "accept", label: "Accepter le devis", description: `L'intervention est planifiée le ${formatDate(quote.proposedOn)}` },
    { value: "refuse", label: "Refuser le devis", description: "L'agence cherche une autre solution" },
    { value: "precision", label: "Demander une précision", description: `Votre question est envoyée à ${data.agency.manager.name}` },
  ];
  const placeholders: Record<Decision, string> = {
    accept: "Ex. : D'accord, merci de prévenir la locataire avant le passage.",
    refuse: "Ex. : Le montant est trop élevé, merci de demander un second devis.",
    precision: "Ex. : Pouvez-vous détailler les fournitures prévues ?",
  };

  const send = async (values: QuoteDecisionInput) => {
    setFailure(null);
    try {
      await decide.mutateAsync(values);
      setConfirming(null);
      notify(
        values.decision === "accept"
          ? `Devis accepté. L'intervention est planifiée le ${formatDate(quote.proposedOn)}.`
          : values.decision === "refuse"
            ? "Devis refusé. L'agence en est informée."
            : `Votre question a été envoyée à ${data.agency.manager.name}.`,
      );
      router.push(confieRoutes.intervention(intervention.id));
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const submit = form.handleSubmit(async (values) => {
    if (values.decision === "precision") {
      await send(values);
      return;
    }
    setFailure(null);
    setConfirming(values);
  });

  const status = INTERVENTION_STATUS[intervention.status];

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Interventions", href: confieRoutes.interventions }, { label: title }]}
        badges={<Badge tone={status.tone}>{pending ? "À valider" : status.label}</Badge>}
        subtitle={`Devis n° ${quote.ref} de ${intervention.artisan}, reçu le ${formatDate(quote.receivedOn)} · valable jusqu'au ${formatDate(quote.validUntil)}`}
      />
      <Split>
        <Section title="Le devis">
          <DataList
            width="lg"
            items={[
              { label: "Lot", value: `${label}, ${lot?.address.split(",")[0] ?? ""}` },
              { label: "Motif", value: quote.reason },
              { label: "Artisan", value: intervention.artisan },
              { label: "Passage proposé", value: formatDate(quote.proposedOn) },
              { label: "Seuil du mandat", value: excess > 0 ? `${eur(data.mandate.worksThreshold)} TTC, dépassé de ${eur(excess)}` : `${eur(data.mandate.worksThreshold)} TTC, non dépassé` },
              ...quote.lines.map((line) => ({ label: line.label, value: eurFixed(line.amount) })),
              { label: "Total HT", value: eurFixed(intervention.totalTtc - vat) },
              { label: `TVA ${String(intervention.vatRatePercent)} %`, value: eurFixed(vat) },
              { label: "Total TTC", value: <b>{eurFixed(intervention.totalTtc)}</b> },
            ]}
          />
        </Section>
        <Section title="Votre décision">
          {pending ? (
            <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
              {failure && confirming === null ? <Alert tone="danger" title="La décision n'a pas été envoyée">{failure}</Alert> : null}
              <Controller
                control={form.control}
                name="decision"
                render={({ field }) => (
                  <OptionGroup legend="Votre décision" options={options} value={field.value} onValueChange={field.onChange}>
                    {(value) => (
                      <Textarea
                        label={value === "refuse" ? "Motif du refus" : value === "precision" ? "Votre question" : "Commentaire"}
                        placeholder={placeholders[value]}
                        hint={value === "accept" ? "Facultatif." : undefined}
                        error={form.formState.errors.comment?.message}
                        {...form.register("comment")}
                      />
                    )}
                  </OptionGroup>
                )}
              />
              <Caption>Si vous acceptez, les {eurFixed(intervention.totalTtc)} seront déduits d&apos;un prochain reversement.</Caption>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" asChild><Link href={confieRoutes.interventions}>Annuler</Link></Button>
                <Button type="submit" loading={form.formState.isSubmitting}>Envoyer ma décision</Button>
              </div>
            </form>
          ) : (
            <Alert tone={intervention.status === "quote_accepted" ? "success" : "info"} title={intervention.status === "quote_accepted" ? "Vous avez accepté ce devis" : "Vous avez refusé ce devis"}>
              Décision enregistrée le {formatDate(intervention.decision?.decidedOn ?? quote.receivedOn)}.
              {intervention.decision?.comment ? ` « ${intervention.decision.comment} »` : ""}
            </Alert>
          )}
          {!pending ? <TextLink href={confieRoutes.intervention(intervention.id)}>Voir le suivi de l&apos;intervention</TextLink> : null}
        </Section>
      </Split>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) setConfirming(null); }}
        title={confirming ? `Confirmer : ${DECISION_LABELS[confirming.decision]} le devis` : "Confirmer"}
        description={
          confirming?.decision === "refuse"
            ? `Vous allez refuser le devis ${quote.ref}, ${eurFixed(intervention.totalTtc)} TTC. L'agence cherchera une autre solution. Cette décision est définitive.`
            : `Vous allez accepter le devis ${quote.ref}, ${eurFixed(intervention.totalTtc)} TTC, déduits d'un prochain reversement. L'intervention sera planifiée le ${formatDate(quote.proposedOn)}. Cette décision est définitive.`
        }
        confirmLabel={confirming?.decision === "refuse" ? "Refuser le devis" : "Accepter le devis"}
        tone={confirming?.decision === "refuse" ? "danger" : "primary"}
        pending={decide.isPending}
        error={failure}
        onConfirm={() => { if (confirming) void send(confirming); }}
      />
    </>
  );
}
