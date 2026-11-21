import { Badge } from '@eguardimmo/ui';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import type { PlanEntitlement, PlanVersion } from '@/platform/plans/plans';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { Section } from '@/ui/Section';
import { GROUP_LABELS, GROUP_ORDER, VERSION_STATUS_LABELS, VERSION_STATUS_TONES } from './labels';
import { formatMinor } from './money';

const entitlementColumns: Column<PlanEntitlement>[] = [
  { id: 'feature', header: 'Droit', primary: true, cell: (row) => <span>{row.label}</span> },
  { id: 'group', header: 'Groupe', cell: (row) => GROUP_LABELS[row.group] ?? row.group },
  { id: 'kind', header: 'Type', cell: (row) => (row.kind === 'quota' ? 'Quota' : 'Fonction') },
  { id: 'enabled', header: 'Inclus', cell: (row) => <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? 'Oui' : 'Non'}</Badge> },
  {
    id: 'limit',
    header: 'Limite',
    cell: (row) => (row.kind === 'quota' ? (row.limit === null ? 'Illimité' : <span className="tabular-nums">{row.limit}</span>) : '—'),
  },
];

export function sortedEntitlements(version: PlanVersion): PlanEntitlement[] {
  const rank = (group: string) => {
    const index = GROUP_ORDER.findIndex((candidate) => candidate === group);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...version.entitlements].sort((a, b) => rank(a.group) - rank(b.group) || a.label.localeCompare(b.label, 'fr'));
}

export function VersionView({ version }: { version: PlanVersion }) {
  return (
    <div className="flex flex-col gap-3">
      <Section id={`version-${version.id}-summary`} title={`Version ${String(version.version)}`} aside={<Badge tone={VERSION_STATUS_TONES[version.status]}>{VERSION_STATUS_LABELS[version.status]}</Badge>}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-body sm:grid-cols-2">
          <div>
            <dt className="text-caption text-fg-subtle">Essai</dt>
            <dd>{version.trialDays} jours (fixé par la grille)</dd>
          </div>
          <div>
            <dt className="text-caption text-fg-subtle">Inscription publique</dt>
            <dd>{version.publicSignup ? 'Oui' : 'Non'}</dd>
          </div>
          <div>
            <dt className="text-caption text-fg-subtle">Publiée le</dt>
            <dd>{version.publishedAt ? formatDate(version.publishedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-caption text-fg-subtle">Archivée le</dt>
            <dd>{version.archivedAt ? formatDate(version.archivedAt) : '—'}</dd>
          </div>
          {version.prices.length === 0 ? (
            <div>
              <dt className="text-caption text-fg-subtle">Prix</dt>
              <dd>Aucun prix renseigné</dd>
            </div>
          ) : (
            version.prices.map((price) => (
              <div key={price.currency}>
                <dt className="text-caption text-fg-subtle">{`Prix en ${price.currency}`}</dt>
                <dd className="tabular-nums">{`${formatMinor(price.monthlyAmount, price.currency)} / mois · ${formatMinor(price.yearlyAmount, price.currency)} / an`}</dd>
              </div>
            ))
          )}
        </dl>
      </Section>
      <Section id={`version-${version.id}-rights`} title="Droits de la version">
        <DataTable label={`Droits de la version ${String(version.version)}`} columns={entitlementColumns} rows={sortedEntitlements(version)} rowKey={(row) => row.feature} Link={Link} />
      </Section>
    </div>
  );
}
