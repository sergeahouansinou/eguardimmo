export const ACCESS_ID = "0193a5e1-0000-7000-8000-0000000000a1";
export const SECOND_ACCESS_ID = "0193a5e1-0000-7000-8000-0000000000a2";
export const AGENCY_ID = "0193a5e1-0000-7000-8000-0000000000b1";
export const SECOND_AGENCY_ID = "0193a5e1-0000-7000-8000-0000000000b2";

export const ACCESS_ENTRY = {
  access_id: ACCESS_ID,
  role: "holder",
  agency: { id: AGENCY_ID, name: "Agence du Lac" },
  mandant: { name: "Famille Dossou" },
  access_until: null,
  in_grace: false,
  read_only: false,
};

export const SECOND_ACCESS_ENTRY = {
  access_id: SECOND_ACCESS_ID,
  role: "representative",
  agency: { id: SECOND_AGENCY_ID, name: "Cabinet Horizon" },
  mandant: { name: "SCI Les Palmiers" },
  access_until: null,
  in_grace: false,
  read_only: false,
};

export const AGENCIES_RESPONSE = { data: [ACCESS_ENTRY] };

export const LINKS_RESPONSE = {
  data: [
    { id: ACCESS_ID, role: "holder", organization: { id: AGENCY_ID, name: "Agence du Lac" }, mandant: { name: "Famille Dossou" }, linked_at: "2026-10-02T09:30:00+00:00" },
    {
      id: SECOND_ACCESS_ID,
      role: "representative",
      organization: { id: SECOND_AGENCY_ID, name: "Cabinet Horizon" },
      mandant: { name: "SCI Les Palmiers" },
      linked_at: "2026-10-15T14:00:00+00:00",
    },
  ],
};

export const ME_RESPONSE = { data: { name: "Aline Dossou", email: "aline@example.test" } };

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { status, body: { type: "about:blank", title: code, status, code, ...extra } };
}
