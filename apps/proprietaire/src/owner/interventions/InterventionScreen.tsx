"use client";

import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { useState } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyLabel, formatDateTime, formatOptionalDay, formatOptionalMoney, labelOf } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { useWriteAccess } from "../shared/useWriteAccess";
import type { DecisionNotice } from "./ApprovalActions";
import { ApprovalsSection, EventsSection, FilesSection, InvoicesSection, QuotesSection, VisitsSection } from "./InterventionSections";
import { PriorityBadge, StatusBadge, placeOf } from "./InterventionsScreen";
import { APPROVAL_BASIS, RESPONSIBILITY } from "./labels";
import type { OwnerInterventionDetail } from "./model";
import { useIntervention } from "./queries";

function Content({ intervention }: { intervention: OwnerInterventionDetail }) {
  const waiting = intervention.approvals.some((approval) => approval.status === "pending" || approval.status === "question");
  const access = useWriteAccess(intervention.agency.id);
  const [notice, setNotice] = useState<DecisionNotice | null>(null);
  return (
    <>
      <PageHeader
        title={`${intervention.reference} · ${intervention.title}`}
        subtitle={`${placeOf(intervention)} · ${agencyLabel(intervention.agency.name)}`}
        badges={
          <>
            <StatusBadge status={intervention.status} />
            <PriorityBadge priority={intervention.priority} />
          </>
        }
        crumbs={[{ label: "Interventions", href: confieRoutes.interventions }, { label: intervention.reference }]}
      />
      {notice === null ? null : (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.text}
        </Alert>
      )}
      {waiting && notice === null ? (
        <Alert tone="info" title="Un devis attend une décision">
          {access.canWrite
            ? "Consultez le devis ci-dessous, puis acceptez-le, refusez-le ou demandez une précision dans « Demandes d’accord »."
            : "Les devis soumis sont consultables ci-dessous ; la décision revient au titulaire du mandat, ou votre agence l’enregistre."}
          {access.canWrite ? (
            <Button variant="link" size="sm" asChild>
              <Link href={confieRoutes.devis(intervention.id)}>Valider le devis</Link>
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Section title="Résumé">
        <DataList
          width="lg"
          items={[
            { label: "Nature", value: intervention.natureLabel ?? NOT_AVAILABLE },
            { label: "Description", value: intervention.description ?? "Non communiquée" },
            ...(intervention.emergencyReason === null ? [] : [{ label: "Motif d’urgence", value: intervention.emergencyReason }]),
            { label: "Prestataire", value: intervention.supplierName ?? "Pas encore désigné" },
            { label: "Responsabilité", value: labelOf(RESPONSIBILITY, intervention.responsibility) },
            { label: "Base de l’accord", value: intervention.approvalBasis === null ? NOT_AVAILABLE : labelOf(APPROVAL_BASIS, intervention.approvalBasis) },
            { label: "Estimation", value: formatOptionalMoney(intervention.estimatedAmount) },
            { label: "Signalée le", value: formatOptionalDay(intervention.reportedOn) },
            { label: "Échéance", value: formatOptionalDay(intervention.dueOn) },
            { label: "Terminée le", value: formatOptionalDay(intervention.completedOn) },
            { label: "Clôturée le", value: intervention.closedAt === null ? NOT_AVAILABLE : formatDateTime(intervention.closedAt) },
          ]}
        />
      </Section>
      <QuotesSection quotes={intervention.quotes} />
      <ApprovalsSection intervention={intervention} onNotice={setNotice} />
      <VisitsSection visits={intervention.visits} />
      <FilesSection interventionId={intervention.id} files={intervention.files} />
      <InvoicesSection invoices={intervention.invoices} allocations={intervention.allocations} />
      <EventsSection events={intervention.events} />
    </>
  );
}

export function InterventionScreen({ id }: { id: string }) {
  const query = useIntervention(id);
  if (query.data !== undefined) return <Content intervention={query.data} />;
  if (!query.isError) return <Loading label="Chargement de l’intervention" />;
  return (
    <>
      <PageHeader title="Intervention" crumbs={[{ label: "Interventions", href: confieRoutes.interventions }, { label: "Intervention" }]} />
      <FailureNotice title="Cette intervention n’a pas pu être chargée" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.interventions}>Retour aux interventions</Link>
        </Button>
      </div>
    </>
  );
}
