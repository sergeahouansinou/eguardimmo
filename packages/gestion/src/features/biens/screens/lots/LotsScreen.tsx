'use client';

import { Archive, ArchiveRestore, Copy, FilePlus, FileText, Gauge, Globe, GlobeLock, Home, Pencil, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Chip, ConfirmDialog, Count, EmptyState, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { RowActions } from '../../components/RowActions';
import { useBiensEnvironment } from '../../environment';
import { useFeatureUnavailable } from '../../FeatureGate';
import { useCommand } from '../../hooks/useCommand';
import { useListState } from '../../hooks/useListState';
import { formatArea, formatNumber } from '../../lib/amount';
import { downloadFile } from '../../lib/files';
import { LISTING_LABELS, LOT_TYPE_LABELS, lotStatusBadge } from '../../lib/labels';
import { lotsToCsv } from '../../lib/lotCsv';
import { matches, plural } from '../../lib/text';
import { biensPaths, externalPaths } from '../../paths';
import { useImmeubles, useLots } from '../../queries';
import { LOT_TYPES } from '../../schemas/lots';
import type { LotRow, LotsData } from '../../schemas/lots';
import { formatMoney } from '../../../../format/money';
import { LotsImportDialog } from './LotsImportDialog';

type View = 'lots' | 'archives';
type Availability = 'loue' | 'libre' | 'travaux';

const AVAILABILITY: { id: Availability; label: string }[] = [
  { id: 'loue', label: 'Loué' },
  { id: 'libre', label: 'Libre' },
  { id: 'travaux', label: 'En travaux' },
];

function availabilityOf(lot: LotRow): Availability {
  if (lot.status === 'travaux') return 'travaux';
  return lot.tenant ? 'loue' : 'libre';
}

function primaryAction(lot: LotRow): { label: string; href: string } {
  if (lot.status === 'travaux') return { label: 'Suivre', href: externalPaths.interventions };
  if (!lot.tenant) return { label: 'Créer un bail', href: externalPaths.newLease(lot.id) };
  return { label: 'Ouvrir', href: biensPaths.lot(lot.id) };
}

export function LotsScreen() {
  const { Link, push } = useBiensEnvironment();
  const lots = useLots();
  const immeubles = useImmeubles();
  const [view, setView] = useState<View>('lots');
  const [search, setSearch] = useState('');
  const [immeuble, setImmeuble] = useState('');
  const [type, setType] = useState('');
  const [listing, setListing] = useState('');
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [archiving, setArchiving] = useState<LotRow[] | null>(null);
  const [removing, setRemoving] = useState<LotRow | null>(null);
  const list = useListState({ key: 'name', direction: 'asc' });
  const noListing = useFeatureUnavailable('annonces');
  const noImport = useFeatureUnavailable('import');
  const noDuplicate = useFeatureUnavailable('duplication');
  const noDelete = useFeatureUnavailable('suppression');
  const noWorks = useFeatureUnavailable('interventions');

  const archive = useCommand((source, input: { ids: string[]; archived: boolean }) => source.setLotsArchived(input.ids, input.archived), {
    success: (_result, input) => (input.archived ? plural(input.ids.length, 'bien archivé', 'biens archivés') : plural(input.ids.length, 'bien restauré', 'biens restaurés')),
    onDone: () => {
      setSelected([]);
      setArchiving(null);
    },
  });
  const duplicate = useCommand((source, id: string) => source.duplicateLot(id), {
    success: () => 'Bien dupliqué',
    onDone: (result) => { push(biensPaths.editLot(result.id)); },
  });
  const publish = useCommand((source, input: { id: string; listing: 'en_ligne' | 'hors_ligne' }) => source.setLotListing(input.id, input.listing), {
    success: (_result, input) => (input.listing === 'en_ligne' ? 'Annonce publiée' : 'Annonce retirée'),
  });
  const remove = useCommand((source, id: string) => source.deleteLot(id), {
    success: () => 'Bien supprimé',
    onDone: () => { setRemoving(null); },
  });

  const restart = () => {
    list.restart();
    setSelected([]);
  };

  const columns = (currency: LotsData['currency']): Column<LotRow>[] => [
    {
      id: 'name',
      header: 'Lot',
      strong: true,
      sortBy: (row) => row.name,
      cell: (row) => (
        <Link href={biensPaths.lot(row.id)} className="font-medium text-fg hover:underline">
          {row.name}
        </Link>
      ),
    },
    { id: 'immeuble', header: 'Immeuble', sortBy: (row) => row.immeubleName, cell: (row) => row.immeubleName },
    { id: 'type', header: 'Type', sortBy: (row) => LOT_TYPE_LABELS[row.type], cell: (row) => LOT_TYPE_LABELS[row.type] },
    { id: 'surface', header: 'Surface', numeric: true, sortBy: (row) => row.surface, cell: (row) => (row.surface === null ? '—' : formatArea(row.surface)) },
    { id: 'rooms', header: 'Pièces', numeric: true, sortBy: (row) => row.rooms, cell: (row) => (row.rooms === null ? '—' : formatNumber(row.rooms)) },
    {
      id: 'tenant',
      header: 'Locataire',
      sortBy: (row) => row.tenant?.name ?? null,
      cell: (row) =>
        row.tenant ? (
          <Link href={`/locataires/${row.tenant.id}`} className="hover:underline">
            {row.tenant.name}
          </Link>
        ) : (
          <span className="text-fg-subtle">Sans locataire</span>
        ),
    },
    { id: 'rent', header: 'Loyer', numeric: true, sortBy: (row) => row.rent, cell: (row) => (row.rent === null ? '—' : formatMoney(row.rent, currency)) },
    ...(noListing
      ? []
      : [
          {
            id: 'listing',
            header: 'Annonce',
            sortBy: (row: LotRow) => row.listing,
            cell: (row: LotRow) => (row.listing === null ? '—' : <Badge tone={row.listing === 'en_ligne' ? 'info' : 'neutral'}>{LISTING_LABELS[row.listing]}</Badge>),
          },
        ]),
    {
      id: 'status',
      header: 'État',
      sortBy: (row) => lotStatusBadge(row).label,
      cell: (row) => <Badge tone={lotStatusBadge(row).tone}>{lotStatusBadge(row).label}</Badge>,
    },
    {
      id: 'actions',
      header: 'Action',
      hideHeader: true,
      cell: (row) => (
        <RowActions
          name={row.name}
          primary={row.archived ? undefined : primaryAction(row)}
          items={
            row.archived
              ? [
                  { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, onSelect: () => { archive.execute({ ids: [row.id], archived: false }); } },
                  { id: 'open', label: 'Fiche du lot', icon: Home, href: biensPaths.lot(row.id) },
                  ...(noDelete ? [] : [{ id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, separatorBefore: true, onSelect: () => { setRemoving(row); } }]),
                ]
              : [
                  { id: 'edit', label: 'Modifier le lot', icon: Pencil, href: biensPaths.editLot(row.id) },
                  { id: 'open', label: 'Fiche du lot', icon: Home, href: biensPaths.lot(row.id) },
                  ...(row.tenant ? [] : [{ id: 'lease', label: 'Créer un bail', icon: FilePlus, href: externalPaths.newLease(row.id) }]),
                  ...(noListing
                    ? []
                    : [
                        {
                          id: 'listing',
                          label: row.listing === 'en_ligne' ? 'Retirer l’annonce' : 'Publier l’annonce',
                          icon: row.listing === 'en_ligne' ? GlobeLock : Globe,
                          onSelect: () => { publish.execute({ id: row.id, listing: row.listing === 'en_ligne' ? 'hors_ligne' : 'en_ligne' }); },
                        },
                      ]),
                  { id: 'readings', label: 'Relevés de compteurs', icon: Gauge, href: biensPaths.lot(row.id, 'compteurs') },
                  { id: 'documents', label: 'Documents', icon: FileText, href: biensPaths.lot(row.id, 'documents') },
                  ...(noDuplicate ? [] : [{ id: 'duplicate', label: 'Dupliquer', icon: Copy, separatorBefore: true, onSelect: () => { duplicate.execute(row.id); } }]),
                  { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: noDuplicate, onSelect: () => { setArchiving([row]); } },
                  ...(noDelete ? [] : [{ id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, onSelect: () => { setRemoving(row); } }]),
                ]
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Biens' }]}
        title="Biens"
        subtitle={
          lots.data && immeubles.data
            ? `${plural(lots.data.items.filter((lot) => !lot.archived).length, 'lot')} dans ${plural(immeubles.data.items.filter((item) => !item.archived).length, 'immeuble')}. Un lot loué porte un bail actif.`
            : 'Vos lots et leurs immeubles.'
        }
        actions={
          <>
            {noImport ? null : (
              <Button variant="secondary" onClick={() => { setImporting(true); }}>
                Importer
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link href={biensPaths.newImmeuble}>Ajouter un immeuble</Link>
            </Button>
            <Button asChild>
              <Link href={biensPaths.newLot}>Ajouter un lot</Link>
            </Button>
          </>
        }
      />
      <QueryBoundary query={lots} errorTitle="Les biens n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des biens" />}>
        {(data) => {
          const active = data.items.filter((lot) => !lot.archived);
          const archived = data.items.filter((lot) => lot.archived);
          const pool = view === 'lots' ? active : archived;
          const filtered = pool.filter(
            (lot) =>
              matches(search, lot.name, lot.immeubleName, lot.tenant?.name) &&
              (immeuble === '' || lot.immeubleId === immeuble) &&
              (type === '' || lot.type === type) &&
              (listing === '' || lot.listing === listing) &&
              (availability.length === 0 || availability.includes(availabilityOf(lot))),
          );
          const chosen = data.items.filter((lot) => selected.includes(lot.id));
          const immeubleOptions = [...new Map(data.items.map((lot) => [lot.immeubleId, lot.immeubleName])).entries()].map(([value, label]) => ({ value, label }));
          const hasFilters = search !== '' || immeuble !== '' || type !== '' || listing !== '' || availability.length > 0;
          return (
            <>
              <Tabs
                value={view}
                defaultValue="lots"
                onValueChange={(next) => {
                  if (next === 'immeubles') push(biensPaths.immeubles);
                  else {
                    setView(next === 'archives' ? 'archives' : 'lots');
                    restart();
                  }
                }}
              >
                <TabList aria-label="Vues des biens">
                  <Tab value="lots" count={active.length}>Lots</Tab>
                  <Tab value="immeubles" count={immeubles.data?.items.filter((item) => !item.archived).length}>Immeubles</Tab>
                  <Tab value="archives" count={archived.length}>Archivés</Tab>
                </TabList>
              <TabPanel value={view} className="flex flex-col gap-3 pt-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-full sm:w-64">
                  <TextField
                    label="Rechercher un lot"
                    hideLabel
                    type="search"
                    placeholder="Lot, adresse ou locataire"
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); restart(); }}
                    className="pl-8"
                  />
                  <Icon icon={Search} className="pointer-events-none absolute top-2 left-2.5 text-fg-subtle" />
                </div>
                <Select label="Immeuble" hideLabel placeholder="Immeuble : tous" options={[{ value: '', label: 'Tous les immeubles' }, ...immeubleOptions]} value={immeuble} onValueChange={(next) => { setImmeuble(next); restart(); }} className="w-44" />
                <Select label="Type" hideLabel placeholder="Type : tous" options={[{ value: '', label: 'Tous les types' }, ...LOT_TYPES.map((entry) => ({ value: entry, label: LOT_TYPE_LABELS[entry] }))]} value={type} onValueChange={(next) => { setType(next); restart(); }} className="w-40" />
                {noListing ? null : <Select label="Annonce" hideLabel placeholder="Annonce : toutes" options={[{ value: '', label: 'Toutes les annonces' }, { value: 'en_ligne', label: 'En ligne' }, { value: 'hors_ligne', label: 'Hors ligne' }]} value={listing} onValueChange={(next) => { setListing(next); restart(); }} className="w-44" />}
                <div role="group" aria-label="Filtrer par disponibilité" className="flex gap-1.5">
                  {AVAILABILITY.filter((item) => item.id !== 'travaux' || !noWorks).map((item) => (
                    <Chip
                      key={item.id}
                      pressed={availability.includes(item.id)}
                      onClick={() => {
                        setAvailability((current) => (current.includes(item.id) ? current.filter((entry) => entry !== item.id) : [...current, item.id]));
                        restart();
                      }}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>
              {chosen.length > 0 ? (
                <div role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-action-subtle px-3 py-1.5 text-body text-action-on-subtle">
                  <Count value={chosen.length} tone="active" />
                  <span>{chosen.length > 1 ? 'sélectionnés' : 'sélectionné'}</span>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={externalPaths.newMessage}>Envoyer un message</Link>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { downloadFile('biens.csv', lotsToCsv(chosen, data.currency)); }}>
                    Exporter
                  </Button>
                  {view === 'lots' ? (
                    <Button variant="secondary" size="sm" onClick={() => { setArchiving(chosen); }}>
                      Archiver
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => { archive.execute({ ids: chosen.map((lot) => lot.id), archived: false }); }}>
                      Restaurer
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setSelected([]); }}>
                    Tout désélectionner
                  </Button>
                </div>
              ) : null}
              <DataTable
                label={view === 'lots' ? 'Liste des lots' : 'Lots archivés'}
                rows={filtered}
                columns={columns(data.currency)}
                getId={(row) => row.id}
                list={list}
                selected={selected}
                onSelectedChange={setSelected}
                rowLabel={(row) => row.name}
                empty={
                  <EmptyState
                    icon={Home}
                    title={hasFilters ? 'Aucun lot ne correspond' : view === 'lots' ? 'Aucun lot pour le moment' : 'Aucun lot archivé'}
                    description={hasFilters ? 'Modifiez ou retirez des filtres pour élargir la recherche.' : 'Ajoutez votre premier lot pour suivre ses loyers et ses diagnostics.'}
                  >
                    {hasFilters ? (
                      <Button variant="secondary" onClick={() => { setSearch(''); setImmeuble(''); setType(''); setListing(''); setAvailability([]); restart(); }}>
                        Réinitialiser les filtres
                      </Button>
                    ) : view === 'lots' ? (
                      <Button asChild>
                        <Link href={biensPaths.newLot}>Ajouter un lot</Link>
                      </Button>
                    ) : null}
                  </EmptyState>
                }
              />
              <LotsImportDialog open={importing} onOpenChange={setImporting} currency={data.currency} />
              </TabPanel>
              </Tabs>
            </>
          );
        }}
      </QueryBoundary>
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => { if (!open) setArchiving(null); }}
        title={archiving && archiving.length > 1 ? `Archiver ${plural(archiving.length, 'bien', 'biens')} ?` : 'Archiver ce bien ?'}
        description={archiving ? `${archiving.map((lot) => lot.name).join(', ')} ${archiving.length > 1 ? 'quitteront' : 'quittera'} la liste des lots. Vous pourrez ${archiving.length > 1 ? 'les' : 'le'} restaurer depuis l’onglet Archivés.` : ''}
        confirmLabel="Archiver"
        loading={archive.isPending}
        onConfirm={() => { if (archiving) archive.execute({ ids: archiving.map((lot) => lot.id), archived: true }); }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Supprimer ce bien ?"
        description={removing ? `« ${removing.name} » et ses documents seront supprimés définitivement. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.execute(removing.id); }}
      />
    </>
  );
}
