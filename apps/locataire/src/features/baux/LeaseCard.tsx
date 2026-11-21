import { Button, Card, CardTitle, Icon } from '@eguardimmo/ui';
import { Building2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { NOT_AVAILABLE } from '@/tenant/format';
import { PHASE_VIEW, regimeLabel, unitDisplayName } from '@/tenant/labels';
import type { LeaseSummary } from '@/tenant/model';

export function leasePeriod(lease: Pick<LeaseSummary, 'startsOn' | 'endsOn'>): string {
  return lease.endsOn === null
    ? `Depuis le ${formatDate(lease.startsOn)}, sans date de fin`
    : `Du ${formatDate(lease.startsOn)} au ${formatDate(lease.endsOn)}`;
}

export function GraceBadge({ lease }: { lease: Pick<LeaseSummary, 'inGrace' | 'accessUntil'> }) {
  if (!lease.inGrace) return null;
  return <StatusBadge tone="warning">{lease.accessUntil === null ? 'Période de grâce' : `Accès jusqu’au ${formatDate(lease.accessUntil)}`}</StatusBadge>;
}

export function LeaseCard({ lease }: { lease: LeaseSummary }) {
  const phase = PHASE_VIEW[lease.phase];
  const unit = lease.mainUnit;
  return (
    <li>
      <Card className="gap-3 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle as="h2" className="break-words">{lease.reference}</CardTitle>
            <p className="flex items-center gap-1.5 text-body text-fg-muted">
              <Icon icon={Building2} size={14} />
              <span className="min-w-0 break-words">{lease.organization.name ?? NOT_AVAILABLE}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
            <GraceBadge lease={lease} />
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-body sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-caption text-fg-subtle">Logement</dt>
            <dd className="flex items-start gap-1.5 break-words">
              <Icon icon={MapPin} size={14} className="mt-1 shrink-0" />
              <span className="min-w-0">{unit === null ? NOT_AVAILABLE : `${unitDisplayName(unit)} · ${unit.address}`}</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-caption text-fg-subtle">Période</dt>
            <dd className="break-words">{leasePeriod(lease)}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-caption text-fg-subtle">Régime</dt>
            <dd className="break-words">{regimeLabel(lease.regimeKey)}</dd>
          </div>
        </dl>
        <div>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/bail/${lease.id}`}>Voir le bail {lease.reference}</Link>
          </Button>
        </div>
      </Card>
    </li>
  );
}
