import type { AgencyRef } from "../shared/model";

export interface OwnerDocument {
  id: string;
  kind: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sharedAt: string | null;
  uploadedBy: string;
  mandateReference: string | null;
  agency: AgencyRef;
  mandantName: string | null;
}
