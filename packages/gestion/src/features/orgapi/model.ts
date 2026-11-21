export type OrgRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type OrgKind = 'agency' | 'individual';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PropertyChoice {
  id: string;
  name: string;
}

export interface UnitChoice {
  id: string;
  reference: string;
}

export interface LeaseChoice {
  id: string;
  reference: string;
  tenantNames: string[];
  unitReference: string | null;
  propertyName: string | null;
}

export interface PartyChoice {
  id: string;
  name: string;
  archived: boolean;
}

export interface MemberChoice {
  userId: string;
  name: string;
  self: boolean;
}

export interface OrgMembers {
  choices: MemberChoice[];
  complete: boolean;
}

export interface OrgCurrentUser {
  id: string;
  name: string;
}

export const ACCESS_LEVELS = ['none', 'read', 'prepare', 'write', 'write_two_factor'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export interface RoleDomainLevels {
  key: string;
  levels: Record<OrgRole, AccessLevel>;
  twoFactor: boolean;
}

export interface RoleMatrix {
  currentRole: OrgRole;
  domains: RoleDomainLevels[];
}
