export const PAYOUT_REQUEST_STATUSES = ["awaiting_code", "pending", "approved", "rejected", "withdrawn", "expired"] as const;

export interface PayoutRequest {
  id: string;
  accessId: string;
  status: string;
  bankLast4: string | null;
  holderName: string | null;
  requestedAt: string | null;
  codeExpiresAt: string | null;
  decidedAt: string | null;
}

export interface PayoutAccount {
  accessId: string;
  agencyId: string;
  agencyName: string | null;
  mandantName: string;
  role: string;
  canRequest: boolean;
  current: { bankLast4: string; activeSince: string } | null;
  coolingUntil: string | null;
  contested: boolean;
  request: PayoutRequest | null;
}

export interface NewPayoutRequest {
  accessId: string;
  iban: string;
  bic: string | null;
  holderName: string;
  proof: File;
}
