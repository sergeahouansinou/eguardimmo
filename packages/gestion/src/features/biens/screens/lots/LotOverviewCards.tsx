'use client';

import { Avatar, Button } from '@eguardimmo/ui';
import { OccupationTimeline } from '../../components/OccupationTimeline';
import { EntryList, FactList, Panel } from '../../components/Panels';
import { QueryBoundary, SkeletonCard } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { formatDate } from '../../lib/dates';
import { formatNumber } from '../../lib/amount';
import { initialsOf } from '../../lib/text';
import { occupancyRate } from '../../lib/timeline';
import { occupationStats } from '../../lib/occupationStats';
import { diagnosticSummary, equipementLine, periodDetail, periodStatus } from '../../lib/summaries';
import { DIAGNOSTIC_LABELS, METER_LABELS } from '../../lib/labels';
import { biensPaths, externalPaths } from '../../paths';
import { useEquipements, useLotDiagnostics, useLotLease, useLotOccupation, useLotSuivi, useReadings } from '../../queries';
import { formatMoney } from '../../../../format/money';

export function OccupationCard({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useLotOccupation(id);
  return (
    <QueryBoundary
      query={query}
      errorTitle="Historique indisponible pour le moment"
      skeleton={<SkeletonCard label="Chargement de l’historique d’occupation" lines={5} />}
    >
      {(data) => {
        const leases = data.periods.filter((period) => period.kind === 'bail');
        const recent = [...leases].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 3);
        const earlier = leases.length - recent.length;
        const stats = occupationStats(data);
        return (
          <Panel
            title="Historique d’occupation"
            action={
              <Button variant="link" asChild>
                <Link href={biensPaths.lot(id, 'locations')}>{`Tout voir, ${String(leases.length)}`}</Link>
              </Button>
            }
          >
            {data.periods.length === 0 ? (
              <p className="text-body text-fg-muted">Aucune location enregistrée pour ce bien.</p>
            ) : (
              <>
                <p className="text-body text-fg-muted">{`${String(occupancyRate(data.periods, data.asOf))} % du temps loué depuis l’achat`}</p>
                <OccupationTimeline periods={data.periods} asOf={data.asOf} />
                <p className="text-caption text-fg-muted">
                  {[
                    `${String(stats.tenants)} locataire${stats.tenants > 1 ? 's' : ''}`,
                    stats.averageLease ? `Bail moyen ${stats.averageLease}` : null,
                    `Vacance cumulée ${stats.vacancy}`,
                  ]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </p>
                <EntryList
                  label="Derniers occupants"
                  items={recent.map((period) => ({
                    id: period.id,
                    title: period.occupant?.name ?? 'Locataire',
                    detail: periodDetail(period, data.asOf),
                    badge: periodStatus(period),
                  }))}
                />
                {earlier > 0 ? (
                  <Button variant="link" asChild>
                    <Link href={biensPaths.lot(id, 'locations')}>{`Voir les ${String(earlier)} locations précédentes`}</Link>
                  </Button>
                ) : null}
              </>
            )}
          </Panel>
        );
      }}
    </QueryBoundary>
  );
}

export function LeaseCard({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useLotLease(id);
  return (
    <QueryBoundary query={query} errorTitle="Le bail n’a pas pu être chargé" skeleton={<SkeletonCard label="Chargement du bail" lines={6} />}>
      {(lease) => (
        <Panel
          title="Bail en cours"
          action={
            lease ? (
              <Button variant="link" asChild>
                <Link href={lease.leaseHref}>Ouvrir</Link>
              </Button>
            ) : null
          }
        >
          {lease === null ? (
            <>
              <p className="text-body text-fg-muted">Ce bien n’a pas de bail en cours.</p>
              <Button variant="secondary" className="self-start" asChild>
                <Link href={externalPaths.newLease(id)}>Créer un bail</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Avatar initials={initialsOf(lease.tenant.name)} size="md" />
                <div className="min-w-0">
                  <Link href={externalPaths.tenant(lease.tenant.id)} className="block text-body font-medium text-fg hover:underline">
                    {lease.tenant.name}
                  </Link>
                  <span className="block text-caption text-fg-subtle">{lease.kind}</span>
                </div>
              </div>
              <FactList
                rows={[
                  { label: 'Période', value: `${formatDate(lease.startDate)} → ${lease.endDate ? formatDate(lease.endDate) : 'durée indéterminée'}` },
                  { label: 'Loyer hors charges', value: formatMoney(lease.rentExcl, lease.currency) },
                  { label: 'Provisions sur charges', value: formatMoney(lease.provisions, lease.currency) },
                  { label: 'Dépôt de garantie', value: formatMoney(lease.deposit, lease.currency) },
                  ...(lease.nextRevision ? [{ label: 'Prochaine révision IRL', value: formatDate(lease.nextRevision) }] : []),
                  { label: 'Solde locataire', value: formatMoney(lease.balance, lease.currency, { signed: true }), ...(lease.balance < 0 ? { badge: { label: 'Impayé', tone: 'danger' as const } } : {}) },
                ]}
              />
            </>
          )}
        </Panel>
      )}
    </QueryBoundary>
  );
}

export function DiagnosticsCard({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useLotDiagnostics(id);
  return (
    <QueryBoundary query={query} errorTitle="Les diagnostics n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des diagnostics" />}>
      {(data) => {
        const items = [...data.items].sort((a, b) => Number(a.status === 'sans_objet') - Number(b.status === 'sans_objet'));
        return (
          <Panel
            title="Diagnostics"
            action={
              <Button variant="link" asChild>
                <Link href={biensPaths.lot(id, 'diagnostics')}>{`Tout voir, ${String(items.length)}`}</Link>
              </Button>
            }
          >
            <EntryList
              label="Diagnostics du lot"
              empty="Aucun diagnostic enregistré."
              items={items.slice(0, 3).map((item) => ({
                id: item.id,
                title: item.label.replace(/ \(.*\)$/, ''),
                detail: diagnosticSummary(item),
                badge: item.status === 'valide' ? DIAGNOSTIC_LABELS.valide : { label: 'À refaire', tone: item.status === 'expire' ? 'danger' : 'warning' },
              }))}
            />
          </Panel>
        );
      }}
    </QueryBoundary>
  );
}

export function EquipementsCard({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useEquipements();
  return (
    <QueryBoundary query={query} errorTitle="Les équipements n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des équipements" />}>
      {(data) => {
        const items = data.items.filter((item) => item.lotId === id && !item.archived);
        return (
          <Panel
            title="Équipements"
            action={
              <Button variant="link" asChild>
                <Link href={biensPaths.lot(id, 'equipements')}>{`Tout voir, ${String(items.length)}`}</Link>
              </Button>
            }
          >
            <EntryList
              label="Équipements du lot"
              empty="Aucun équipement rattaché à ce bien."
              items={items.slice(0, 3).map((item) => ({ id: item.id, title: item.name, detail: equipementLine(item, data.asOf), href: biensPaths.equipement(item.id) }))}
            />
          </Panel>
        );
      }}
    </QueryBoundary>
  );
}

export function SuiviCard({ id }: { id: string }) {
  const suivi = useLotSuivi(id);
  const readings = useReadings();
  const latest = readings.data
    ? [...new Map(readings.data.items.filter((item) => item.lotId === id && !item.archived).sort((a, b) => a.date.localeCompare(b.date)).map((item) => [item.meterId, item])).values()]
    : [];
  return (
    <Panel title="Suivi">
      <QueryBoundary query={suivi} errorTitle="Le suivi n’a pas pu être chargé" skeleton={<SkeletonCard label="Chargement du suivi" lines={2} />}>
        {(data) => (
          <section aria-label="Interventions en cours">
            <h3 className="text-caption font-medium text-fg-subtle">Interventions</h3>
            <EntryList
              label="Interventions du lot"
              empty="Aucune intervention en cours."
              items={data.interventions.map((item) => ({ id: item.id, title: item.title, detail: item.detail, badge: item.status, href: externalPaths.interventions }))}
            />
          </section>
        )}
      </QueryBoundary>
      <QueryBoundary query={readings} errorTitle="Les relevés n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des relevés" lines={2} />}>
        {() => (
          <section aria-label="Derniers relevés">
            <h3 className="text-caption font-medium text-fg-subtle">Relevés</h3>
            <EntryList
              label="Derniers relevés du lot"
              empty="Aucun relevé de compteur."
              items={latest.map((item) => ({
                id: item.id,
                title: `${METER_LABELS[item.kind]}, ${formatNumber(item.index, 1)} ${item.unit}`,
                detail: `Relevé du ${formatDate(item.date)}`,
                href: biensPaths.lot(id, 'compteurs'),
              }))}
            />
          </section>
        )}
      </QueryBoundary>
    </Panel>
  );
}
