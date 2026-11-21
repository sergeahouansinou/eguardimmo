import { z } from "zod";

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });

export const MANDATE_DOCUMENT_KINDS = ["mandate", "amendment", "diagnostic", "insurance", "other"] as const;
export type MandateDocumentKind = (typeof MANDATE_DOCUMENT_KINDS)[number];

export const SHAREABLE_KINDS = ["mandate", "diagnostic", "insurance", "other"] as const;
export type ShareableKind = (typeof SHAREABLE_KINDS)[number];

export const apiMandateDocumentSchema = z.object({
  id,
  mandate_id: id,
  stored_file_id: id,
  kind: z.enum(MANDATE_DOCUMENT_KINDS),
  uploaded_by_kind: z.enum(["agency", "owner"]),
  shared_by_user_id: id.nullable(),
  shared_at: timestamp.nullable(),
  revoked_at: timestamp.nullable(),
});
export type ApiMandateDocument = z.infer<typeof apiMandateDocumentSchema>;

export const apiMandateDocumentPageSchema = z.object({
  data: z.array(apiMandateDocumentSchema),
  meta: z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() }),
});
export const apiMandateDocumentResponseSchema = z.object({ data: apiMandateDocumentSchema });

export const apiStoredFileResponseSchema = z.object({ data: z.object({ id, name: z.string(), mime_type: z.string(), size_bytes: z.number().int().nonnegative() }) });

export interface MandatDocument {
  id: string;
  mandateId: string;
  storedFileId: string;
  kind: MandateDocumentKind;
  uploadedBy: "agency" | "owner";
  sharedAtIso: string | null;
  revokedAtIso: string | null;
}

export const toMandatDocument = (api: ApiMandateDocument): MandatDocument => ({
  id: api.id,
  mandateId: api.mandate_id,
  storedFileId: api.stored_file_id,
  kind: api.kind,
  uploadedBy: api.uploaded_by_kind,
  sharedAtIso: api.shared_at,
  revokedAtIso: api.revoked_at,
});

export const shareDocumentPayload = (storedFileId: string, kind: ShareableKind): Record<string, unknown> => ({ stored_file_id: storedFileId, kind });

export function mandateFileForm(file: File, mandateId: string): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("category", "supporting");
  form.append("subject_type", "mandate");
  form.append("subject_id", mandateId);
  return form;
}
