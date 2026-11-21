import { Alert, Button, StatCard } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { Caption, StatGrid } from "@/features/confie/ui/Section";
import { formatMoney, formatMonth, formatOptionalDay } from "../format";
import type { OwnerHome } from "./model";

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count > 1 ? pluralForm : singular}`;
}

export function QuotesAlert({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Alert tone="info" title={count > 1 ? `${String(count)} devis attendent votre décision` : "Un devis attend votre décision"}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span>Votre agence a besoin de votre accord avant de lancer les travaux.</span>
        <Button variant="secondary" size="sm" asChild>
          <Link href={confieRoutes.interventions}>Voir les interventions</Link>
        </Button>
      </span>
    </Alert>
  );
}

function ArrearsCaption({ home }: { home: OwnerHome }) {
  const { count, maxDaysLate } = home.month.arrears;
  if (count === 0) return <Caption>Aucun impayé</Caption>;
  return <Caption>{`${plural(count, "échéance")}, jusqu’à ${plural(maxDaysLate, "jour")} de retard`}</Caption>;
}

export function HomeStats({ home }: { home: OwnerHome }) {
  const month = formatMonth(home.month.period).toLowerCase();
  const { payouts } = home;
  return (
    <>
      <StatGrid columns={payouts === null ? 3 : 4}>
        <StatCard label={`Loyers encaissés, ${month}`} value={formatMoney(home.month.collected)}>
          <Caption>{`sur ${formatMoney(home.month.called)} appelés`}</Caption>
        </StatCard>
        <StatCard label="Impayés" tone={home.month.arrears.amount.amount > 0 ? "danger" : "default"} value={formatMoney(home.month.arrears.amount)}>
          <ArrearsCaption home={home} />
        </StatCard>
        {payouts === null ? null : (
          <>
            <StatCard label="Reversement en attente" value={payouts.pending === null ? "Aucun" : formatMoney(payouts.pending.net)}>
              <Caption>{payouts.pending === null ? "Rien n’est en attente de versement" : `Après ${formatMoney(payouts.pending.fees)} d’honoraires`}</Caption>
            </StatCard>
            <StatCard label="Dernier reversement" value={payouts.last === null ? "Aucun" : formatMoney(payouts.last.amount)}>
              <Caption>{payouts.last === null ? "Aucun reversement versé" : `Versé le ${formatOptionalDay(payouts.last.date)}${payouts.last.number === null ? "" : ` · ${payouts.last.number}`}`}</Caption>
            </StatCard>
          </>
        )}
      </StatGrid>
      {payouts === null ? (
        <Alert tone="info" title="Reversements non visibles">
          En tant que co-indivisaire, vous n’avez pas accès aux reversements ni au compte du mandat : ils concernent le titulaire du mandat.
        </Alert>
      ) : null}
    </>
  );
}

export function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Button variant="link" size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
