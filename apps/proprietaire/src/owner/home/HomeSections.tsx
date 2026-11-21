import { Badge, Button } from "@eguardimmo/ui";
import { CalendarClock, FileChartColumn } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { ListRow, RowList } from "@/features/confie/ui/ListRow";
import { EmptyLine } from "@/features/confie/ui/States";
import { Caption, Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, formatBasisPoints, formatDay, formatMoney, formatOptionalDay, formatPeriod } from "../format";
import { MANDATE_STATUS } from "../mandates/labels";
import { PERIOD_KIND, REPORT_STATUS } from "../reports/labels";
import { SectionLink, plural } from "./HomeStats";
import { nextNoticeLabel } from "./labels";
import type { HomeMandate, HomePayouts, HomeReport, OwnerHome } from "./model";

function feeText(mandate: HomeMandate): string {
  if (mandate.feeKind === "flat") return mandate.feeFlatAmount === null ? NOT_AVAILABLE : `${formatMoney(mandate.feeFlatAmount)} par mois`;
  return mandate.feeBasisPoints === null ? NOT_AVAILABLE : `${formatBasisPoints(mandate.feeBasisPoints)} des loyers encaissés`;
}

export function MandateSection({ home }: { home: OwnerHome }) {
  const { mandate } = home;
  const status = mandate === null ? undefined : mandate.isSuspended ? { label: "Suspendu", tone: "warning" as const } : MANDATE_STATUS[mandate.status];
  return (
    <Section title="Mon mandat" aside={<SectionLink href={confieRoutes.mandat}>Voir le mandat</SectionLink>}>
      {mandate === null ? (
        <EmptyLine>Aucun mandat en cours ne couvre vos lots aujourd’hui.</EmptyLine>
      ) : (
        <>
          <DataList
            width="sm"
            items={[
              { label: "Mandat", value: <span className="flex flex-wrap items-center gap-2">{mandate.reference}{status ? <Badge tone={status.tone}>{status.label}</Badge> : null}</span> },
              { label: "Honoraires", value: feeText(mandate) },
              { label: "Reversement", value: `Le ${String(mandate.payoutDay)} de chaque mois` },
              { label: "Début", value: formatDay(mandate.startsOn) },
              { label: "Échéance", value: formatOptionalDay(mandate.endDate) },
            ]}
          />
          {home.mandatesCount > 1 ? <Caption>{`${plural(home.mandatesCount, "mandat couvre", "mandats couvrent")} vos lots aujourd’hui : seul celui qui en couvre le plus est présenté ici.`}</Caption> : null}
        </>
      )}
    </Section>
  );
}

export function NextPayoutSection({ payouts }: { payouts: HomePayouts }) {
  const when = payouts.nextDate === null ? "Date non communiquée" : `Prévu autour du ${formatDay(payouts.nextDate)}`;
  return (
    <Section title="Prochain reversement" aside={<SectionLink href={confieRoutes.loyers}>Loyers et reversements</SectionLink>}>
      <RowList label="Prochain reversement">
        <ListRow
          icon={CalendarClock}
          title={when}
          detail={payouts.nextNotice === null ? "Date indicative, selon le jour de reversement de votre mandat." : `Date indicative · ${nextNoticeLabel(payouts.nextNotice)}`}
          tone={payouts.nextNotice === null ? "default" : "warning"}
        />
      </RowList>
    </Section>
  );
}

export function LastReportSection({ report }: { report: HomeReport | null }) {
  const status = report === null ? undefined : REPORT_STATUS[report.status];
  return (
    <Section title="Dernier compte rendu" aside={<SectionLink href={confieRoutes.comptesRendus}>Tous les comptes rendus</SectionLink>}>
      {report === null ? (
        <EmptyLine>Aucun compte rendu publié pour le moment.</EmptyLine>
      ) : (
        <RowList label="Dernier compte rendu">
          <ListRow
            icon={FileChartColumn}
            tone={report.isRead ? "neutral" : "default"}
            title={`Compte rendu ${report.number}`}
            detail={`${PERIOD_KIND[report.period.kind] ?? "Période"} · ${formatPeriod(report.period.start, report.period.end)} · ${report.isRead ? "Lu" : "Non lu"}`}
            trailing={
              <>
                {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                <Button variant="link" size="sm" asChild>
                  <Link href={confieRoutes.compteRendu(report.id)} aria-label={`Ouvrir le compte rendu ${report.number}`}>
                    Ouvrir
                  </Link>
                </Button>
              </>
            }
          />
        </RowList>
      )}
    </Section>
  );
}
