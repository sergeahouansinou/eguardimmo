import { MB } from "@/features/shared/files";
import type { FileRules } from "@/features/shared/files";

export const MANDATE_FILE_RULES: FileRules = {
  maxBytes: 10 * MB,
  extensions: ["pdf", "jpg", "jpeg", "png", "webp"],
  mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
};

export const DOCUMENT_KIND_LABELS = { mandate: "Mandat", amendment: "Avenant signé", diagnostic: "Diagnostic", insurance: "Assurance", other: "Autre document" } as const;
