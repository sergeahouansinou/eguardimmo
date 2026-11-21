import { AGENCY_A, MANDANT_A } from "../shared/fixtures";

export const DOCUMENT_ID = "0193a5e1-0000-7000-8000-000000000101";
export const PHOTO_ID = "0193a5e1-0000-7000-8000-000000000102";
export const BARE_ID = "0193a5e1-0000-7000-8000-000000000103";

const base = { shared_at: "2026-11-03T09:00:00+00:00", uploaded_by: "agency", mandate: { reference: "MD-2025-014" }, agency: AGENCY_A, mandant: MANDANT_A };

export const MANDATE_DOCUMENT = { ...base, id: DOCUMENT_ID, kind: "mandate", name: "Mandat de gestion signé", mime_type: "application/pdf", size_bytes: 482304 };
export const PHOTO_DOCUMENT = { ...base, id: PHOTO_ID, kind: "diagnostic", name: "Diagnostic électrique", mime_type: "image/jpeg", size_bytes: 900 };
export const BARE_DOCUMENT = { ...base, id: BARE_ID, kind: "other", name: null, mime_type: null, size_bytes: null, shared_at: null, uploaded_by: "owner", mandate: { reference: null } };
