"use client";

import {
  Badge,
  Button,
  Icon,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@eguardimmo/ui";
import { BadgeCheck, CircleAlert, Handshake, Landmark, ShieldCheck, ScrollText, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { ListRow } from "@/components/ui/ListRow";
import type { RowTone } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { agenceRoutes, mandantHref, mandatHref } from "@/espace/routes";
import { formatDay, formatLongDay, monthName } from "@/lib/dates";
import { formatEuros, formatEurosExact, formatRate } from "@/lib/money";
import { usePortefeuille } from "../queries";
import { RenewMandatDialog } from "../mandats/RenewMandatDialog";
import { balanceMinor, mandantFigures, mandatState, nextPayoutIso, overdueDays } from "../selectors";
import type { Portefeuille } from "../selectors";
import { plural } from "../labels";
import type { ComplianceItem } from "../schemas";

const COMPLIANCE_ICONS: Record<string, typeof BadgeCheck> = {
  "carte-pro": BadgeCheck,
  garantie: ShieldCheck,
  rcp: ShieldCheck,
  comptes: Landmark,
};

const COMPLIANCE_PILLS: Record<ComplianceItem["state"], { tone: "success" | "warning"; label: string; row: RowTone }> = {
  valide: { tone: "success", label: "Valide", row: "success" },
  conforme: { tone: "success", label: "Conforme", row: "success" },
  a_renouveler: { tone: "warning", label: "À renouveler", row: "warning" },
};

export function AccueilPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="L'accueil">
      {(index) => <Accueil index={index} />}
    </QueryState>
  );
}

function Accueil({ index }: { index: Portefeuille }) {
  const { data } = index;
  const [renewing, setRenewing] = useState<string>();
  const figures = data.mandants.map((mandant) => ({ mandant, ...mandantFigures(index, mandant.id) }));
  const operational = figures.filter((line) => line.lots > 0);
  const called = figures.reduce((sum, line) => sum + line.calledMinor, 0);
  const collected = figures.reduce((sum, line) => sum + line.collectedMinor, 0);
  const fees = figures.reduce((sum, line) => sum + line.feeMinor, 0);
  const payout = figures.reduce((sum, line) => sum + line.payoutMinor, 0);
  const lots = figures.reduce((sum, line) => sum + line.lots, 0);
  const overdue = data.baux.filter((bail) => bail.status === "en_cours" && bail.overdueSinceIso);
  const overdueTotal = overdue.reduce((sum, bail) => sum - balanceMinor(bail), 0);
  const toRenew = data.mandats.filter((mandat) => mandatState(mandat, data.todayIso) === "a_renouveler");
  const expiring = data.compliance.find((item) => item.state === "a_renouveler");
  const month = monthName(data.todayIso);
  const payoutDate = formatDay(nextPayoutIso(data.todayIso, index.activeMandat(operational[0]?.mandant.id ?? "")?.payoutDay ?? 5));
  const rate = index.activeMandat(operational[0]?.mandant.id ?? "")?.feeBasisPoints ?? 700;
  const share = called === 0 ? 0 : Math.round((collected / called) * 100);
  const toRenewMandat = renewing ? index.mandat(renewing) : undefined;

  return (
    <>
      <PageHeader
        title={data.managerFirstName ? `Bonjour ${data.managerFirstName}` : "Bonjour"}
        description={`${data.agencyName} · ${formatLongDay(data.todayIso)} · ${plural(data.mandants.length, "mandant", "mandants")}, ${plural(lots, "lot", "lots")} sous mandat`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/comptes-rendus/nouveau">
                <Icon icon={ScrollText} />
                Générer les comptes rendus
              </Link>
            </Button>
            <Button asChild>
              <Link href={agenceRoutes.mandatNew}>
                <Icon icon={Plus} />
                Nouveau mandat
              </Link>
            </Button>
          </>
        }
      />

      {expiring ? (
        <ActionAlert
          tone="warning"
          title="Assurance responsabilité civile professionnelle, à renouveler"
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href={agenceRoutes.conformite}>Voir la conformité</Link>
            </Button>
          }
        >
          {expiring.detail}. Le renouvellement conditionne la carte professionnelle.
        </ActionAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Loyers encaissés, ${month}`} value={formatEuros(collected)}>
          <span className="text-caption text-fg-subtle">{`sur ${formatEuros(called)} appelés · ${String(share)} %`}</span>
        </StatCard>
        <StatCard label="Honoraires du mois" value={formatEurosExact(fees)}>
          <span className="text-caption text-fg-subtle">{`${formatRate(rate)} TTC des loyers encaissés`}</span>
        </StatCard>
        <StatCard label="Reversements en attente" value={formatEurosExact(payout)}>
          <span className="text-caption text-fg-subtle">{`${plural(operational.length, "mandant", "mandants")}, le ${payoutDate}`}</span>
        </StatCard>
        <StatCard label="Impayés" value={formatEuros(overdueTotal)} tone="danger">
          <span className="text-caption text-fg-subtle">{plural(overdue.length, "locataire", "locataires")}</span>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title={`Reversements de ${month}`}
          action={
            <Button variant="link" asChild>
              <Link href={agenceRoutes.reversements}>{`Tout voir, ${String(operational.length)}`}</Link>
            </Button>
          }
        >
          <Table aria-label={`Reversements de ${month}`}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mandant</TableHeaderCell>
                <TableHeaderCell numeric>Lots</TableHeaderCell>
                <TableHeaderCell numeric>Encaissé</TableHeaderCell>
                <TableHeaderCell numeric>Honoraires</TableHeaderCell>
                <TableHeaderCell numeric>À reverser</TableHeaderCell>
                <TableHeaderCell>État</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {operational.map(({ mandant, lots: count, collectedMinor, feeMinor, payoutMinor }) => (
                <TableRow key={mandant.id}>
                  <TableCell strong>
                    <Link href={mandantHref(mandant.id)} className="hover:underline">
                      {mandant.name}
                    </Link>
                    <span className="block text-caption font-normal text-fg-subtle">{mandant.legal}</span>
                  </TableCell>
                  <TableCell numeric>{count}</TableCell>
                  <TableCell numeric>{formatEurosExact(collectedMinor)}</TableCell>
                  <TableCell numeric>{formatEurosExact(feeMinor)}</TableCell>
                  <TableCell numeric strong>
                    {formatEurosExact(payoutMinor)}
                  </TableCell>
                  <TableCell>
                    <Badge tone="info">À reverser</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Conformité">
          <div>
            {data.compliance.map((item) => {
              const pill = COMPLIANCE_PILLS[item.state];
              return (
                <ListRow
                  key={item.id}
                  icon={COMPLIANCE_ICONS[item.id] ?? BadgeCheck}
                  tone={pill.row}
                  title={item.label}
                  caption={item.detail}
                  trailing={<Badge tone={pill.tone}>{pill.label}</Badge>}
                />
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <SectionCard
          title="Mandats à renouveler"
          action={
            <Button variant="link" asChild>
              <Link href={`${agenceRoutes.mandats}?etat=a_renouveler`}>{`Tout voir, ${String(toRenew.length)}`}</Link>
            </Button>
          }
        >
          {toRenew.length === 0 ? (
            <p className="py-2 text-body text-fg-subtle">Aucun mandat n&apos;arrive à échéance.</p>
          ) : (
            <div>
              {toRenew.map((mandat) => {
                const mandant = index.mandant(mandat.mandantId);
                return (
                  <ListRow
                    key={mandat.id}
                    icon={Handshake}
                    tone="warning"
                    title={
                      <Link href={mandatHref(mandat.id)} className="hover:underline">{`${mandant?.name ?? "Mandant"}, mandat ${mandat.number}`}</Link>
                    }
                    caption={`Expire le ${formatDay(mandat.endIso)} · ${plural(index.biensOfMandat(mandat.id).length, "lot", "lots")}`}
                    trailing={
                      <Button
                        variant="link"
                        onClick={() => { setRenewing(mandat.id); }}
                        aria-label={`Renouveler le mandat ${mandat.number}`}
                      >
                        Renouveler
                      </Button>
                    }
                  />
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Impayés par mandant"
          action={
            <Button variant="link" asChild>
              <Link href={agenceRoutes.impayes}>{`Tout voir, ${String(overdue.length)}`}</Link>
            </Button>
          }
        >
          {overdue.length === 0 ? (
            <p className="py-2 text-body text-fg-subtle">Aucun loyer en retard.</p>
          ) : (
            <div>
              {overdue.map((bail) => {
                const bien = index.bien(bail.bienId);
                const mandant = bien ? index.mandantOfBien(bien) : undefined;
                return (
                  <ListRow
                    key={bail.id}
                    icon={CircleAlert}
                    tone="danger"
                    title={`${mandant?.name ?? "Mandant"}, ${bien?.name ?? "Lot"}`}
                    caption={`${index.locataire(bail.locataireId)?.name ?? "Locataire"} · ${plural(overdueDays(bail, data.todayIso), "jour", "jours")}`}
                    trailing={<strong className="tabular-nums text-fg">{formatEuros(-balanceMinor(bail))}</strong>}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <RenewMandatDialog mandat={toRenewMandat} onOpenChange={(open) => { if (!open) setRenewing(undefined); }} />
    </>
  );
}
