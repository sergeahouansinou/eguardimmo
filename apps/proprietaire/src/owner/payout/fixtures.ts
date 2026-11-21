import { ACCESS_ID, AGENCY_ID } from "../responses.fixtures";

export const REQUEST_ID = "0193a5e1-0000-7000-8000-0000000000c1";
export const TEST_IBAN = "FR76 3000 6000 0112 3456 7890 189";

export const PAYOUT_REQUEST = {
  id: REQUEST_ID,
  access_id: ACCESS_ID,
  status: "awaiting_code",
  bank_last4: "7001",
  holder_name: "Famille Dossou",
  requested_at: "2026-11-19T09:00:00+00:00",
  code_expires_at: "2026-11-19T09:15:00+00:00",
  decided_at: null,
};

export const PAYOUT_ACCOUNT = {
  access_id: ACCESS_ID,
  agency_id: AGENCY_ID,
  agency_name: "Agence du Lac",
  mandant_name: "Famille Dossou",
  role: "holder",
  can_request: true,
  current: { bank_last4: "1234", active_since: "2026-09-01" },
  cooling_until: null,
  contested: false,
  request: null,
};

export const withRequest = (patch: Record<string, unknown>) => ({ ...PAYOUT_ACCOUNT, request: { ...PAYOUT_REQUEST, ...patch } });
