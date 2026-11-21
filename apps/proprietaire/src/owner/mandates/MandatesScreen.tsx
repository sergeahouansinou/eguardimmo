"use client";

import { Alert, Badge, Button } from "@eguardimmo/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyLabel, formatBasisPoints, formatDay, formatMoney, formatOptionalDay } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { useWriteAccess } from "../shared/useWriteAccess";
import { EndRequestStatus } from "./EndRequestStatus";
import { FEE_BASE, FEE_TAX, MANDATE_STATUS } from "./labels";
import type { MandateTerms, OwnerMandate } from "./model";
import { useMandates } from "./queries";

export function feeLabel(terms: MandateTerms): string {
  const tax = FEE_TAX[terms.feeTaxMode] ?? "";
  const minimum = terms.feeMinimumAmount !== null && terms.feeMinimumAmount.amount > 0 ? `, minimum ${formatMoney(terms.feeMinimumAmount)} par mois` : "";
  if (terms.feeKind === "flat") return terms.feeFlatAmount === null ? NOT_AVAILABLE : `${formatMoney(terms.feeFlatAmount)} ${tax} par mois`.trim();
  if (terms.feeBasisPoints === null) return NOT_AVAILABLE;
  const base = terms.feeBase === null ? "" : ` ${FEE_BASE[terms.feeBase] ?? ""}`;
  return `${formatBasisPoints(terms.feeBasisPoints)}${base} ${tax}${minimum}`.replace(/\s+/g, " ").trim();
}

export function MandateStatusBadge({ status }: { status: string }) {
  const entry = MANDATE_STATUS[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? "Statut inconnu"}</Badge>;
}

function periodOf(mandate: OwnerMandate): string {
  const end = mandate.endDate === null ? "sans date de fin" : `jusqu’au ${formatDay(mandate.endDate)}`;
  return `Depuis le ${formatDay(mandate.startsOn)}, ${end}`;
}

function MandateCard({ mandate }: { mandate: OwnerMandate }) {
  const access = useWriteAccess(mandate.agency.id);
  const terms = mandate.terms;
  const canAsk = mandate.status === "active" && mandate.endRequest?.status !== "pending";
  return (
    <Section title={`Mandat ${mandate.reference}`} aside={<MandateStatusBadge status={mandate.status} />}>
      <div className="flex flex-col gap-3">
        <DataList
          width="lg"
          items={[
            { label: "Agence", value: agencyLabel(mandate.agency.name) },
            { label: "Mandant", value: mandate.mandantName ?? NOT_AVAILABLE },
            { label: "Type", value: mandate.typeLabel },
            { label: "Période", value: periodOf(mandate) },
            { label: "Signé le", value: formatOptionalDay(mandate.signedOn) },
            {
              label: "Reconduction",
              value: mandate.tacitRenewal ? `Tacite${mandate.renewalMonths === null ? "" : `, par périodes de ${String(mandate.renewalMonths)} mois`}` : "Sans reconduction tacite",
            },
            { label: "Préavis prévu", value: mandate.noticeMonths === null ? NOT_AVAILABLE : `${String(mandate.noticeMonths)} mois` },
            ...(terms === null
              ? []
              : [
                  { label: "Honoraires", value: feeLabel(terms) },
                  { label: "Reversement", value: `Le ${String(terms.payoutDay)} de chaque mois` },
                ]),
          ]}
        />
        {mandate.units.length === 0 ? null : (
          <div>
            <h3 className="text-body font-semibold">Lots couverts</h3>
            <ul className="mt-1 flex flex-col gap-1 text-body">
              {mandate.units.map((unit) => (
                <li key={unit.id}>
                  <Link href={confieRoutes.bien(unit.id)} className="underline-offset-2 hover:underline">
                    {unit.propertyName ?? "Bien"} · lot {unit.reference ?? NOT_AVAILABLE}
                  </Link>
                  {` (depuis le ${formatDay(unit.validFrom)}${unit.endDate === null ? "" : `, jusqu’au ${formatDay(unit.endDate)}`})`}
                </li>
              ))}
            </ul>
          </div>
        )}
        <EndRequestStatus mandate={mandate} canWrite={access.canWrite} />
        {canAsk && access.canWrite ? (
          <div>
            <Button asChild variant="secondary">
              <Link href={`${confieRoutes.mandatFin}?mandat=${mandate.id}`}>Demander la fin du mandat</Link>
            </Button>
          </div>
        ) : null}
        {canAsk && !access.canWrite ? (
          <Alert tone="info" title="Lecture seule">
            {access.inGrace ? "Votre mandat est terminé : vous ne pouvez plus faire de demande depuis votre espace." : "Seul le titulaire du mandat ou son représentant peut demander la fin du mandat."}
          </Alert>
        ) : null}
      </div>
    </Section>
  );
}

export function MandatesScreen() {
  const filter = useAgencyFilter();
  const list = useMandates(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Mon mandat" crumbs={[{ label: "Mon agence", href: confieRoutes.agence }, { label: "Mon mandat" }]} subtitle="Les conditions de gestion confiées à votre agence" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement des mandats"
          failureTitle="Vos mandats n’ont pas pu être chargés"
          empty={{ icon: FileText, title: "Aucun mandat", description: "Aucun mandat n’est visible pour cette sélection." }}
        >
          {(mandates) => (
            <>
              {mandates.map((mandate) => (
                <MandateCard key={mandate.id} mandate={mandate} />
              ))}
            </>
          )}
        </PagedState>
      )}
    </>
  );
}
