export const OWNER_ROLES = ["holder", "representative", "co_owner"] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export interface OwnerAccess {
  accessId: string;
  role: OwnerRole;
  agencyId: string;
  agencyName: string | null;
  mandantName: string;
  accessUntil: string | null;
  inGrace: boolean;
  readOnly: boolean;
}

export interface OwnerLink {
  id: string;
  role: OwnerRole;
  agencyId: string;
  agencyName: string | null;
  mandantName: string;
  linkedAt: string;
}
