"use client";

import { Alert, Badge, Button, StatCard } from "@eguardimmo/ui";
import { Building, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDate, formatRemaining } from "../data/dates";
import { lotTotalRent } from "../data/derive";
import { END_REASON_LABELS } from "../data/inputs";
import { errorMessage, useCancelMandateEnd, useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { eur, eurFixed, feeOf } from "../data/money";
import { confieRoutes } from "../routes";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataList } from "../ui/DataList";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { DownloadButton, SecondaryDownload, TextLink } from "../ui/parts";
import { Caption, Pair, Section, StatGrid } from "../ui/Section";
import { QueryBoundary } from "../ui/States";
import { useToast } from "../ui/Toast";

export function MandatScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Mandat data={data} />}</QueryBoundary>;
}

function Mandat({ data }: { data: ConfieData }) {
  const { mandate, agency, profile } = data;
  const { notify } = useToast();
  const cancel = useCancelMandateEnd();
  const [cancelling, setCancelling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const request = mandate.endRequest;
  const lots = data.lots.filter((lot) => mandate.lotIds.includes(lot.id));

  const confirmCancel = async () => {
    setFailure(null);
    try {
      await cancel.mutateAsync();
      setCancelling(false);
      notify("Votre demande de fin de mandat est annulée.");
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        title={`Mandat ${mandate.reference}`}
        crumbs={[{ label: "Mon agence", href: confieRoutes.agence }, { label: `Mandat ${mandate.reference}` }]}
        badges={<Badge tone={request ? "warning" : "success"}>{request ? "Fin demandée" : "En cours"}</Badge>}
        subtitle={`Mandat de gestion locative signé le ${formatDate(mandate.signedOn)} avec ${agency.name}`}
        actions={
          <>
            <SecondaryDownload title={`Mandat de gestion ${mandate.reference}`} label="Télécharger le mandat" />
            {request ? (
              <Button variant="secondary" onClick={() => { setCancelling(true); }}>Annuler ma demande de fin</Button>
            ) : (
              <Button variant="secondary" asChild><Link href={confieRoutes.mandatFin}>Demander la fin du mandat</Link></Button>
            )}
          </>
        }
      />
      {request ? (
        <Alert tone="warning" title="Demande de fin de mandat envoyée">
          Envoyée le {formatDate(request.requestedOn)} : {request.kind === "early" && request.desiredOn ? `fin anticipée souhaitée le ${formatDate(request.desiredOn)}${request.reason ? `, motif : ${END_REASON_LABELS[request.reason].toLowerCase()}` : ""}` : `fin à l'échéance du mandat, le ${formatDate(mandate.endOn)}`}.
          {" "}{agency.name} vous répond sous 5 jours ouvrés. Le mandat reste actif jusqu&apos;à la date de fin confirmée.
        </Alert>
      ) : null}
      <StatGrid>
        <StatCard label="Honoraires" value={`${String(mandate.feeRatePercent)} % TTC`}><Caption>Des loyers encaissés</Caption></StatCard>
        <StatCard label="Reversement" value={`Le ${String(mandate.payoutDay)}`}><Caption>De chaque mois, par virement</Caption></StatCard>
        <StatCard label="Échéance" value={formatDate(mandate.endOn)}><Caption>{formatRemaining(data.today, mandate.endOn)}</Caption></StatCard>
        <StatCard label="Biens couverts" value={`${String(lots.length)} lots`}><Caption>{lots.map((lot) => lot.label).join(" et ")}</Caption></StatCard>
      </StatGrid>
      <Pair>
        <Section title="Conditions du mandat">
          <DataList
            width="lg"
            items={[
              { label: "Mandant", value: profile.denomination },
              { label: "Mandataire", value: agency.name },
              { label: "Signature", value: formatDate(mandate.signedOn) },
              { label: "Durée", value: `Du ${formatDate(mandate.startOn)} au ${formatDate(mandate.endOn)}` },
              { label: "Honoraires", value: `${String(mandate.feeRatePercent)} % TTC des loyers` },
              { label: "Reversement", value: `Le ${String(mandate.payoutDay)}, par virement` },
              { label: "Travaux", value: `Accord au-delà de ${eur(mandate.worksThreshold)} TTC` },
              { label: "Compte rendu", value: "Chaque trimestre" },
            ]}
          />
        </Section>
        <Section title="Reconduction">
          <p className="text-body text-fg-muted">
            Le mandat est reconduit tacitement par périodes d&apos;un an. Une demande de fin est adressée à l&apos;agence avec un préavis de {String(mandate.noticeMonths)} mois.
          </p>
          <DataList items={[{ label: "Prochaine date", value: formatDate(mandate.endOn) }, { label: "Préavis", value: `${String(mandate.noticeMonths)} mois` }]} />
        </Section>
      </Pair>
      <Pair>
        <Section title="Biens couverts">
          <RowList label="Biens couverts par le mandat">
            {lots.map((lot) => (
              <ListRow
                key={lot.id}
                icon={Building}
                title={lot.label}
                detail={`${lot.kind}, ${String(lot.surface)} m² · ${eur(lotTotalRent(lot))} charges comprises · honoraires ${eurFixed(feeOf(lotTotalRent(lot), mandate.feeRatePercent))} par mois`}
                trailing={<TextLink href={confieRoutes.bien(lot.id)}>Voir</TextLink>}
              />
            ))}
          </RowList>
        </Section>
        <Section title="Documents du mandat">
          <RowList label="Documents du mandat">
            {mandate.files.map((file) => (
              <ListRow key={file.id} icon={FileText} title={file.title} detail={file.detail} trailing={<DownloadButton title={file.title} />} />
            ))}
          </RowList>
        </Section>
      </Pair>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Annuler la demande de fin de mandat"
        description="Le mandat se poursuit normalement. Vous pourrez faire une nouvelle demande à tout moment."
        confirmLabel="Annuler ma demande"
        cancelLabel="Conserver ma demande"
        pending={cancel.isPending}
        error={failure}
        onConfirm={() => { void confirmCancel(); }}
      />
    </>
  );
}
