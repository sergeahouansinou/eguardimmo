"use client";

import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Icon, Select, Textarea } from "@eguardimmo/ui";
import { FileText, Download, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { ActionDialog, DataTable, DetailList, PageFrame, SummaryLines, useNotify } from "@/features/kit";
import { PrintStyles } from "@/features/kit/PrintArea";
import { formatDate } from "@/features/shared/dates";
import { mandantById } from "@/features/shared/directory";
import { messageOf } from "@/features/shared/errors";
import { formatMoney } from "@/features/shared/money";
import { useDevisList, useIntervention, useSubmitDevis } from "./queries";
import { submitDevisSchema } from "./schemas";
import type { Devis } from "./schemas";

export function DevisPage() {
  const devis = useDevisList();
  const requested = useSearchParams().get("devis");
  return (
    <QueryState query={devis} label="Les devis">
      {(list) => {
        if (list.length === 0) {
          return (
            <PageFrame crumbs={[{ label: "Interventions", href: "/interventions" }, { label: "Devis" }]} title="Devis à soumettre au mandant">
              <EmptyState icon={FileText} title="Aucun devis" description="Les devis reçus des intervenants apparaissent ici." />
            </PageFrame>
          );
        }
        const selected = requested ? list.find((item) => item.id === requested) : (list.find((item) => item.state === "a_soumettre") ?? list[0]);
        if (!selected) {
          return (
            <NotFoundState
              title="Devis introuvable"
              description="Ce devis n'existe pas ou n'est plus disponible."
              backHref="/interventions"
              backLabel="Retour aux interventions"
            />
          );
        }
        return <DevisView key={selected.id} devis={selected} all={list} />;
      }}
    </QueryState>
  );
}

function DevisView({ devis, all }: { devis: Devis; all: readonly Devis[] }) {
  const router = useRouter();
  const notify = useNotify();
  const submit = useSubmitDevis();
  const intervention = useIntervention(devis.interventionId);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(devis.message);
  const [error, setError] = useState<string | null>(null);
  const mandant = mandantById(devis.mandantId);
  const subject = intervention.data?.subject ?? "Intervention";
  const note = intervention.data?.priorityNote?.toLowerCase();
  const submitted = devis.state === "soumis";

  const confirm = () => {
    const checked = submitDevisSchema.safeParse({ devisId: devis.id, message });
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Message invalide.");
      return;
    }
    setError(null);
    submit.mutate(checked.data, {
      onSuccess: () => {
        notify.success("Devis soumis au mandant", `${mandant?.name ?? "Le mandant"} a été prévenu par e-mail.`);
        setOpen(false);
      },
      onError: (cause) => {
        setError(messageOf(cause));
      },
    });
  };

  return (
    <PageFrame
      crumbs={[{ label: "Interventions", href: "/interventions" }, { label: subject, href: `/interventions/${devis.interventionId}` }, { label: "Devis" }]}
      title={devis.title}
      badges={<Badge tone={submitted ? "info" : "warning"}>{submitted ? "Soumis" : "À soumettre"}</Badge>}
      description={
        submitted && devis.submittedOn
          ? `Soumis à ${mandant?.name ?? "le mandant"} le ${formatDate(devis.submittedOn)}, réponse attendue sous ${String(devis.responseWithinHours)} h.`
          : `Devis de ${devis.contractor} du ${formatDate(devis.issuedOn)}, à faire valider par ${mandant?.name ?? "le mandant"} avant toute intervention.`
      }
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              window.print();
            }}
          >
            <Icon icon={Download} />
            Télécharger le PDF
          </Button>
          {submitted ? null : (
            <Button
              onClick={() => {
                setMessage(devis.message);
                setError(null);
                setOpen(true);
              }}
            >
              <Icon icon={Send} />
              Soumettre au mandant
            </Button>
          )}
        </>
      }
    >
      <PrintStyles />
      {all.length > 1 ? (
        <Select
          label="Devis affiché"
          placeholder="Choisir un devis"
          options={all.map((item) => ({ value: item.id, label: item.title, description: item.state === "soumis" ? "Soumis" : "À soumettre" }))}
          value={devis.id}
          className="max-w-sm"
          onValueChange={(next) => {
            router.replace(`/devis?devis=${next}`);
          }}
        />
      ) : null}
      {devis.excessMinor > 0 ? (
        <Alert tone="warning" title={`${formatMoney(devis.totalMinor)} dépassent de ${formatMoney(devis.excessMinor)} le plafond du mandat`}>
          Le mandat {devis.mandateRef} fixe à {formatMoney(devis.ceilingMinor)} le montant des travaux engageables sans accord.
          {submitted ? " L'accord du mandant est en attente." : ` Une réponse rapide est demandée${note ? ` : ${note}` : ""}.`}
        </Alert>
      ) : null}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card role="region" aria-label="Détail du devis" data-print-area>
          <CardHeader>
            <CardTitle as="h2">Détail du devis</CardTitle>
          </CardHeader>
          <DataTable
            caption="Lignes du devis"
            rows={devis.lines}
            getRowId={(line) => line.label}
            columns={[
              { id: "label", header: "Désignation", role: "title", cell: (line) => line.label },
              { id: "quantity", header: "Quantité", numeric: true, cell: (line) => `${String(line.quantity)}${line.unit ? ` ${line.unit}` : ""}` },
              { id: "unit", header: "Prix unitaire", numeric: true, cell: (line) => formatMoney(line.unitMinor) },
              { id: "total", header: "Total TTC", numeric: true, cell: (line) => formatMoney(line.totalMinor) },
            ]}
          />
          <SummaryLines
            lines={[
              { label: "Total HT", value: formatMoney(devis.htMinor) },
              { label: `TVA ${new Intl.NumberFormat("fr-FR").format(devis.vatBasisPoints / 100)}\u00a0%`, value: formatMoney(devis.vatMinor) },
            ]}
            total={{ label: "Total TTC", value: formatMoney(devis.totalMinor) }}
          />
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Soumission au mandant">
            <CardHeader>
              <CardTitle as="h2">Soumission au mandant</CardTitle>
            </CardHeader>
            <DetailList
              items={[
                { label: "Destinataire", value: mandant?.name ?? "—" },
                { label: "Société", value: mandant?.kind ?? "—" },
                { label: "Mandat", value: devis.mandateRef },
                { label: "Imputation", value: devis.imputation },
                { label: "Déduit du", value: devis.deductedFrom },
                { label: "Réponse sous", value: `${String(devis.responseWithinHours)} h` },
              ]}
            />
          </Card>
          <Card role="region" aria-label="Message joint">
            <CardHeader>
              <CardTitle as="h2">Message joint</CardTitle>
            </CardHeader>
            <p className="text-body text-fg-muted">{devis.message}</p>
          </Card>
        </aside>
      </div>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Soumettre le devis au mandant"
        description={`${mandant?.name ?? "Le mandant"} recevra le devis de ${devis.contractor} (${formatMoney(devis.totalMinor)} TTC) et pourra l'accepter ou le refuser.`}
        confirmLabel="Soumettre le devis"
        loading={submit.isPending}
        error={error}
        onConfirm={confirm}
      >
        <Textarea
          label="Message joint"
          placeholder="Bonjour, voici le devis de l'intervention."
          rows={5}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />
      </ActionDialog>
    </PageFrame>
  );
}
