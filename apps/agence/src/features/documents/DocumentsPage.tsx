"use client";

import { Badge, Button, Chip, ConfirmDialog, EmptyState, Icon, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { FileSearch, Upload } from "lucide-react";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable } from "@/features/kit/DataTable";
import { LinkButton } from "@/features/kit/LinkButton";
import { useNotify } from "@/features/kit/notify";
import { PageFrame } from "@/features/kit/PageFrame";
import { splitServerError } from "@/features/kit/serverValidation";
import { usePagination } from "@/features/kit/usePagination";
import { formatDate } from "@/features/shared/dates";
import { formatFileSize } from "@/features/shared/files";
import { matchesQuery } from "@/lib/text";
import { DocumentDialog } from "./DocumentDialog";
import { OWNER_OPTIONS, attachmentLabel, sharingPill } from "./labels";
import { useArchiveDocument, useDocuments } from "./queries";
import { CATEGORIES } from "./schemas";
import type { DocumentRecord } from "./schemas";

const PAGE_SIZE = 10;

type TabValue = "actifs" | "archives";

interface Filters {
  search: string;
  owner: string;
  category: string;
  mandant: boolean;
  internal: boolean;
}

const NO_FILTERS: Filters = { search: "", owner: "tous", category: "toutes", mandant: false, internal: false };

function matches(document: DocumentRecord, filters: Filters): boolean {
  if (!matchesQuery(filters.search, document.displayName, document.fileName, attachmentLabel(document))) return false;
  if (filters.owner !== "tous" && document.ownerId !== filters.owner) return false;
  if (filters.category !== "toutes" && document.category !== filters.category) return false;
  const internal = !document.sharedWithMandant && !document.sharedWithTenant;
  if (filters.mandant || filters.internal) {
    const shared = filters.mandant && document.sharedWithMandant;
    return shared || (filters.internal && internal);
  }
  return true;
}

export function DocumentsPage() {
  const query = useDocuments();
  return (
    <QueryState query={query} label="Les documents">
      {(data) => <Documents documents={data.documents} />}
    </QueryState>
  );
}

function Documents({ documents }: { documents: readonly DocumentRecord[] }) {
  const notify = useNotify();
  const archive = useArchiveDocument();
  const [tab, setTab] = useState<TabValue>("actifs");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toArchive, setToArchive] = useState<DocumentRecord | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const active = documents.filter((document) => !document.archived);
  const archived = documents.filter((document) => document.archived);
  const rows = (tab === "actifs" ? active : archived).filter((document) => matches(document, filters));
  const filtered = filters.search !== "" || filters.owner !== "tous" || filters.category !== "toutes" || filters.mandant || filters.internal;
  const opened = openId === null ? null : (documents.find((document) => document.id === openId) ?? null);
  const filterKey = `${tab}|${filters.search}|${filters.owner}|${filters.category}|${String(filters.mandant)}|${String(filters.internal)}`;

  const confirmArchive = () => {
    if (!toArchive) return;
    archive.mutate(
      { id: toArchive.id, archived: true },
      {
        onSuccess: () => {
          notify.success("Document archivé", `« ${toArchive.displayName} » est dans l’onglet Archives.`);
          setToArchive(null);
          setArchiveError(null);
        },
        onError: (failure) => {
          const { message } = splitServerError(failure);
          setArchiveError(message ?? "Le document n’a pas pu être archivé.");
          notify.error("Archivage impossible", message ?? undefined);
        },
      },
    );
  };

  return (
    <PageFrame
      crumbs={[{ label: "Suivi" }, { label: "Documents" }]}
      title="Documents"
      description="Chaque document est rattaché à un mandant, un bien ou à l’agence, avec son partage."
      actions={
        <LinkButton href="/documents/ajout" variant="primary">
          <Icon icon={Upload} />
          Ajouter un document
        </LinkButton>
      }
    >
      <SectionCard title="Liste des documents">
        <Tabs
          value={tab}
          defaultValue="actifs"
          onValueChange={(next) => {
            setTab(next === "archives" ? "archives" : "actifs");
          }}
        >
          <TabList aria-label="Documents actifs et archivés">
            <Tab value="actifs" count={active.length}>
              Actifs
            </Tab>
            <Tab value="archives" count={archived.length}>
              Archives
            </Tab>
          </TabList>
          <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <SearchField
                label="Rechercher un document"
                placeholder="Nom du fichier"
                className="w-full sm:w-64"
                value={filters.search}
                onChange={(event) => {
                  setFilters({ ...filters, search: event.target.value });
                }}
              />
              <Select
                label="Rattaché à"
                placeholder="Tous"
                className="w-full sm:w-52"
                value={filters.owner}
                options={[{ value: "tous", label: "Tous" }, ...OWNER_OPTIONS]}
                onValueChange={(owner) => {
                  setFilters({ ...filters, owner });
                }}
              />
              <Select
                label="Catégorie"
                placeholder="Toutes"
                className="w-full sm:w-44"
                value={filters.category}
                options={[{ value: "toutes", label: "Toutes" }, ...CATEGORIES.map((category) => ({ value: category, label: category }))]}
                onValueChange={(category) => {
                  setFilters({ ...filters, category });
                }}
              />
              <Chip
                pressed={filters.mandant}
                onClick={() => {
                  setFilters({ ...filters, mandant: !filters.mandant });
                }}
              >
                Partagé avec le mandant
              </Chip>
              <Chip
                pressed={filters.internal}
                onClick={() => {
                  setFilters({ ...filters, internal: !filters.internal });
                }}
              >
                Interne
              </Chip>
            </div>
            <DocumentList
              key={filterKey}
              rows={rows}
              filtered={filtered}
              tab={tab}
              onOpen={setOpenId}
              onReset={() => {
                setFilters(NO_FILTERS);
              }}
            />
          </TabPanel>
        </Tabs>
      </SectionCard>
      <DocumentDialog
        document={opened}
        onClose={() => {
          setOpenId(null);
        }}
        onArchive={(document) => {
          setOpenId(null);
          setArchiveError(null);
          setToArchive(document);
        }}
      />
      <ConfirmDialog
        open={toArchive !== null}
        onOpenChange={(open) => {
          if (!open) setToArchive(null);
        }}
        title="Archiver ce document ?"
        description={
          <>
            « {toArchive?.displayName} » quitte la liste des documents actifs. Il reste consultable dans l’onglet Archives et peut être désarchivé.
            {archiveError ? ` ${archiveError}` : ""}
          </>
        }
        confirmLabel="Archiver"
        loading={archive.isPending}
        onConfirm={confirmArchive}
      />
    </PageFrame>
  );
}

function DocumentList({
  rows,
  filtered,
  tab,
  onOpen,
  onReset,
}: {
  rows: readonly DocumentRecord[];
  filtered: boolean;
  tab: TabValue;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  const paged = usePagination(rows, PAGE_SIZE);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DataTable<DocumentRecord>
        caption={tab === "actifs" ? "Documents actifs" : "Documents archivés"}
        rows={paged.slice}
        getRowId={(document) => document.id}
        empty={
          <EmptyState
            icon={FileSearch}
            title={filtered ? "Aucun document ne correspond" : tab === "actifs" ? "Aucun document actif" : "Aucun document archivé"}
            description={filtered ? "Modifiez la recherche ou les filtres." : "Les documents déposés apparaissent ici."}
          >
            {filtered ? (
              <Button variant="secondary" onClick={onReset}>
                Réinitialiser les filtres
              </Button>
            ) : null}
          </EmptyState>
        }
        columns={[
          {
            id: "file",
            header: "Fichier",
            role: "title",
            cell: (document) => (
              <span className="flex min-w-0 flex-col">
                <span className="text-body-strong break-words">{document.displayName}</span>
                {document.displayName === document.fileName ? null : (
                  <span className="text-caption font-normal break-words text-fg-subtle">{document.fileName}</span>
                )}
              </span>
            ),
          },
          { id: "attachment", header: "Rattaché à", cell: (document) => attachmentLabel(document) },
          { id: "category", header: "Catégorie", cell: (document) => document.category },
          {
            id: "sharing",
            header: "Partage",
            role: "status",
            cell: (document) => {
              const pill = sharingPill(document);
              return <Badge tone={pill.tone}>{pill.label}</Badge>;
            },
          },
          { id: "size", header: "Taille", numeric: true, cell: (document) => formatFileSize(document.sizeBytes) },
          { id: "date", header: "Date", cell: (document) => formatDate(document.date) },
          {
            id: "action",
            header: "Action",
            role: "action",
            hideHeader: true,
            cell: (document) => (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Ouvrir ${document.displayName}`}
                onClick={() => {
                  onOpen(document.id);
                }}
              >
                Ouvrir
              </Button>
            ),
          },
        ]}
      />
      {rows.length > 0 ? (
        <Pagination
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          onPageChange={paged.setPage}
          label="Pagination des documents"
        />
      ) : null}
    </div>
  );
}
