"use client";

import { Button } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Caption, Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyLabel, formatMoney, formatOptionalDay, formatQuantity, formatRatePcm, labelOf } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { DownloadAction } from "../shared/DownloadAction";
import { downloadName } from "../shared/download";
import { InvoiceStatusBadge, invoiceTitle } from "./InvoicesScreen";
import { TAX_CATEGORY } from "./labels";
import type { InvoiceLine, InvoiceTax, OwnerInvoiceDetail } from "./model";
import { useInvoice } from "./queries";
import { invoiceDownloadPath } from "./requests";

const lineColumns: readonly Column<InvoiceLine>[] = [
  { id: "description", header: "Désignation", primary: true, cell: (line) => line.description },
  { id: "quantite", header: "Quantité", align: "end", cell: (line) => formatQuantity(line.quantityMilli) },
  { id: "prix", header: "Prix unitaire HT", align: "end", cell: (line) => formatMoney(line.unitPrice) },
  { id: "taxe", header: "Taxe", cell: (line) => `${labelOf(TAX_CATEGORY, line.taxCategory)} · ${formatRatePcm(line.taxRatePcm)}` },
  { id: "net", header: "Total HT", align: "end", cell: (line) => formatMoney(line.netAmount) },
];

const taxColumns: readonly Column<InvoiceTax>[] = [
  { id: "categorie", header: "Taxe", primary: true, cell: (tax) => `${labelOf(TAX_CATEGORY, tax.category)} · ${formatRatePcm(tax.ratePcm)}` },
  { id: "base", header: "Base", align: "end", cell: (tax) => formatMoney(tax.baseAmount) },
  { id: "montant", header: "Montant", align: "end", cell: (tax) => formatMoney(tax.taxAmount) },
];

function Content({ invoice }: { invoice: OwnerInvoiceDetail }) {
  const title = invoiceTitle(invoice);
  const service = invoice.serviceFrom === null || invoice.serviceTo === null ? NOT_AVAILABLE : `Du ${formatOptionalDay(invoice.serviceFrom)} au ${formatOptionalDay(invoice.serviceTo)}`;
  return (
    <>
      <PageHeader
        title={title}
        subtitle={agencyLabel(invoice.agency.name)}
        badges={<InvoiceStatusBadge status={invoice.status} />}
        crumbs={[{ label: "Factures d’honoraires", href: confieRoutes.factures }, { label: title }]}
        actions={
          invoice.hasPdf ? (
            <DownloadAction path={invoiceDownloadPath(invoice.id)} filename={downloadName(`facture-${invoice.number ?? "honoraires"}`, "application/pdf")} format="pdf" label="Télécharger le PDF" variant="primary" />
          ) : (
            <Caption>Le PDF de cette facture n’est pas disponible.</Caption>
          )
        }
      />
      <Section title="Facture">
        <DataList
          width="lg"
          items={[
            { label: "Émise le", value: formatOptionalDay(invoice.issuedOn) },
            { label: "Échéance", value: formatOptionalDay(invoice.dueOn) },
            { label: "Période facturée", value: service },
            { label: "Total HT", value: formatMoney(invoice.totalNet) },
            { label: "Total taxes", value: formatMoney(invoice.totalTax) },
            { label: "Total TTC", value: formatMoney(invoice.totalGross) },
          ]}
        />
        {invoice.creditedInvoiceId === null ? null : (
          <Button variant="link" size="sm" asChild className="mt-2 self-start">
            <Link href={confieRoutes.facture(invoice.creditedInvoiceId)}>Voir la facture corrigée par cet avoir</Link>
          </Button>
        )}
      </Section>
      <Section title="Lignes">
        <DataTable caption="Lignes de la facture" columns={lineColumns} rows={invoice.lines.map((line) => ({ key: String(line.position), value: line }))} />
      </Section>
      <Section title="Détail des taxes">
        <DataTable caption="Taxes de la facture" columns={taxColumns} rows={invoice.taxes.map((tax) => ({ key: `${tax.category}-${String(tax.ratePcm)}`, value: tax }))} />
      </Section>
    </>
  );
}

export function InvoiceScreen({ id }: { id: string }) {
  const query = useInvoice(id);
  if (query.data !== undefined) return <Content invoice={query.data} />;
  if (!query.isError) return <Loading label="Chargement de la facture" />;
  return (
    <>
      <PageHeader title="Facture" crumbs={[{ label: "Factures d’honoraires", href: confieRoutes.factures }, { label: "Facture" }]} />
      <FailureNotice title="Cette facture n’a pas pu être chargée" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.factures}>Retour aux factures</Link>
        </Button>
      </div>
    </>
  );
}
