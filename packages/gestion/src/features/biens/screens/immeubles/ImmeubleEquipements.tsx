'use client';

import { Badge, Button, StatCard } from '@eguardimmo/ui';
import { DataTable } from '../../components/DataTable';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { RowActions } from '../../components/RowActions';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatNumber } from '../../lib/amount';
import { daysBetween, formatDate } from '../../lib/dates';
import { UPCOMING_WINDOW_DAYS, maintenanceStatus } from '../../lib/summaries';
import { biensPaths, externalPaths } from '../../paths';
import { useEquipements, useImmeuble } from '../../queries';
import { formatMoney } from '../../../../format/money';

const REGULATIONS = [
  { id: 'ascenseur', title: 'Ascenseur', detail: 'Entretien toutes les 6 semaines, contrôle technique tous les 5 ans' },
  { id: 'porte', title: 'Porte automatique de garage', detail: 'Entretien au moins tous les 6 mois, carnet tenu à jour' },
  { id: 'extincteurs', title: 'Extincteurs', detail: 'Vérification annuelle par un technicien qualifié' },
  { id: 'contrats', title: 'Contrats d’entretien', detail: 'Part récupérable sur le locataire selon le décret de 1987' },
] as const;

export function ImmeubleEquipements({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useEquipements();
  const immeuble = useImmeuble(id);
  const list = useListState({ key: 'name', direction: 'asc' });
  return (
    <QueryBoundary query={query} errorTitle="Les équipements n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des équipements communs" />}>
      {(data) => {
        const items = data.items.filter((item) => item.immeubleId === id && item.lotId === null && !item.archived);
        const upcoming = items
          .filter((item) => item.nextMaintenanceOn !== null)
          .sort((a, b) => (a.nextMaintenanceOn ?? '').localeCompare(b.nextMaintenanceOn ?? ''));
        const soon = upcoming.filter((item) => item.nextMaintenanceOn !== null && daysBetween(data.asOf, item.nextMaintenanceOn) >= 0 && daysBetween(data.asOf, item.nextMaintenanceOn) <= UPCOMING_WINDOW_DAYS);
        const contracts = items.reduce((sum, item) => sum + (item.contractYearly ?? 0), 0);
        const tantiemes = immeuble.data?.tantiemes;
        const share = tantiemes && tantiemes.total > 0 ? Math.round((contracts * tantiemes.sum) / tantiemes.total) : null;
        return (
          <>
            <StatGrid>
              <StatCard label="Équipements communs" value={items.length}>
                <span className="text-caption text-fg-subtle">Gérés par le syndic</span>
              </StatCard>
              <StatCard label="Contrôles à venir" value={soon.length}>
                <span className="text-caption text-fg-subtle">{`Dans les ${String(UPCOMING_WINDOW_DAYS)} prochains jours`}</span>
              </StatCard>
              <StatCard label="Contrats d’entretien" value={formatMoney(contracts, data.currency)}>
                <span className="text-caption text-fg-subtle">Par an, pour l’immeuble</span>
              </StatCard>
              <StatCard label="Votre part des contrats" value={share === null ? '—' : formatMoney(share, data.currency)}>
                <span className="text-caption text-fg-subtle">{tantiemes ? `${formatNumber(tantiemes.sum)} / ${formatNumber(tantiemes.total)}` : ''}</span>
              </StatCard>
            </StatGrid>
            <Panel
              title="Équipements des parties communes"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={biensPaths.newEquipement}>Ajouter un équipement</Link>
                </Button>
              }
            >
              <DataTable
                label="Équipements des parties communes"
                rows={items}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucun équipement commun. Ajoutez l’ascenseur, les extincteurs ou la porte du parking pour suivre leurs contrôles.</p>}
                columns={[
                  { id: 'name', header: 'Équipement', strong: true, sortBy: (row) => row.name, cell: (row) => row.name },
                  { id: 'provider', header: 'Prestataire', sortBy: (row) => row.provider, cell: (row) => row.provider ?? '—' },
                  { id: 'last', header: 'Dernier passage', sortBy: (row) => row.lastVisitOn, cell: (row) => (row.lastVisitOn ? formatDate(row.lastVisitOn) : '—') },
                  { id: 'next', header: 'Prochaine échéance', sortBy: (row) => row.nextMaintenanceOn, cell: (row) => (row.nextMaintenanceOn ? formatDate(row.nextMaintenanceOn) : '—') },
                  { id: 'obligation', header: 'Obligation', cell: (row) => row.obligation ?? '—' },
                  {
                    id: 'status',
                    header: 'Statut',
                    sortBy: (row) => row.nextMaintenanceOn,
                    cell: (row) => {
                      const status = maintenanceStatus(row, data.asOf);
                      return <Badge tone={status.tone}>{status.label}</Badge>;
                    },
                  },
                  { id: 'actions', header: 'Action', hideHeader: true, cell: (row) => <RowActions name={row.name} primary={{ label: 'Ouvrir', href: biensPaths.equipement(row.id) }} items={[]} /> },
                ]}
              />
            </Panel>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel
                title="Prochaines échéances"
                action={
                  <Button variant="link" size="sm" asChild>
                    <Link href={externalPaths.agenda}>Voir l’agenda</Link>
                  </Button>
                }
              >
                <EntryList
                  label="Prochaines échéances"
                  empty="Aucune échéance planifiée."
                  items={upcoming.map((item) => ({
                    id: item.id,
                    title: `${item.name}${item.obligation ? `, ${item.obligation.toLowerCase()}` : ''}`,
                    detail: `${formatDate(item.nextMaintenanceOn ?? data.asOf)}${item.provider ? ` · ${item.provider}` : ''}`,
                    badge: maintenanceStatus(item, data.asOf),
                    href: biensPaths.equipement(item.id, 'entretien'),
                  }))}
                />
              </Panel>
              <Panel title="Ce que prévoit la réglementation">
                <EntryList label="Obligations réglementaires" items={REGULATIONS.map((rule) => ({ id: rule.id, title: rule.title, detail: rule.detail }))} />
              </Panel>
            </div>
          </>
        );
      }}
    </QueryBoundary>
  );
}
