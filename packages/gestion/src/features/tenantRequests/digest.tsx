'use client';

import { BadgeCheck, CalendarX2 } from 'lucide-react';
import { ItemRow, SectionCard, useGestionNavigation } from '../locataires/kit';
import { useGestionDataMode } from '../locataires/kit/sourceContext';
import { useInsuranceSubmissions } from './insurance/hooks';
import { useNoticeRequests } from './notices/hooks';
import { isLate } from './notices/model';
import { useTenantRequestsPermissions } from './shared/access';
import { tenantRequestsPaths } from './shared/paths';

export function TenantRequestsDigest() {
  return useGestionDataMode() === 'api' ? <DigestGate /> : null;
}

function DigestGate() {
  const permissions = useTenantRequestsPermissions();
  return permissions.manage ? <DigestContent /> : null;
}

const plural = (count: number, one: string, many: string): string => `${String(count)} ${count > 1 ? many : one}`;

function DigestContent() {
  const { Link } = useGestionNavigation();
  const notices = useNoticeRequests({ cursor: null, status: 'submitted', leaseId: null });
  const insurance = useInsuranceSubmissions({ cursor: null, status: 'pending' });
  const waiting = notices.data?.items ?? [];
  const pending = insurance.data?.items ?? [];
  if (waiting.length === 0 && pending.length === 0) return null;
  const late = waiting.filter(isLate).length;

  return (
    <SectionCard id="demandes-locataires" title="Demandes des locataires à traiter">
      <ul>
        {waiting.length === 0 ? null : (
          <ItemRow
            icon={CalendarX2}
            tone={late > 0 ? 'danger' : 'warning'}
            title={<Link href={tenantRequestsPaths.notices} className="underline-offset-2 hover:underline">{plural(waiting.length, 'demande de congé sans accusé de réception', 'demandes de congé sans accusé de réception')}</Link>}
            detail={late > 0 ? `${plural(late, 'est', 'sont')} en retard` : 'Dans le délai'}
          />
        )}
        {pending.length === 0 ? null : (
          <ItemRow
            icon={BadgeCheck}
            tone="warning"
            title={<Link href={tenantRequestsPaths.insurance} className="underline-offset-2 hover:underline">{plural(pending.length, 'attestation d’assurance à examiner', 'attestations d’assurance à examiner')}</Link>}
            detail="Acceptez ou refusez chaque dépôt"
          />
        )}
      </ul>
    </SectionCard>
  );
}
