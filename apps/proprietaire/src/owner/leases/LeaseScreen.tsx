"use client";

import { Badge, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Caption, Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyAndMandant, formatBasisPoints, formatDay, formatMoney, formatOptionalDay, labelOf } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { BILLING_TIMING, NOTICE_GIVEN_BY, PARTY_ROLE, PERIODICITY } from "./labels";
import type { LeaseTenant, LeaseTerm, LeaseUnitLink, OwnerLeaseDetail } from "./model";
import { PhaseBadge, leasePeriod } from "./LeasesScreen";
import { useLease } from "./queries";

const since = (from: string, to: string | null): string => (to === null ? `Depuis le ${formatDay(from)}` : `Du ${formatDay(from)} au ${formatDay(to)}`);

const tenantColumns: readonly Column<LeaseTenant>[] = [
  { id: "nom", header: "Nom", primary: true, cell: (tenant) => tenant.displayName },
  { id: "role", header: "Rôle", cell: (tenant) => labelOf(PARTY_ROLE, tenant.role) },
  { id: "periode", header: "Période", cell: (tenant) => since(tenant.validFrom, tenant.endDate) },
];

const unitColumns: readonly Column<LeaseUnitLink>[] = [
  {
    id: "lot",
    header: "Lot",
    primary: true,
    cell: (link) =>
      link.unit === null ? (
        NOT_AVAILABLE
      ) : (
        <Link href={confieRoutes.bien(link.unit.id)} className="underline-offset-2 hover:underline">
          {`${link.unit.reference} · ${link.unit.propertyName}`}
        </Link>
      ),
  },
  { id: "principal", header: "Lot principal", cell: (link) => (link.isMain ? <Badge tone="info">Principal</Badge> : "Non") },
  { id: "periode", header: "Période", cell: (link) => since(link.validFrom, link.endDate) },
];

const termColumns: readonly Column<LeaseTerm>[] = [
  { id: "composante", header: "Composante", primary: true, cell: (term) => term.componentLabel ?? NOT_AVAILABLE },
  { id: "montant", header: "Montant", align: "end", cell: (term) => formatMoney(term.amount) },
  { id: "tva", header: "TVA", align: "end", cell: (term) => formatBasisPoints(term.vatBasisPoints) },
  { id: "indexe", header: "Indexé", cell: (term) => (term.indexed ? "Oui" : "Non") },
  { id: "periode", header: "Période", cell: (term) => since(term.validFrom, term.endDate) },
];

function Content({ lease }: { lease: OwnerLeaseDetail }) {
  const title = lease.reference ?? "Bail sans référence";
  return (
    <>
      <PageHeader
        title={`Bail ${title}`}
        subtitle={agencyAndMandant(lease.agency.name, lease.mandantName)}
        badges={<PhaseBadge phase={lease.phase} />}
        crumbs={[{ label: "Baux", href: confieRoutes.baux }, { label: title }]}
      />
      <Section title="Bail">
        <DataList
          width="lg"
          items={[
            { label: "Période", value: leasePeriod(lease) },
            { label: "Signé le", value: formatOptionalDay(lease.signedOn) },
            { label: "Durée", value: lease.durationMonths === null ? NOT_AVAILABLE : `${String(lease.durationMonths)} mois` },
            { label: "Reconduction tacite", value: lease.tacitRenewal ? "Oui" : "Non" },
            { label: "Périodicité", value: labelOf(PERIODICITY, lease.periodicity) },
            { label: "Paiement", value: labelOf(BILLING_TIMING, lease.billingTiming) },
            { label: "Jour d’échéance", value: lease.dueDay === null ? NOT_AVAILABLE : `Le ${String(lease.dueDay)} du mois` },
          ]}
        />
      </Section>
      {lease.notice === null ? null : (
        <Section title="Préavis">
          <DataList
            width="lg"
            items={[
              { label: "Reçu le", value: formatDay(lease.notice.receivedOn) },
              { label: "Donné par", value: lease.notice.givenBy === null ? NOT_AVAILABLE : labelOf(NOTICE_GIVEN_BY, lease.notice.givenBy) },
              { label: "Départ prévu le", value: formatOptionalDay(lease.notice.departureOn) },
            ]}
          />
        </Section>
      )}
      <Section title="Locataires" aside={<Caption>Nom, rôle et dates seulement</Caption>}>
        <DataTable caption="Locataires du bail" columns={tenantColumns} rows={lease.tenants.map((tenant, index) => ({ key: `${tenant.displayName}-${String(index)}`, value: tenant }))} />
      </Section>
      <Section title="Lots du bail">
        <DataTable caption="Lots du bail" columns={unitColumns} rows={lease.units.map((link, index) => ({ key: `${link.unit?.id ?? "lot"}-${String(index)}`, value: link }))} />
      </Section>
      <Section title={`Loyer et charges au ${formatDay(lease.termsOn)}`}>
        <DataTable caption="Loyer et charges du bail" columns={termColumns} rows={lease.terms.map((term, index) => ({ key: `${term.componentLabel ?? "terme"}-${String(index)}`, value: term }))} />
      </Section>
    </>
  );
}

export function LeaseScreen({ id }: { id: string }) {
  const query = useLease(id);
  if (query.data !== undefined) return <Content lease={query.data} />;
  if (!query.isError) return <Loading label="Chargement du bail" />;
  return (
    <>
      <PageHeader title="Bail" crumbs={[{ label: "Baux", href: confieRoutes.baux }, { label: "Bail" }]} />
      <FailureNotice title="Ce bail n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.baux}>Retour aux baux</Link>
        </Button>
      </div>
    </>
  );
}
