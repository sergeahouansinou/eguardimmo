"use client";

import { Badge } from "@eguardimmo/ui";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyLabel, formatMoney, formatOptionalDay, labelOf } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { INVOICE_KIND, INVOICE_STATUS } from "./labels";
import type { OwnerInvoice } from "./model";
import { useInvoices } from "./queries";

export function InvoiceStatusBadge({ status }: { status: string }) {
  const entry = INVOICE_STATUS[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, status)}</Badge>;
}

export const invoiceTitle = (invoice: Pick<OwnerInvoice, "kind" | "number">): string => `${labelOf(INVOICE_KIND, invoice.kind)} ${invoice.number ?? NOT_AVAILABLE}`;

const columns: readonly Column<OwnerInvoice>[] = [
  {
    id: "numero",
    header: "Facture",
    primary: true,
    cell: (invoice) => (
      <Link href={confieRoutes.facture(invoice.id)} className="underline-offset-2 hover:underline">
        {invoiceTitle(invoice)}
      </Link>
    ),
  },
  { id: "statut", header: "Statut", cell: (invoice) => <InvoiceStatusBadge status={invoice.status} /> },
  { id: "emission", header: "Émise le", cell: (invoice) => formatOptionalDay(invoice.issuedOn) },
  { id: "echeance", header: "Échéance", cell: (invoice) => formatOptionalDay(invoice.dueOn) },
  { id: "agence", header: "Agence", cell: (invoice) => agencyLabel(invoice.agency.name) },
  { id: "ttc", header: "Total TTC", align: "end", cell: (invoice) => formatMoney(invoice.totalGross) },
];

export function InvoicesScreen() {
  const filter = useAgencyFilter();
  const list = useInvoices(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Factures d’honoraires" subtitle="Les factures et avoirs que votre agence vous adresse" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement de vos factures"
          failureTitle="Vos factures n’ont pas pu être chargées"
          empty={{ icon: Receipt, title: "Aucune facture", description: "Votre agence ne vous a adressé aucune facture d’honoraires pour cette sélection." }}
        >
          {(invoices) => (
            <Section title="Factures et avoirs">
              <DataTable caption="Factures d’honoraires et avoirs" columns={columns} rows={invoices.map((invoice) => ({ key: invoice.id, value: invoice }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
