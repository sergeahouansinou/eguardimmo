"use client";

import { Button, Icon, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Upload } from "lucide-react";
import { useState } from "react";
import { formatDate } from "../data/dates";
import { useConfie } from "../data/queries";
import type { ConfieData, DocumentCategory, OwnerDocument } from "../data/schemas";
import { DOCUMENT_CATEGORY_LABELS } from "../data/inputs";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { PageHeader } from "../ui/PageHeader";
import { DownloadButton } from "../ui/parts";
import { Caption, Section } from "../ui/Section";
import { EmptyLine, QueryBoundary } from "../ui/States";
import { DepositDialog } from "./DepositDialog";

const PAGE_SIZE = 10;

const TABS: readonly { value: string; label: string; categories: readonly DocumentCategory[] | null }[] = [
  { value: "tous", label: "Tous", categories: null },
  { value: "mandat", label: "Mandat", categories: ["mandat"] },
  { value: "comptes-rendus", label: "Comptes rendus", categories: ["compte_rendu"] },
  { value: "quittances", label: "Quittances", categories: ["quittance"] },
  { value: "reversements", label: "Reversements", categories: ["reversement"] },
  { value: "fiscal", label: "Fiscal et assurance", categories: ["fiscal", "assurance"] },
];

export function formatSize(sizeKo: number): string {
  return sizeKo >= 1024 ? `${(sizeKo / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo` : `${String(sizeKo)} Ko`;
}

export function DocumentsScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Documents data={data} />}</QueryBoundary>;
}

function Documents({ data }: { data: ConfieData }) {
  const [tab, setTab] = useState("tous");
  const [pages, setPages] = useState<Record<string, number>>({});
  const [depositing, setDepositing] = useState(false);
  const inTab = (categories: readonly DocumentCategory[] | null) =>
    categories === null ? data.documents : data.documents.filter((document) => categories.includes(document.category));

  const columns: Column<OwnerDocument>[] = [
    { id: "title", header: "Document", primary: true, cell: (document) => <>{document.title}<br /><Caption>{document.detail}</Caption></> },
    { id: "type", header: "Type", cell: (document) => DOCUMENT_CATEGORY_LABELS[document.category] },
    { id: "date", header: "Date", cell: (document) => formatDate(document.date) },
    { id: "size", header: "Taille", align: "end", cell: (document) => formatSize(document.sizeKo) },
    { id: "action", header: "Action", action: true, cell: (document) => <DownloadButton title={document.title} /> },
  ];

  return (
    <>
      <PageHeader
        title="Documents"
        crumbs={[{ label: "Mon patrimoine" }, { label: "Documents" }]}
        subtitle="Les documents de votre mandat, de vos lots et de votre fiscalité, classés par l'agence."
        actions={<Button onClick={() => { setDepositing(true); }}><Icon icon={Upload} />Déposer un document</Button>}
      />
      <Section title="Tous les documents">
        <Tabs value={tab} defaultValue="tous" onValueChange={setTab}>
          <TabList aria-label="Catégories de documents">
            {TABS.map((item) => (
              <Tab key={item.value} value={item.value} count={inTab(item.categories).length}>{item.label}</Tab>
            ))}
          </TabList>
          {TABS.map((item) => {
            const documents = inTab(item.categories);
            const current = Math.min(pages[item.value] ?? 0, Math.max(0, Math.ceil(documents.length / PAGE_SIZE) - 1));
            const visible = documents.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
            const rows: TableRow<OwnerDocument>[] = visible.map((document) => ({ key: document.id, value: document }));
            const count = documents.length;
            return (
              <TabPanel key={item.value} value={item.value} className="flex flex-col gap-2 pt-2">
                {count === 0 ? <EmptyLine>Aucun document dans cette catégorie.</EmptyLine> : <DataTable caption={`Documents, ${item.label}`} columns={columns} rows={rows} />}
                <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-fg-subtle">
                  <span>{count === 0 ? "0 document" : `${String(current * PAGE_SIZE + 1)} à ${String(current * PAGE_SIZE + visible.length)} sur ${String(count)}`}</span>
                  {count > PAGE_SIZE ? (
                    <span className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={current === 0} onClick={() => { setPages({ ...pages, [item.value]: current - 1 }); }}>Précédent</Button>
                      <Button variant="secondary" size="sm" disabled={(current + 1) * PAGE_SIZE >= count} onClick={() => { setPages({ ...pages, [item.value]: current + 1 }); }}>Suivant</Button>
                    </span>
                  ) : null}
                </div>
              </TabPanel>
            );
          })}
        </Tabs>
      </Section>
      <DepositDialog open={depositing} onOpenChange={setDepositing} lots={data.lots} />
    </>
  );
}
