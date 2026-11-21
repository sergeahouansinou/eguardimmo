'use client';

import { MissingSourceError, createSourceContext } from '../kit/sourceContext';
import type { TenantAccess, TenantAccessPermissions, TenantChoice } from './model';

export interface TenantAccessSource {
  readonly permissions: TenantAccessPermissions;
  search: (term: string) => Promise<TenantChoice[]>;
  access: (partyId: string) => Promise<TenantAccess>;
  invite: (partyId: string, email: string | null) => Promise<TenantAccess>;
  revoke: (partyId: string) => Promise<void>;
}

const context = createSourceContext<TenantAccessSource>('Invitations des locataires', () => {
  throw new MissingSourceError('Invitations des locataires');
});

export const TenantAccessSourceProvider = context.SourceProvider;
export const useTenantAccessSource = context.useSource;
