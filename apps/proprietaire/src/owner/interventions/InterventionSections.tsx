"use client";

import { Badge } from "@eguardimmo/ui";
import { DataList } from "@/features/confie/ui/DataList";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { ListRow, RowList } from "@/features/confie/ui/ListRow";
import { EmptyLine } from "@/features/confie/ui/States";
import { Section } from "@/features/confie/ui/Section";
import { CalendarDays, MessageSquare } from "lucide-react";
import { NOT_AVAILABLE, formatDateTime, formatDay, formatMoney, formatOptionalDay, formatOptionalMoney, formatQuantity, formatRatePcm, labelOf } from "../format";
import { DownloadAction } from "../shared/DownloadAction";
import { downloadName } from "../shared/download";
import { APPROVAL_STATUS, DECIDED_VIA, EVENT_AUTHOR, EVENT_KIND, FILE_KIND, QUOTE_KIND, QUOTE_STATUS, SUPPLIER_INVOICE_STATUS, VISIT_SLOT, VISIT_STATUS } from "./labels";
import type { InterventionApproval, InterventionFile, InterventionQuote, InvoiceAllocation, OwnerInterventionDetail, QuoteLine, SupplierInvoice } from "./model";
import { interventionFilePath } from "./requests";
import { ApprovalActions, approvalDecisions } from "./ApprovalActions";
import type { NoticeHandler } from "./ApprovalActions";

const quoteLineColumns: readonly Column<QuoteLine>[] = [
  { id: "label", header: "Désignation", primary: true, cell: (line) => line.label },
  { id: "quantite", header: "Quantité", align: "end", cell: (line) => `${formatQuantity(line.quantityMilli)}${line.unit === null ? "" : ` ${line.unit}`}` },
  { id: "prix", header: "Prix unitaire HT", align: "end", cell: (line) => formatMoney(line.unitPrice) },
  { id: "taxe", header: "Taxe", align: "end", cell: (line) => formatRatePcm(line.taxRatePcm) },
  { id: "net", header: "Total HT", align: "end", cell: (line) => formatMoney(line.netAmount) },
];

export function QuoteBlock({ quote }: { quote: InterventionQuote }) {
  const status = QUOTE_STATUS[quote.status];
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body-strong [overflow-wrap:anywhere]">{`${quote.reference ?? "Devis"} · ${labelOf(QUOTE_KIND, quote.kind)}`}</h3>
        <Badge tone={status?.tone ?? "neutral"}>{status?.label ?? labelOf({}, quote.status)}</Badge>
      </div>
      <DataList
        width="lg"
        items={[
          { label: "Émis le", value: formatDay(quote.issuedOn) },
          { label: "Valable jusqu’au", value: formatOptionalDay(quote.validUntil) },
          { label: "Passage proposé le", value: formatOptionalDay(quote.proposedOn) },
          { label: "Total HT", value: formatOptionalMoney(quote.totalNet) },
          { label: "Total taxes", value: formatOptionalMoney(quote.totalTax) },
          { label: "Total TTC", value: formatOptionalMoney(quote.totalGross) },
        ]}
      />
      <DataTable caption={`Lignes du devis ${quote.reference ?? ""}`.trim()} columns={quoteLineColumns} rows={quote.lines.map((line) => ({ key: String(line.position), value: line }))} />
    </div>
  );
}

export function QuotesSection({ quotes }: { quotes: readonly InterventionQuote[] }) {
  return (
    <Section title="Devis soumis">
      {quotes.length === 0 ? <EmptyLine>Aucun devis n’a encore été soumis à votre décision.</EmptyLine> : <div className="flex flex-col gap-3">{quotes.map((quote) => <QuoteBlock key={quote.id} quote={quote} />)}</div>}
    </Section>
  );
}

function ApprovalRow({ approval }: { approval: InterventionApproval }) {
  const status = APPROVAL_STATUS[approval.status];
  const decided = approval.decidedAt === null ? `À décider avant le ${formatDateTime(approval.decideBefore)}` : `Décidé le ${formatDateTime(approval.decidedAt)}${approval.decidedVia === null ? "" : ` · ${labelOf(DECIDED_VIA, approval.decidedVia)}`}`;
  return (
    <ListRow
      icon={MessageSquare}
      tone={approval.status === "pending" ? "warning" : "default"}
      title={`${formatOptionalMoney(approval.amount)} · demandé le ${formatDateTime(approval.requestedAt)}`}
      detail={`${decided}${approval.comment === null ? "" : ` · « ${approval.comment} »`}`}
      trailing={<Badge tone={status?.tone ?? "neutral"}>{status?.label ?? labelOf({}, approval.status)}</Badge>}
    />
  );
}

export function ApprovalsSection({ intervention, onNotice }: { intervention: OwnerInterventionDetail; onNotice: NoticeHandler }) {
  const { approvals } = intervention;
  const open = approvals.filter((approval) => approvalDecisions(approval.status).length > 0);
  return (
    <Section title="Demandes d’accord">
      {approvals.length === 0 ? (
        <EmptyLine>Aucune demande d’accord pour cette intervention.</EmptyLine>
      ) : (
        <RowList label="Demandes d’accord">
          {approvals.map((approval) => (
            <ApprovalRow key={approval.id} approval={approval} />
          ))}
        </RowList>
      )}
      {open.map((approval) => (
        <div key={approval.id} className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
          <b className="text-body-strong">{`Votre décision sur la demande du ${formatDay(approval.requestedAt)}`}</b>
          <ApprovalActions intervention={intervention} approval={approval} onNotice={onNotice} />
        </div>
      ))}
    </Section>
  );
}

export function VisitsSection({ visits }: { visits: OwnerInterventionDetail["visits"] }) {
  return (
    <Section title="Visites">
      {visits.length === 0 ? (
        <EmptyLine>Aucune visite n’est prévue.</EmptyLine>
      ) : (
        <RowList label="Visites">
          {visits.map((visit) => (
            <ListRow key={visit.id} icon={CalendarDays} title={`${formatDay(visit.scheduledOn)} · ${labelOf(VISIT_SLOT, visit.slot)}`} detail={labelOf(VISIT_STATUS, visit.status)} />
          ))}
        </RowList>
      )}
    </Section>
  );
}

export function EventsSection({ events }: { events: OwnerInterventionDetail["events"] }) {
  return (
    <Section title="Historique">
      {events.length === 0 ? (
        <EmptyLine>Aucun événement enregistré.</EmptyLine>
      ) : (
        <ol aria-label="Historique de l’intervention" className="flex flex-col">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col border-t border-line py-2 first:border-t-0">
              <b className="text-body-strong text-fg">{labelOf(EVENT_KIND, event.kind)}</b>
              <span className="text-caption text-fg-subtle">{`${formatDateTime(event.createdAt)} · ${labelOf(EVENT_AUTHOR, event.author)}`}</span>
              {event.text === null ? null : <span className="break-words text-body text-fg">{event.text}</span>}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function FilesSection({ interventionId, files }: { interventionId: string; files: readonly InterventionFile[] }) {
  const columns: readonly Column<InterventionFile>[] = [
    { id: "nom", header: "Fichier", primary: true, cell: (file) => file.name },
    { id: "nature", header: "Nature", cell: (file) => labelOf(FILE_KIND, file.kind) },
    { id: "ajoute", header: "Ajouté le", cell: (file) => formatOptionalDay(file.createdAt) },
    {
      id: "telecharger",
      header: "Télécharger",
      action: true,
      cell: (file) => (
        <DownloadAction path={interventionFilePath(interventionId, file.id)} filename={downloadName(file.name)} format="any" label="Télécharger" ariaLabel={`Télécharger ${file.name}`} variant="link" />
      ),
    },
  ];
  return (
    <Section title="Fichiers partagés">
      {files.length === 0 ? <EmptyLine>Votre agence n’a partagé aucun fichier pour cette intervention.</EmptyLine> : <DataTable caption="Fichiers partagés de l’intervention" columns={columns} rows={files.map((file) => ({ key: file.id, value: file }))} />}
    </Section>
  );
}

export function InvoicesSection({ invoices, allocations }: { invoices: readonly SupplierInvoice[]; allocations: readonly InvoiceAllocation[] }) {
  const invoiceColumns: readonly Column<SupplierInvoice>[] = [
    { id: "numero", header: "Facture", primary: true, cell: (invoice) => invoice.number ?? NOT_AVAILABLE },
    { id: "statut", header: "Statut", cell: (invoice) => labelOf(SUPPLIER_INVOICE_STATUS, invoice.status) },
    { id: "date", header: "Date", cell: (invoice) => formatDay(invoice.invoiceOn) },
    { id: "echeance", header: "Échéance", cell: (invoice) => formatOptionalDay(invoice.dueOn) },
    { id: "ttc", header: "Total TTC", align: "end", cell: (invoice) => formatOptionalMoney(invoice.totalGross) },
  ];
  const allocationColumns: readonly Column<InvoiceAllocation>[] = [
    { id: "facture", header: "Facture", primary: true, cell: (allocation) => invoices.find((invoice) => invoice.id === allocation.invoiceId)?.number ?? "Facture du prestataire" },
    { id: "date", header: "Imputée le", cell: (allocation) => formatOptionalDay(allocation.createdAt) },
    { id: "montant", header: "À votre charge", align: "end", cell: (allocation) => formatOptionalMoney(allocation.chargedAmount) },
  ];
  return (
    <>
      <Section title="Factures du prestataire">
        {invoices.length === 0 ? <EmptyLine>Aucune facture reçue pour cette intervention.</EmptyLine> : <DataTable caption="Factures du prestataire" columns={invoiceColumns} rows={invoices.map((invoice) => ({ key: invoice.id, value: invoice }))} />}
      </Section>
      {allocations.length === 0 ? null : (
        <Section title="Imputations à votre charge">
          <DataTable caption="Imputations à votre charge" columns={allocationColumns} rows={allocations.map((allocation) => ({ key: allocation.id, value: allocation }))} />
        </Section>
      )}
    </>
  );
}
