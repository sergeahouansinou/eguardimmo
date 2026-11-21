import { ORG } from "@/features/loyers/testing";

export { ORG, stubApi } from "@/features/loyers/testing";

export const CERTIFICATE = "01a1e9ab-9be5-7020-a050-08d26f2db94d";
export const STORED_FILE = "01a1e9ab-9bdf-7132-b1c7-7bc12bcead09";

export const documentsUrl = (path: string) => `/api/v1/org/${ORG}/documents${path}`;
export const termsUrl = `/api/v1/org/${ORG}/catalog/vocabularies/certificate_type/terms`;

const certificate = {
  id: CERTIFICATE,
  subject: { type: "organization", id: ORG },
  type: { id: "01a1e9ab-9b9e-7301-8a1b-10b4a0711928", key: "energy_performance", label: "Diagnostic de performance énergétique (DPE)", semantic_key: "energy_performance" },
  reference: "DPE-2026-001",
  issuer_party_id: null,
  issued_on: "2026-01-10",
  expires_on: "2036-01-10",
  state: "valid",
  values: { energy_class: "C" },
  stored_file_id: STORED_FILE,
  replaces_id: null,
  replaced_by_id: null,
};

const links = { first: null, last: null, prev: null, next: null };

export const conformiteRoutes: Record<string, unknown> = {
  [documentsUrl("/certificates")]: { data: [certificate], links, meta: { per_page: 25, next_cursor: null, prev_cursor: null } },
  [documentsUrl(`/certificates/${CERTIFICATE}`)]: { data: certificate },
  [termsUrl]: {
    data: [
      {
        id: "01a1e9ab-9b9e-7301-8a1b-10b4a0711928",
        vocabulary: "certificate_type",
        key: "energy_performance",
        labels: { fr: "Diagnostic de performance énergétique (DPE)" },
        semantic_key: "energy_performance",
        parent_id: null,
        position: 0,
        metadata: {
          default_validity_months: 120,
          reminder_days: 90,
          data_schema: { energy_class: { type: "string", required: true, enum: ["A", "B", "C", "D", "E", "F", "G"] } },
        },
        platform: true,
        system: true,
        archived: false,
        hidden: false,
        overridden: false,
      },
    ],
  },
};
