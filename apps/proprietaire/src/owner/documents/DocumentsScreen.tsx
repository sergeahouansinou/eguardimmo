"use client";

import { Folder } from "lucide-react";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyAndMandant, formatFileSize, formatOptionalDay, labelOf } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { DownloadAction } from "../shared/DownloadAction";
import { downloadName } from "../shared/download";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { DOCUMENT_KIND, UPLOADED_BY } from "./labels";
import type { OwnerDocument } from "./model";
import { useDocuments } from "./queries";
import { documentDownloadPath } from "./requests";

const title = (document: OwnerDocument): string => document.name ?? labelOf(DOCUMENT_KIND, document.kind);

const FORMATS: Readonly<Record<string, string>> = { "application/pdf": "PDF", "image/jpeg": "Image JPEG", "image/png": "Image PNG" };

const columns: readonly Column<OwnerDocument>[] = [
  { id: "document", header: "Document", primary: true, cell: title },
  { id: "nature", header: "Nature", cell: (document) => labelOf(DOCUMENT_KIND, document.kind) },
  { id: "format", header: "Format", cell: (document) => `${document.mimeType === null ? NOT_AVAILABLE : (FORMATS[document.mimeType] ?? "Fichier")} · ${formatFileSize(document.sizeBytes)}` },
  { id: "partage", header: "Partagé le", cell: (document) => formatOptionalDay(document.sharedAt) },
  { id: "auteur", header: "Ajouté par", cell: (document) => labelOf(UPLOADED_BY, document.uploadedBy) },
  { id: "mandat", header: "Mandat", cell: (document) => `${document.mandateReference ?? NOT_AVAILABLE} · ${agencyAndMandant(document.agency.name, document.mandantName)}` },
  {
    id: "telecharger",
    header: "Télécharger",
    action: true,
    cell: (document) => (
      <DownloadAction
        path={documentDownloadPath(document.id)}
        filename={downloadName(title(document), document.mimeType)}
        format="any"
        label="Télécharger"
        ariaLabel={`Télécharger ${title(document)}`}
        variant="link"
      />
    ),
  },
];

export function DocumentsScreen() {
  const filter = useAgencyFilter();
  const list = useDocuments(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Documents" subtitle="Les pièces que votre agence partage avec vous" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement de vos documents"
          failureTitle="Vos documents n’ont pas pu être chargés"
          empty={{ icon: Folder, title: "Aucun document partagé", description: "Votre agence n’a encore partagé aucune pièce pour cette sélection." }}
        >
          {(documents) => (
            <Section title="Documents partagés">
              <DataTable caption="Documents partagés par votre agence" columns={columns} rows={documents.map((document) => ({ key: document.id, value: document }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
