import type { ApiClient } from "@eguardimmo/api";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { OwnerDocument } from "./model";
import { documentPageSchema } from "./schemas";

export const DOCUMENTS_PATH = "/api/v1/owner/documents";

export const documentDownloadPath = (id: string): string => `${DOCUMENTS_PATH}/${segment(id)}/download`;

export async function fetchDocumentsPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerDocument>> {
  const page = parse(documentPageSchema, await client.get(DOCUMENTS_PATH, listQuery(agency, cursor)));
  return {
    items: page.data.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      mimeType: entry.mime_type,
      sizeBytes: entry.size_bytes,
      sharedAt: entry.shared_at,
      uploadedBy: entry.uploaded_by,
      mandateReference: entry.mandate.reference,
      agency: entry.agency,
      mandantName: entry.mandant.name,
    })),
    nextCursor: page.meta.next_cursor,
  };
}
