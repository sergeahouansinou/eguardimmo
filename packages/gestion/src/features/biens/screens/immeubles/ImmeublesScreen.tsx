'use client';

import { Archive, ArchiveRestore, Building2, FilePlus, FileText, Pencil, Search, Split, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
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
import { formatArea } from '../../lib/amount';
import { REPARTITION_LABELS } from '../../lib/labels';
import { matches, plural } from '../../lib/text';
import { biensPaths } from '../../paths';
import { useImmeubles } from '../../queries';
import type { ImmeubleRow } from '../../schemas/immeubles';

type View = 'actifs' | 'archives';

export function ImmeublesScreen() {
  const { Link } = useBiensEnvironment();
  const query = useImmeubles();
  const [view, setView] = useState<View>('actifs');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [archiving, setArchiving] = useState<ImmeubleRow | null>(null);
  const [removing, setRemoving] = useState<ImmeubleRow | null>(null);
  const noDelete = useFeatureUnavailable('suppression');
  const list = useListState({ key: 'name', direction: 'asc' });

  const archive = useCommand((source, input: { id: string; archived: boolean }) => source.setImmeubleArchived(input.id, input.archived), {
    success: (_result, input) => (input.archived ? 'Immeuble archivé' : 'Immeuble restauré'),
    onDone: () => { setArchiving(null); },
  });
  const remove = useCommand((source, id: string) => source.deleteImmeuble(id), {
    success: () => 'Immeuble supprimé',
    onDone: () => { setRemoving(null); },
  });

  const columns: Column<ImmeubleRow>[] = [
    {
      id: 'name',
      header: 'Immeuble',
      strong: true,
      sortBy: (row) => row.name,
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Link href={biensPaths.immeuble(row.id)} className="font-medium text-fg hover:underline">
            {row.name}
          </Link>
          {row.copropriete ? <Badge tone="info">Copropriété</Badge> : null}
        </span>
      ),
    },
    { id: 'address', header: 'Adresse', sortBy: (row) => row.address, cell: (row) => `${row.address}, ${row.postalCode} ${row.city}` },
    { id: 'lots', header: 'Lots', numeric: true, sortBy: (row) => row.lots, cell: (row) => row.lots },
    { id: 'area', header: 'Surface totale', numeric: true, sortBy: (row) => row.totalArea, cell: (row) => (row.totalArea === null ? '—' : formatArea(row.totalArea)) },
    {
      id: 'repartition',
      header: 'Répartition',
      sortBy: (row) => row.repartition,
      cell: (row) => (row.repartition === null ? '—' : row.repartition === 'tantiemes' ? 'Tantièmes, 1 000 millièmes' : `${REPARTITION_LABELS[row.repartition]} habitable`),
    },
    {
      id: 'actions',
      header: 'Action',
      hideHeader: true,
      cell: (row) =>
        row.archived ? (
          <RowActions
            name={row.name}
            items={[
              { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, onSelect: () => { archive.execute({ id: row.id, archived: false }); } },
              { id: 'open', label: 'Ouvrir', icon: Building2, href: biensPaths.immeuble(row.id) },
              ...(noDelete ? [] : [{ id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, separatorBefore: true, onSelect: () => { setRemoving(row); } }]),
            ]}
          />
        ) : (
          <RowActions
            name={row.name}
            primary={{ label: 'Ouvrir', href: biensPaths.immeuble(row.id) }}
            items={[
              { id: 'edit', label: 'Modifier', icon: Pencil, href: biensPaths.editImmeuble(row.id) },
              { id: 'lots', label: 'Voir les lots', icon: Building2, href: biensPaths.immeuble(row.id, 'lots') },
              { id: 'add-lot', label: 'Ajouter un lot', icon: FilePlus, href: biensPaths.newLot },
              { id: 'charges', label: 'Répartition des charges', icon: Split, href: biensPaths.immeuble(row.id, 'charges') },
              { id: 'documents', label: 'Documents', icon: FileText, href: biensPaths.immeuble(row.id, 'documents') },
              { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { setArchiving(row); } },
              ...(noDelete ? [] : [{ id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, onSelect: () => { setRemoving(row); } }]),
            ]}
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: 'Immeubles' }]}
        title="Immeubles"
        subtitle="Un immeuble regroupe ses lots et ses tantièmes pour la répartition des charges."
        actions={
          <Button asChild>
            <Link href={biensPaths.newImmeuble}>Nouvel immeuble</Link>
          </Button>
        }
      />
      <QueryBoundary query={query} errorTitle="Les immeubles n’ont pas pu être chargés" skeleton={<SkeletonRows rows={4} label="Chargement des immeubles" />}>
        {(data) => {
          const active = data.items.filter((item) => !item.archived);
          const archived = data.items.filter((item) => item.archived);
          const pool = view === 'actifs' ? active : archived;
          const cities = [...new Set(data.items.map((item) => item.city))].sort((a, b) => a.localeCompare(b, 'fr'));
          const filtered = pool.filter((item) => matches(search, item.name, item.address, item.city) && (city === '' || item.city === city));
          const hasFilters = search !== '' || city !== '';
          return (
            <>
              <Tabs
                value={view}
                defaultValue="actifs"
                onValueChange={(next) => {
                  setView(next === 'archives' ? 'archives' : 'actifs');
                  list.restart();
                }}
              >
                <TabList aria-label="Vues des immeubles">
                  <Tab value="actifs" count={active.length}>Actifs</Tab>
                  <Tab value="archives" count={archived.length}>Archives</Tab>
                </TabList>
              <TabPanel value={view} className="flex flex-col gap-3 pt-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-full sm:w-64">
                  <TextField
                    label="Rechercher un immeuble"
                    hideLabel
                    type="search"
                    placeholder="Nom ou adresse"
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); list.restart(); }}
                    className="pl-8"
                  />
                  <Icon icon={Search} className="pointer-events-none absolute top-2 left-2.5 text-fg-subtle" />
                </div>
                <Select
                  label="Ville"
                  hideLabel
                  placeholder="Ville : toutes"
                  options={[{ value: '', label: 'Toutes les villes' }, ...cities.map((entry) => ({ value: entry, label: entry }))]}
                  value={city}
                  onValueChange={(next) => { setCity(next); list.restart(); }}
                  className="w-44"
                />
              </div>
              <DataTable
                label={view === 'actifs' ? 'Liste des immeubles' : 'Immeubles archivés'}
                rows={filtered}
                columns={columns}
                getId={(row) => row.id}
                list={list}
                empty={
                  <EmptyState
                    icon={Building2}
                    title={hasFilters ? 'Aucun immeuble ne correspond' : view === 'actifs' ? 'Aucun immeuble pour le moment' : 'Aucun immeuble archivé'}
                    description={hasFilters ? 'Modifiez ou retirez des filtres pour élargir la recherche.' : 'Créez un immeuble pour y rattacher vos lots.'}
                  >
                    {hasFilters ? (
                      <Button variant="secondary" onClick={() => { setSearch(''); setCity(''); list.restart(); }}>
                        Réinitialiser les filtres
                      </Button>
                    ) : view === 'actifs' ? (
                      <Button asChild>
                        <Link href={biensPaths.newImmeuble}>Nouvel immeuble</Link>
                      </Button>
                    ) : null}
                  </EmptyState>
                }
              />
              </TabPanel>
              </Tabs>
            </>
          );
        }}
      </QueryBoundary>
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => { if (!open) setArchiving(null); }}
        title="Archiver cet immeuble ?"
        description={archiving ? `« ${archiving.name} » quittera la liste des immeubles actifs. Il compte ${plural(archiving.lots, 'lot actif', 'lots actifs')} ; l’archivage est refusé tant qu’il reste des lots actifs.` : ''}
        confirmLabel="Archiver"
        loading={archive.isPending}
        onConfirm={() => { if (archiving) archive.execute({ id: archiving.id, archived: true }); }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Supprimer cet immeuble ?"
        description={removing ? `« ${removing.name} » et ses documents seront supprimés définitivement. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.execute(removing.id); }}
      />
    </>
  );
}
