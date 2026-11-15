'use client';

import { Badge, Button, StatCard } from '@eguardimmo/ui';
import { DataTable } from '../../components/DataTable';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { RowActions } from '../../components/RowActions';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { CHARGED_LABELS } from '../../lib/labels';
import { warrantyLabel } from '../../lib/summaries';
import { biensPaths } from '../../paths';
import { useEquipements } from '../../queries';
import { formatMoney } from '../../../../format/money';

const RULES = [
  { id: 'locataire-1', title: 'Petit entretien, filtres, piles, joints', detail: 'Réparations locatives', who: 'Locataire' },
  { id: 'bailleur', title: 'Remplacement pour usure ou vétusté', detail: 'Grosses réparations', who: 'Bailleur' },
  { id: 'locataire-2', title: 'Panne causée par un mauvais usage', detail: 'Constatée par le réparateur', who: 'Locataire' },
] as const;

export function LotEquipements({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useEquipements();
  const list = useListState({ key: 'name', direction: 'asc' });
  return (
    <QueryBoundary query={query} errorTitle="Les équipements n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des équipements" />}>
      {(data) => {
        const items = data.items.filter((item) => item.lotId === id && !item.archived);
        const covered = items.filter((item) => item.warrantyEndsOn !== null && item.warrantyEndsOn >= data.asOf);
        const furthest = [...covered].sort((a, b) => (b.warrantyEndsOn ?? '').localeCompare(a.warrantyEndsOn ?? ''))[0];
        const upcoming = items
          .filter((item) => item.nextMaintenanceOn !== null)
          .sort((a, b) => (a.nextMaintenanceOn ?? '').localeCompare(b.nextMaintenanceOn ?? ''));
        const next = upcoming[0];
        const total = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
        return (
          <>
            <StatGrid>
              <StatCard label="Équipements" value={items.length}>
                <span className="text-caption text-fg-subtle">Fournis par le bailleur</span>
              </StatCard>
              <StatCard label="Sous garantie" value={covered.length}>
                <span className="text-caption text-fg-subtle">{furthest?.warrantyEndsOn ? `Jusqu’en ${furthest.warrantyEndsOn.slice(0, 4)} au plus tard` : 'Aucune garantie en cours'}</span>
              </StatCard>
              <StatCard label="Prochain entretien" value={next?.nextMaintenanceOn ? formatDate(next.nextMaintenanceOn) : '—'}>
                <span className="text-caption text-fg-subtle">{next ? next.name : 'Rien de planifié'}</span>
              </StatCard>
              <StatCard label="Valeur d’achat" value={formatMoney(total, data.currency)}>
                <span className="text-caption text-fg-subtle">Pose comprise</span>
              </StatCard>
            </StatGrid>
            <Panel
              title="Équipements du lot"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={biensPaths.newEquipement}>Ajouter un équipement</Link>
                </Button>
              }
            >
              <DataTable
                label="Équipements du lot"
                rows={items}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucun équipement rattaché à ce bien. Ajoutez le premier pour suivre sa garantie et son entretien.</p>}
                columns={[
                  { id: 'name', header: 'Équipement', strong: true, sortBy: (row) => row.name, cell: (row) => row.name },
                  { id: 'room', header: 'Pièce', sortBy: (row) => row.room, cell: (row) => row.room ?? '—' },
                  { id: 'model', header: 'Modèle', cell: (row) => row.model ?? '—' },
                  { id: 'purchasedOn', header: 'Mise en service', sortBy: (row) => row.purchasedOn, cell: (row) => (row.purchasedOn ? formatDate(row.purchasedOn) : '—') },
                  { id: 'warranty', header: 'Garantie', sortBy: (row) => row.warrantyEndsOn, cell: (row) => warrantyLabel(row, data.asOf).label },
                  { id: 'maintenance', header: 'Entretien', sortBy: (row) => row.nextMaintenanceOn, cell: (row) => (row.nextMaintenanceOn ? formatDate(row.nextMaintenanceOn) : (row.maintenanceNote ?? '—')) },
                  { id: 'charged', header: 'À la charge de', cell: (row) => CHARGED_LABELS[row.chargedTo] },
                  { id: 'actions', header: 'Action', hideHeader: true, cell: (row) => <RowActions name={row.name} primary={{ label: 'Ouvrir', href: biensPaths.equipement(row.id) }} items={[]} /> },
                ]}
              />
            </Panel>
            <Panel
              title="Entretiens à venir"
              action={
                <Button variant="link" asChild>
                  <Link href={upcoming[0] ? biensPaths.equipement(upcoming[0].id, 'entretien') : biensPaths.equipements}>Planifier</Link>
                </Button>
              }
            >
              <EntryList
                label="Entretiens à venir"
                empty="Aucun entretien à venir."
                items={upcoming.map((item) => ({
                  id: item.id,
                  title: `Entretien, ${item.name}`,
                  detail: `${item.nextMaintenanceOn ? formatDate(item.nextMaintenanceOn) : ''}${item.provider ? ` · ${item.provider}` : ''}`,
                  badge: { label: CHARGED_LABELS[item.chargedTo], tone: item.chargedTo === 'bailleur' ? 'info' : 'neutral' },
                  href: biensPaths.equipement(item.id, 'entretien'),
                }))}
              />
            </Panel>
            <Panel title="Qui paie quoi, décret du 26 août 1987">
              <ul aria-label="Répartition des réparations" className="flex flex-col">
                {RULES.map((rule) => (
                  <li key={rule.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                    <span>
                      <span className="block text-body font-medium text-fg">{rule.title}</span>
                      <span className="block text-caption text-fg-subtle">{rule.detail}</span>
                    </span>
                    <Badge tone={rule.who === 'Bailleur' ? 'info' : 'neutral'}>{rule.who}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        );
      }}
    </QueryBoundary>
  );
}
