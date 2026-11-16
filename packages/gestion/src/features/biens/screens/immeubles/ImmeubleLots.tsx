'use client';

import { Badge, Button, StatCard } from '@eguardimmo/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { RowActions } from '../../components/RowActions';
import { useBiensEnvironment } from '../../environment';
import { WhenAvailable, useFeatureUnavailable } from '../../FeatureGate';
import { useListState } from '../../hooks/useListState';
import { formatArea, formatNumber } from '../../lib/amount';
import { formatDate } from '../../lib/dates';
import { LOT_TYPE_LABELS, lotStatusBadge } from '../../lib/labels';
import { plural } from '../../lib/text';
import { biensPaths } from '../../paths';
import { useImmeuble, useLots } from '../../queries';
import type { LotRow } from '../../schemas/lots';
import { formatMoney } from '../../../../format/money';
import type { Currency } from '../../../../format/money';

const leaseEndLabel = (lot: LotRow): string => (lot.leaseEnd ? formatDate(lot.leaseEnd) : (lot.leaseNote ?? '—'));

export function lotColumns(currency: Currency, full: boolean, withTantiemes = true): Column<LotRow>[] {
  const base: Column<LotRow>[] = [
    {
      id: 'name',
      header: 'Lot',
      strong: true,
      sortBy: (row) => row.name,
      cell: (row) => <LotLink lot={row} />,
    },
    { id: 'type', header: 'Type', sortBy: (row) => LOT_TYPE_LABELS[row.type], cell: (row) => LOT_TYPE_LABELS[row.type] },
    ...(full ? [{ id: 'floor', header: 'Étage', sortBy: (row: LotRow) => row.floor, cell: (row: LotRow) => row.floor ?? '—' }] : []),
    { id: 'surface', header: 'Surface', numeric: true, sortBy: (row) => row.surface, cell: (row) => (row.surface === null ? '—' : formatArea(row.surface)) },
    ...(withTantiemes ? [{ id: 'tantiemes', header: 'Tantièmes', numeric: true, sortBy: (row: LotRow) => row.tantiemes, cell: (row: LotRow) => (row.tantiemes === null ? '—' : formatNumber(row.tantiemes)) }] : []),
    ...(full ? [{ id: 'elevator', header: 'Ascenseur', numeric: true, sortBy: (row: LotRow) => row.elevatorShares, cell: (row: LotRow) => (row.elevatorShares === null ? '—' : formatNumber(row.elevatorShares)) }] : []),
    { id: 'tenant', header: 'Locataire', sortBy: (row) => row.tenant?.name ?? null, cell: (row) => row.tenant?.name ?? <span className="text-fg-subtle">Sans locataire</span> },
    ...(full ? [{ id: 'leaseEnd', header: 'Fin de bail', sortBy: (row: LotRow) => row.leaseEnd, cell: leaseEndLabel }] : []),
    { id: 'rent', header: 'Loyer CC', numeric: true, sortBy: (row) => row.rent, cell: (row) => (row.rent === null ? '—' : formatMoney(row.rent, currency)) },
    {
      id: 'status',
      header: 'Statut',
      sortBy: (row) => lotStatusBadge(row).label,
      cell: (row) => <Badge tone={lotStatusBadge(row).tone}>{lotStatusBadge(row).label}</Badge>,
    },
  ];
  if (!full) return base;
  return [
    ...base,
    {
      id: 'actions',
      header: 'Action',
      hideHeader: true,
      cell: (row) => <RowActions name={row.name} primary={{ label: 'Ouvrir', href: biensPaths.lot(row.id) }} items={[]} />,
    },
  ];
}

function LotLink({ lot }: { lot: LotRow }) {
  const { Link } = useBiensEnvironment();
  return (
    <Link href={biensPaths.lot(lot.id)} className="font-medium text-fg hover:underline">
      {lot.name}
    </Link>
  );
}

export function ImmeubleLots({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const lots = useLots();
  const immeuble = useImmeuble(id);
  const list = useListState({ key: 'name', direction: 'asc' });
  const noTantiemes = useFeatureUnavailable('copropriete');
  return (
    <QueryBoundary query={lots} errorTitle="Les lots n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des lots" />}>
      {(data) => {
        const items = data.items.filter((lot) => lot.immeubleId === id && !lot.archived);
        const housing = items.filter((lot) => lot.type !== 'parking');
        const totalOf = (rows: readonly LotRow[]) => (rows.some((lot) => lot.surface === null) ? null : Math.round(rows.reduce((sum, lot) => sum + (lot.surface ?? 0), 0) * 10) / 10);
        const area = totalOf(items);
        const housingArea = totalOf(housing);
        const rents = items.some((lot) => lot.rent === null) ? null : items.reduce((sum, lot) => sum + (lot.rent ?? 0), 0);
        const rented = items.filter((lot) => lot.tenant !== null);
        const notices = items.filter((lot) => lot.status === 'preavis');
        const noticeEnd = notices.map((lot) => lot.leaseEnd).filter((date) => date !== null).sort()[0];
        const occupancy = items.length === 0 ? 0 : Math.round((rented.length / items.length) * 100);
        const detail = immeuble.data;
        const sum = items.reduce((total, lot) => total + (lot.tantiemes ?? 0), 0);
        return (
          <>
            <StatGrid>
              <StatCard label="Vos lots" value={items.length}>
                <span className="text-caption text-fg-subtle">{`${plural(housing.length, 'logement')}, ${plural(items.length - housing.length, 'parking')}`}</span>
              </StatCard>
              <StatCard label="Surface totale" value={area === null ? '—' : formatArea(area)}>
                <span className="text-caption text-fg-subtle">{housingArea === null ? 'Surface non renseignée sur certains lots' : `Hors parking ${formatArea(housingArea)}`}</span>
              </StatCard>
              <StatCard label="Loyers mensuels" value={rents === null ? '—' : formatMoney(rents, data.currency)}>
                <span className="text-caption text-fg-subtle">{rents === null ? 'Non disponible' : 'Charges comprises'}</span>
              </StatCard>
              <StatCard label="Occupation" value={`${String(occupancy)} %`}>
                <span className="text-caption text-fg-subtle">
                  {notices.length > 0 ? `${plural(notices.length, 'préavis', 'préavis')}${noticeEnd ? `, départ le ${formatDate(noticeEnd)}` : ''}` : 'Aucun préavis'}
                </span>
              </StatCard>
            </StatGrid>
            <Panel
              title="Vos lots dans l’immeuble"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={biensPaths.newLot}>Ajouter un lot</Link>
                </Button>
              }
            >
              <DataTable
                label="Lots de l’immeuble"
                rows={items}
                columns={lotColumns(data.currency, true, !noTantiemes)}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucun lot rattaché à cet immeuble. Ajoutez le premier lot pour suivre ses loyers.</p>}
              />
            </Panel>
            <WhenAvailable feature="copropriete">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Tantièmes généraux par lot">
                <EntryList
                  label="Tantièmes par lot"
                  empty="Aucun lot à répartir."
                  items={items.map((lot) => ({ id: lot.id, title: lot.name, trailing: <span className="tabular-nums text-body text-fg">{lot.tantiemes === null ? '—' : formatNumber(lot.tantiemes)}</span> }))}
                />
                <p className="flex items-baseline justify-between border-t border-line pt-2 text-body font-medium text-fg">
                  <span>Total</span>
                  <span className="tabular-nums">{`${formatNumber(sum)} / ${formatNumber(detail?.tantiemes.total ?? 1000)}`}</span>
                </p>
              </Panel>
              {detail?.immeuble.copropriete && detail.totalLots !== null ? (
                <Panel title="Dans la copropriété">
                  <EntryList
                    label="Répartition de la copropriété"
                    items={[
                      { id: 'total', title: 'Lots de la copropriété', trailing: <span className="tabular-nums">{detail.totalLots}</span> },
                      { id: 'vous', title: 'Vos lots', detail: `${plural(items.length, 'lot')}, soit ${formatNumber(sum)} / ${formatNumber(detail.tantiemes.total)}`, trailing: <span className="tabular-nums">{items.length}</span> },
                      {
                        id: 'autres',
                        title: 'Autres copropriétaires',
                        detail: `${plural(Math.max(0, detail.totalLots - items.length), 'lot')}, ${formatNumber(Math.max(0, detail.tantiemes.total - sum))} / ${formatNumber(detail.tantiemes.total)}`,
                        trailing: <span className="tabular-nums">{Math.max(0, detail.totalLots - items.length)}</span>,
                      },
                    ]}
                  />
                </Panel>
              ) : null}
            </div>
            </WhenAvailable>
          </>
        );
      }}
    </QueryBoundary>
  );
}
