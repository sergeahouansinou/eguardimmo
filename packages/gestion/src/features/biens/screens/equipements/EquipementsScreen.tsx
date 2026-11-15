'use client';

import { Archive, ArchiveRestore, CalendarClock, FilePlus, Pencil, Search, Trash2, Wrench } from 'lucide-react';
import { Alert, Badge, Button, Chip, ConfirmDialog, EmptyState, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { RowActions } from '../../components/RowActions';
import { useBiensEnvironment } from '../../environment';
import { useCommand } from '../../hooks/useCommand';
import { useListState } from '../../hooks/useListState';
import { daysBetween, formatDate } from '../../lib/dates';
import { equipementsToCsv } from '../../lib/equipementCsv';
import { downloadFile } from '../../lib/files';
import { FAMILY_LABELS } from '../../lib/labels';
import { UPCOMING_WINDOW_DAYS, warrantyLabel } from '../../lib/summaries';
import { matches, plural } from '../../lib/text';
import { biensPaths, externalPaths } from '../../paths';
import { useEquipements } from '../../queries';
import { FAMILIES } from '../../schemas/equipements';
import type { EquipementRow, EquipementsData } from '../../schemas/equipements';
import { formatMoney } from '../../../../format/money';

type View = 'service' | 'hors' | 'archives';
type Flag = 'garantie' | 'expiree' | 'entretien';

const FLAGS: { id: Flag; label: string }[] = [
  { id: 'garantie', label: 'Sous garantie' },
  { id: 'expiree', label: 'Garantie expirée' },
  { id: 'entretien', label: 'Entretien à prévoir' },
];

function hasFlag(row: EquipementRow, flag: Flag, asOf: string): boolean {
  if (flag === 'garantie') return row.warrantyEndsOn !== null && row.warrantyEndsOn >= asOf;
  if (flag === 'expiree') return row.warrantyEndsOn !== null && row.warrantyEndsOn < asOf;
  return row.nextMaintenanceOn !== null && daysBetween(asOf, row.nextMaintenanceOn) <= UPCOMING_WINDOW_DAYS;
}

export function EquipementsScreen() {
  const { Link } = useBiensEnvironment();
  const query = useEquipements();
  const [view, setView] = useState<View>('service');
  const [search, setSearch] = useState('');
  const [place, setPlace] = useState('');
  const [family, setFamily] = useState('');
  const [flags, setFlags] = useState<Flag[]>([]);
  const [archiving, setArchiving] = useState<EquipementRow | null>(null);
  const [removing, setRemoving] = useState<EquipementRow | null>(null);
  const list = useListState({ key: 'name', direction: 'asc' });

  const archive = useCommand((source, input: { id: string; archived: boolean }) => source.setEquipementArchived(input.id, input.archived), {
    success: (_result, input) => (input.archived ? 'Équipement archivé' : 'Équipement restauré'),
    onDone: () => { setArchiving(null); },
  });
  const remove = useCommand((source, id: string) => source.deleteEquipement(id), {
    success: () => 'Équipement supprimé',
    onDone: () => { setRemoving(null); },
  });

  const columns = (data: EquipementsData): Column<EquipementRow>[] => [
    {
      id: 'name',
      header: 'Équipement',
      strong: true,
      sortBy: (row) => row.name,
      cell: (row) => (
        <span className="flex flex-col">
          <Link href={biensPaths.equipement(row.id)} className="font-medium text-fg hover:underline">
            {row.name}
          </Link>
          {row.detail ? <span className="text-caption text-fg-subtle">{row.detail}</span> : null}
        </span>
      ),
    },
    { id: 'family', header: 'Famille', sortBy: (row) => FAMILY_LABELS[row.family], cell: (row) => FAMILY_LABELS[row.family] },
    { id: 'place', header: 'Bien', sortBy: (row) => row.placeName, cell: (row) => row.placeName },
    { id: 'purchasedOn', header: 'Achat', sortBy: (row) => row.purchasedOn, cell: (row) => (row.purchasedOn ? formatDate(row.purchasedOn) : '—') },
    { id: 'price', header: 'Prix', numeric: true, sortBy: (row) => row.price, cell: (row) => (row.price === null ? '—' : formatMoney(row.price, data.currency)) },
    { id: 'warranty', header: 'Garantie', sortBy: (row) => row.warrantyEndsOn, cell: (row) => warrantyLabel(row, data.asOf).label },
    { id: 'maintenance', header: 'Entretien', sortBy: (row) => row.nextMaintenanceOn, cell: (row) => (row.nextMaintenanceOn ? formatDate(row.nextMaintenanceOn) : '—') },
    {
      id: 'status',
      header: 'État',
      sortBy: (row) => row.status,
      cell: (row) => <Badge tone={row.status === 'en_service' ? 'success' : 'danger'}>{row.status === 'en_service' ? 'En service' : 'Hors service'}</Badge>,
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
              { id: 'open', label: 'Ouvrir', icon: Wrench, href: biensPaths.equipement(row.id) },
              { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => { setRemoving(row); } },
            ]}
          />
        ) : (
          <RowActions
            name={row.name}
            primary={row.status === 'hors_service' ? { label: 'Remplacer', href: biensPaths.newEquipement } : { label: 'Ouvrir', href: biensPaths.equipement(row.id) }}
            items={[
              { id: 'open', label: 'Ouvrir', icon: Wrench, href: biensPaths.equipement(row.id) },
              { id: 'edit', label: 'Modifier', icon: Pencil, href: biensPaths.editEquipement(row.id) },
              { id: 'intervention', label: 'Créer une intervention', icon: Wrench, href: externalPaths.newIntervention },
              { id: 'maintenance', label: 'Planifier l’entretien', icon: CalendarClock, href: biensPaths.equipement(row.id, 'entretien') },
              { id: 'invoice', label: 'Ajouter une facture', icon: FilePlus, href: biensPaths.equipement(row.id, 'documents') },
              { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { setArchiving(row); } },
              { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setRemoving(row); } },
            ]}
          />
        ),
    },
  ];

  const restart = () => { list.restart(); };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: 'Équipements' }]}
        title="Équipements"
        subtitle="Appareils et installations de chaque bien : date d’achat, garantie, entretien et remplacement."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={query.data === undefined || query.data.items.length === 0}
              onClick={() => {
                if (query.data) downloadFile('equipements.csv', equipementsToCsv(query.data.items, query.data.currency));
              }}
            >
              Exporter
            </Button>
            <Button asChild>
              <Link href={biensPaths.newEquipement}>Nouvel équipement</Link>
            </Button>
          </>
        }
      />
      <QueryBoundary
        query={query}
        errorTitle="Les équipements n’ont pas pu être chargés"
        skeleton={<SkeletonRows rows={6} label="Chargement des équipements" />}
      >
        {(data) => {
          const live = data.items.filter((row) => !row.archived);
          const running = live.filter((row) => row.status === 'en_service');
          const broken = live.filter((row) => row.status === 'hors_service');
          const archived = data.items.filter((row) => row.archived);
          const pool = view === 'service' ? running : view === 'hors' ? broken : archived;
          const places = [...new Set(data.items.map((row) => row.placeName))].sort((a, b) => a.localeCompare(b, 'fr'));
          const filtered = pool.filter(
            (row) =>
              matches(search, row.name, row.detail, row.brand, row.model, row.placeName) &&
              (place === '' || row.placeName === place) &&
              (family === '' || row.family === family) &&
              (flags.length === 0 || flags.every((flag) => hasFlag(row, flag, data.asOf))),
          );
          const hasFilters = search !== '' || place !== '' || family !== '' || flags.length > 0;
          const alert = broken[0];
          return (
            <>
              {alert ? (
                <Alert tone="warning" title={`${alert.name} hors service, ${alert.placeName}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{alert.warrantyEndsOn !== null && alert.warrantyEndsOn < data.asOf ? 'Garantie expirée. ' : ''}Une intervention est à suivre.</span>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={externalPaths.interventions}>Voir l’intervention</Link>
                    </Button>
                  </span>
                </Alert>
              ) : null}
              <Tabs value={view} defaultValue="service" onValueChange={(next) => { setView(next === 'hors' ? 'hors' : next === 'archives' ? 'archives' : 'service'); restart(); }}>
                <TabList aria-label="Vues des équipements">
                  <Tab value="service" count={running.length}>En service</Tab>
                  <Tab value="hors" count={broken.length}>Hors service</Tab>
                  <Tab value="archives" count={archived.length}>Archives</Tab>
                </TabList>
              <TabPanel value={view} className="flex flex-col gap-3 pt-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-full sm:w-64">
                  <TextField label="Rechercher un équipement" hideLabel type="search" placeholder="Nom, marque ou bien" value={search} onChange={(event) => { setSearch(event.target.value); restart(); }} className="pl-8" />
                  <Icon icon={Search} className="pointer-events-none absolute top-2 left-2.5 text-fg-subtle" />
                </div>
                <Select label="Bien" hideLabel placeholder="Bien : tous" options={[{ value: '', label: 'Tous les biens' }, ...places.map((entry) => ({ value: entry, label: entry }))]} value={place} onValueChange={(next) => { setPlace(next); restart(); }} className="w-48" />
                <Select label="Famille" hideLabel placeholder="Famille : toutes" options={[{ value: '', label: 'Toutes les familles' }, ...FAMILIES.map((entry) => ({ value: entry, label: FAMILY_LABELS[entry] }))]} value={family} onValueChange={(next) => { setFamily(next); restart(); }} className="w-48" />
                <div role="group" aria-label="Filtrer par état" className="flex flex-wrap gap-1.5">
                  {FLAGS.map((flag) => (
                    <Chip
                      key={flag.id}
                      pressed={flags.includes(flag.id)}
                      onClick={() => {
                        setFlags((current) => (current.includes(flag.id) ? current.filter((entry) => entry !== flag.id) : [...current, flag.id]));
                        restart();
                      }}
                    >
                      {flag.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <DataTable
                label={view === 'archives' ? 'Équipements archivés' : 'Liste des équipements'}
                rows={filtered}
                columns={columns(data)}
                getId={(row) => row.id}
                list={list}
                empty={
                  <EmptyState
                    icon={Wrench}
                    title={hasFilters ? 'Aucun équipement ne correspond' : view === 'service' ? 'Aucun équipement pour le moment' : view === 'hors' ? 'Aucun équipement hors service' : 'Aucun équipement archivé'}
                    description={hasFilters ? 'Modifiez ou retirez des filtres pour élargir la recherche.' : 'Ajoutez un appareil pour suivre sa garantie et son entretien.'}
                  >
                    {hasFilters ? (
                      <Button variant="secondary" onClick={() => { setSearch(''); setPlace(''); setFamily(''); setFlags([]); restart(); }}>
                        Réinitialiser les filtres
                      </Button>
                    ) : view === 'service' ? (
                      <Button asChild>
                        <Link href={biensPaths.newEquipement}>Nouvel équipement</Link>
                      </Button>
                    ) : null}
                  </EmptyState>
                }
              />
              <p className="text-caption text-fg-subtle">{`${plural(filtered.length, 'équipement affiché', 'équipements affichés')}.`}</p>
              </TabPanel>
              </Tabs>
            </>
          );
        }}
      </QueryBoundary>
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => { if (!open) setArchiving(null); }}
        title="Archiver cet équipement ?"
        description={archiving ? `« ${archiving.name} » quittera la liste des équipements en service. Vous pourrez le restaurer depuis l’onglet Archives.` : ''}
        confirmLabel="Archiver"
        loading={archive.isPending}
        onConfirm={() => { if (archiving) archive.execute({ id: archiving.id, archived: true }); }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Supprimer cet équipement ?"
        description={removing ? `« ${removing.name} » et ses documents seront supprimés définitivement. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.execute(removing.id); }}
      />
    </>
  );
}
