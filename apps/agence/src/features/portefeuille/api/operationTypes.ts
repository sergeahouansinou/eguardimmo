import type { MandatDocument, ShareableKind } from "./apiDocuments";
import type { TermDefaults, TermDefaultsInput } from "./apiDefaults";

export interface MandatDocumentOperations {
  list: (mandatId: string) => Promise<MandatDocument[]>;
  upload: (mandatId: string, file: File) => Promise<string>;
  share: (mandatId: string, storedFileId: string, kind: ShareableKind) => Promise<MandatDocument>;
  unshare: (mandatId: string, documentId: string) => Promise<MandatDocument>;
}

export interface TermDefaultsOperations {
  canSave: boolean;
  load: () => Promise<TermDefaults | null>;
  save: (lockVersion: number | null, input: TermDefaultsInput) => Promise<TermDefaults>;
}
