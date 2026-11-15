"use client";

import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import type { FileMeta } from "@/features/kit/serverValidation";
import { documentSchema, documentsSchema } from "./schemas";

export function useDocuments() {
  return useAgenceQuery(agenceKey("documents"), documentsSchema, (source) => source.documents.list());
}

export interface AddDocumentPayload {
  file: FileMeta;
  ownerId: string;
  lotId: string | null;
  category: string;
  displayName: string;
  validUntil: string | null;
  description: string;
  sharedWithMandant: boolean;
  sharedWithTenant: boolean;
}

export function useAddDocument() {
  return useAgenceMutation(async (source, input: AddDocumentPayload) => documentSchema.parse(await source.documents.add(input)));
}

export function useArchiveDocument() {
  return useAgenceMutation(async (source, input: { id: string; archived: boolean }) =>
    documentSchema.parse(await source.documents.setArchived(input.id, { archived: input.archived })),
  );
}

export function useUpdateSharing() {
  return useAgenceMutation(async (source, input: { id: string; sharedWithMandant: boolean; sharedWithTenant: boolean }) =>
    documentSchema.parse(
      await source.documents.updateSharing(input.id, { sharedWithMandant: input.sharedWithMandant, sharedWithTenant: input.sharedWithTenant }),
    ),
  );
}
