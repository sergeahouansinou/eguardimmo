import { checkFileOrThrow, parseOrThrow, respond, sanitizeFileName } from "@/features/kit/serverValidation";
import { DEMO_TODAY } from "@/features/shared/dates";
import { LOTS, MANDANTS } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import { DOCUMENT_RULES } from "@/features/shared/files";
import { createStore, nextId } from "@/features/shared/store";
import { initialDocuments } from "./fixtures";
import { AGENCY_OWNER, addDocumentInputSchema, archiveInputSchema, sharingInputSchema } from "./schemas";
import type { DocumentRecord } from "./schemas";
import type { DocumentsSource } from "./source";

function find(documents: readonly DocumentRecord[], id: string): DocumentRecord {
  const document = documents.find((candidate) => candidate.id === id);
  if (!document) throw new DemoServerError("not_found", "Ce document n’existe pas ou a été retiré.");
  return document;
}

function replace(documents: readonly DocumentRecord[], next: DocumentRecord): DocumentRecord[] {
  return documents.map((document) => (document.id === next.id ? next : document));
}

function assertSharing(ownerId: string, lotId: string | null, mandant: boolean, tenant: boolean): void {
  if (mandant && ownerId === AGENCY_OWNER) {
    throw new DemoServerError("invalid_sharing", "Un document de l’agence ne peut pas être partagé avec un mandant.", {
      sharedWithMandant: "Rattachez le document à un mandant pour le partager avec lui.",
    });
  }
  if (tenant && lotId === null) {
    throw new DemoServerError("invalid_sharing", "Un document sans bien ne peut pas être partagé avec un locataire.", {
      sharedWithTenant: "Rattachez le document à un bien pour le partager avec le locataire.",
    });
  }
}

export function createDocumentsDemo(): DocumentsSource {
  const store = createStore<DocumentRecord[]>(initialDocuments());

  return {
    list: () => Promise.resolve({ documents: store.get() }),

    add: (input) => respond(() => {
      const value = parseOrThrow(addDocumentInputSchema, input);
      checkFileOrThrow(value.file, DOCUMENT_RULES);
      if (value.ownerId !== AGENCY_OWNER && !MANDANTS.some((mandant) => mandant.id === value.ownerId)) {
        throw new DemoServerError("invalid_owner", "Ce rattachement n’existe pas.", { ownerId: "Ce rattachement n’existe pas." });
      }
      const lot = value.lotId === null ? undefined : LOTS.find((candidate) => candidate.id === value.lotId);
      if (value.lotId !== null && lot?.mandantId !== value.ownerId) {
        throw new DemoServerError("invalid_lot", "Ce bien n’appartient pas au mandant choisi.", { lotId: "Ce bien n’appartient pas au mandant choisi." });
      }
      assertSharing(value.ownerId, value.lotId, value.sharedWithMandant, value.sharedWithTenant);
      const fileName = sanitizeFileName(value.file.name);
      const created: DocumentRecord = {
        id: nextId("doc", store.get().map((document) => document.id)),
        fileName,
        displayName: value.displayName === "" ? fileName : value.displayName,
        ownerId: value.ownerId,
        lotId: value.lotId,
        tenantId: lot?.tenantId ?? null,
        category: value.category,
        sharedWithMandant: value.sharedWithMandant,
        sharedWithTenant: value.sharedWithTenant,
        sizeBytes: value.file.size,
        date: DEMO_TODAY,
        validUntil: value.validUntil,
        description: value.description,
        archived: false,
      };
      store.update((documents) => [created, ...documents]);
      return created;
    }),

    setArchived: (id, input) => respond(() => {
      const { archived } = parseOrThrow(archiveInputSchema, input);
      const next = { ...find(store.get(), id), archived };
      store.update((documents) => replace(documents, next));
      return next;
    }),

    updateSharing: (id, input) => respond(() => {
      const value = parseOrThrow(sharingInputSchema, input);
      const current = find(store.get(), id);
      assertSharing(current.ownerId, current.lotId, value.sharedWithMandant, value.sharedWithTenant);
      const next = { ...current, ...value };
      store.update((documents) => replace(documents, next));
      return next;
    }),
  };
}
