import { Avatar, Badge } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { initialsOf, tenantNameOf } from './schemas';
import type { Tenant, TenantState } from './schemas';

export const tenantStateBadge: Record<TenantState, { label: string; tone: BadgeTone }> = {
  retard: { label: 'Loyer en retard', tone: 'danger' },
  preavis: { label: 'Préavis donné', tone: 'warning' },
  a_jour: { label: 'À jour', tone: 'success' },
  invitation: { label: 'Invitation envoyée', tone: 'info' },
};

export function TenantStateBadge({ state }: { state: TenantState }) {
  const badge = tenantStateBadge[state];
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

export function TenantAvatar({ tenant, size = 'md' }: { tenant: Tenant; size?: 'md' | 'lg' }) {
  return <Avatar initials={initialsOf(tenantNameOf(tenant))} size={size} />;
}

export const tenantKindLabel = (kind: Tenant['kind']): string => (kind === 'societe' ? 'Société' : 'Particulier');
