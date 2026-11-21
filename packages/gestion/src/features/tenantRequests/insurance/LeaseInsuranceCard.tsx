'use client';

import { Badge, Button, Icon } from '@eguardimmo/ui';
import { BellRing } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { canManage, useTenantRequestsPermissions } from '../shared/access';
import { useLeaseLabels } from '../shared/hooks';
import { QueryState } from '../shared/parts/QueryState';
import { RemindConfirm } from './RemindConfirm';
import { useLeaseInsurance } from './hooks';
import { coverageBadge, insuranceStatusBadge, rejectionReasonLabel } from './model';

export function LeaseInsuranceCard({ leaseId }: { leaseId: string }) {
  const permissions = useTenantRequestsPermissions();
  if (!canManage(permissions)) return null;
  return <LeaseInsuranceContent leaseId={leaseId} />;
}

function LeaseInsuranceContent({ leaseId }: { leaseId: string }) {
  const overview = useLeaseInsurance(leaseId);
  const labels = useLeaseLabels([leaseId]);
  const [reminding, setReminding] = useState(false);

  return (
    <SectionCard
      id="lease-insurance"
      title="Assurance habitation"
      aside={
        <Button variant="secondary" size="sm" onClick={() => { setReminding(true); }}>
          <Icon icon={BellRing} />
          Relancer les locataires
        </Button>
      }
    >
      {overview.data === undefined ? (
        <QueryState query={overview} label="Chargement de l’assurance" title="Impossible de charger l’assurance du bail" />
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-body">
            <Badge tone={coverageBadge[overview.data.coverage.state].tone}>{coverageBadge[overview.data.coverage.state].label}</Badge>
            {overview.data.coverage.endsOn === null ? null : <span className="text-fg-muted">{`jusqu’au ${formatDateFr(overview.data.coverage.endsOn)}`}</span>}
          </p>
          {overview.data.submissions.length === 0 ? (
            <p className="text-body text-fg-subtle">Aucune attestation déposée pour ce bail.</p>
          ) : (
            <ul aria-label="Dépôts d’attestation du bail" className="flex flex-col">
              {overview.data.submissions.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                  <span className="flex min-w-0 flex-col text-body">
                    <b className="truncate font-medium text-fg">{labels.tenantOf(leaseId, item.partyId)}</b>
                    <span className="text-caption text-fg-subtle">{`${item.insurer}, du ${formatDateFr(item.startsOn)} au ${formatDateFr(item.endsOn)}`}</span>
                    {item.rejectionReason === null ? null : <span className="text-caption text-fg-subtle">{rejectionReasonLabel[item.rejectionReason]}</span>}
                  </span>
                  <Badge tone={insuranceStatusBadge[item.status].tone}>{insuranceStatusBadge[item.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <RemindConfirm leaseId={leaseId} open={reminding} onClose={() => { setReminding(false); }} />
    </SectionCard>
  );
}
