import type { TenantAccess, TenantChoice } from '../model';
import type { ApiPartySummary, ApiTenantAccess } from './accessSchemas';

export const toTenantAccess = (api: ApiTenantAccess): TenantAccess => ({
  partyId: api.party_id,
  status: api.status,
  emailHint: api.email_hint,
  expiresAt: api.expires_at,
  linkedAt: api.linked_at,
});

export const toTenantChoice = (api: ApiPartySummary): TenantChoice => ({ id: api.id, name: api.display_name, email: api.primary_email });
