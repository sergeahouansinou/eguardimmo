'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { ConfirmProof } from '../reauth/proof';
import type { LeaseChoice, OrgCurrentUser, OrgKind, OrgMembers, OrgRole, PartyChoice, PropertyChoice, RoleMatrix, UnitChoice } from './model';

export interface OrgInfoSource {
  readonly organizationId: string | null;
  readonly role: OrgRole | null;
  readonly kind: OrgKind | null;
  timezone: () => Promise<string>;
  updateTimezone: (timezone: string) => Promise<string>;
  currentUser: () => Promise<OrgCurrentUser>;
  members: () => Promise<OrgMembers>;
  roles: () => Promise<RoleMatrix>;
  properties: () => Promise<PropertyChoice[]>;
  units: (propertyId: string) => Promise<UnitChoice[]>;
  leases: () => Promise<LeaseChoice[]>;
  searchParties: (search: string) => Promise<PartyChoice[]>;
  party: (id: string) => Promise<PartyChoice>;
  confirmTwoFactor: ConfirmProof;
}

const context = createSourceContext<OrgInfoSource>('Organisation', () => {
  throw new MissingSourceError('Organisation');
});

export const OrgInfoSourceProvider = context.SourceProvider;
export const useOrgInfoSource = context.useSource;
