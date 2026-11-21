"use client";

import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { useState } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, formatDateTime, formatOptionalMoney } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { useWriteAccess } from "../shared/useWriteAccess";
import { ApprovalActions, approvalDecisions } from "./ApprovalActions";
import type { DecisionNotice } from "./ApprovalActions";
import { QuoteBlock } from "./InterventionSections";
import type { InterventionApproval, OwnerInterventionDetail } from "./model";
import { useIntervention } from "./queries";

function BackLinks({ intervention }: { intervention: OwnerInterventionDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" asChild>
        <Link href={confieRoutes.intervention(intervention.id)}>Voir l’intervention</Link>
      </Button>
      <Button variant="secondary" asChild>
        <Link href={confieRoutes.interventions}>Retour aux interventions</Link>
      </Button>
    </div>
  );
}

function Request({ intervention, approval, onNotice }: { intervention: OwnerInterventionDetail; approval: InterventionApproval; onNotice: (notice: DecisionNotice) => void }) {
  const quote = intervention.quotes.find((candidate) => candidate.id === approval.quoteId);
  return (
    <Section title={quote?.reference ?? "Devis soumis"}>
      <DataList
        width="lg"
        items={[
          { label: "Prestataire", value: intervention.supplierName ?? NOT_AVAILABLE },
          { label: "Montant du devis", value: formatOptionalMoney(approval.amount) },
          { label: "Plafond du mandat", value: formatOptionalMoney(approval.ceilingAmount) },
          { label: "À décider avant", value: formatDateTime(approval.decideBefore) },
        ]}
      />
      {quote === undefined ? (
        <Alert tone="warning" title="Devis indisponible">
          Le devis de cette demande n’est pas affiché : rechargez la page ou contactez votre agence avant de décider.
        </Alert>
      ) : (
        <QuoteBlock quote={quote} />
      )}
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <b className="text-body-strong">Votre décision</b>
        {quote === undefined ? null : <ApprovalActions intervention={intervention} approval={approval} onNotice={onNotice} />}
      </div>
    </Section>
  );
}

function Content({ intervention }: { intervention: OwnerInterventionDetail }) {
  const [notice, setNotice] = useState<DecisionNotice | null>(null);
  const access = useWriteAccess(intervention.agency.id);
  const open = intervention.approvals.filter((approval) => approvalDecisions(approval.status).length > 0);
  return (
    <>
      <PageHeader
        title="Validation du devis"
        subtitle={`${intervention.reference} · ${intervention.title}`}
        crumbs={[{ label: "Interventions", href: confieRoutes.interventions }, { label: intervention.reference, href: confieRoutes.intervention(intervention.id) }, { label: "Devis" }]}
      />
      {notice === null ? null : (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.text}
        </Alert>
      )}
      {open.length === 0 && notice === null ? (
        <Alert tone="info" title="Aucune décision n’est attendue">
          Aucun devis de cette intervention n’attend votre décision pour le moment. Vous pouvez consulter les devis et l’historique depuis l’intervention.
        </Alert>
      ) : null}
      {open.length > 0 && !access.canWrite ? (
        <Alert tone="info" title="Lecture seule">
          Les devis soumis sont consultables ; la décision revient au titulaire du mandat, ou votre agence l’enregistre.
        </Alert>
      ) : null}
      {open.map((approval) => (
        <Request key={approval.id} intervention={intervention} approval={approval} onNotice={setNotice} />
      ))}
      <BackLinks intervention={intervention} />
    </>
  );
}

export function DevisScreen({ id }: { id: string }) {
  const query = useIntervention(id);
  if (query.data !== undefined) return <Content intervention={query.data} />;
  if (!query.isError) return <Loading label="Chargement du devis" />;
  return (
    <>
      <PageHeader title="Validation du devis" crumbs={[{ label: "Interventions", href: confieRoutes.interventions }, { label: "Devis" }]} />
      <FailureNotice title="Ce devis n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.interventions}>Retour aux interventions</Link>
        </Button>
      </div>
    </>
  );
}
