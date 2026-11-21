'use client';

import { Alert } from '@eguardimmo/ui';
import { CalendarX2, ClipboardCheck, CreditCard } from 'lucide-react';
import { LinkButton, SectionCard } from '../locataires/kit';
import { useGestionDataMode } from '../locataires/kit/sourceContext';
import { ContactUpdatesCard } from './contactUpdates';
import { LeaseInsuranceCard } from './insurance';
import { useNoticeRequests } from './notices/hooks';
import { useTenantRequestsPermissions } from './shared/access';
import { tenantRequestsPaths } from './shared/paths';

export function LeaseTenantRequests({ leaseId }: { leaseId: string }) {
  return useGestionDataMode() === 'api' ? <LeaseTenantRequestsContent leaseId={leaseId} /> : null;
}

function LeaseTenantRequestsContent({ leaseId }: { leaseId: string }) {
  const permissions = useTenantRequestsPermissions();
  if (!permissions.available) return null;
  return (
    <>
      {permissions.manage ? <PendingNotices leaseId={leaseId} /> : null}
      <LeaseInsuranceCard leaseId={leaseId} />
      <SectionCard id="lease-tenant-requests" title="Demandes et suivi du locataire">
        <div className="flex flex-wrap gap-2">
          {permissions.manage ? <LinkButton href={`${tenantRequestsPaths.notices}?bail=${encodeURIComponent(leaseId)}`} size="sm" icon={CalendarX2}>Demandes de congé</LinkButton> : null}
          {permissions.manage ? <LinkButton href={tenantRequestsPaths.inspectionsOf(leaseId)} size="sm" icon={ClipboardCheck}>États des lieux</LinkButton> : null}
          {permissions.readPayments ? <LinkButton href={`${tenantRequestsPaths.onlinePayments}?bail=${encodeURIComponent(leaseId)}`} size="sm" icon={CreditCard}>Paiements en ligne</LinkButton> : null}
        </div>
      </SectionCard>
    </>
  );
}

function PendingNotices({ leaseId }: { leaseId: string }) {
  const notices = useNoticeRequests({ cursor: null, status: 'submitted', leaseId });
  const count = notices.data?.items.length ?? 0;
  if (count === 0) return null;
  return (
    <Alert tone="warning" title={`${String(count)} demande${count > 1 ? 's' : ''} de congé sans accusé de réception sur ce bail`}>
      <div className="mt-1">
        <LinkButton href={`${tenantRequestsPaths.notices}?bail=${encodeURIComponent(leaseId)}`} size="sm">Traiter les demandes</LinkButton>
      </div>
    </Alert>
  );
}

export function TenantContactUpdates({ partyId }: { partyId: string }) {
  return useGestionDataMode() === 'api' ? <ContactUpdatesCard partyId={partyId} /> : null;
}
