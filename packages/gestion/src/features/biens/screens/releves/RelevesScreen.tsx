'use client';

import { Archive, ArchiveRestore, Camera, Gauge, Pencil, Search, Trash2, Calculator } from 'lucide-react';
import { Badge, Button, Chip, ConfirmDialog, EmptyState, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { ReadingDialog } from '../../components/ReadingDialog';
import { RowActions } from '../../components/RowActions';
import { useBiensEnvironment } from '../../environment';
import { useCommand } from '../../hooks/useCommand';
import { useListState } from '../../hooks/useListState';
import { formatNumber } from '../../lib/amount';
import { formatDate } from '../../lib/dates';
import { downloadFile, toCsv } from '../../lib/files';
import { METER_LABELS, REASON_LABELS } from '../../lib/labels';
import { matches } from '../../lib/text';
import { biensPaths, externalPaths } from '../../paths';
import { useReadings } from '../../queries';
import { REASONS } from '../../schemas/releves';
import type { Meter, Reading, ReadingsData } from '../../schemas/releves';
import { formatMoney } from '../../../../format/money';

type View = 'actifs' | 'archives';
type Group = 'eau' | 'electricite' | 'gaz';

const GROUPS: { id: Group; label: string; kinds: readonly Reading['kind'][] }[] = [
  { id: 'eau', label: 'Eau', kinds: ['eau_froide', 'eau_chaude'] },
  { id: 'electricite', label: 'Électricité', kinds: ['electricite'] },
  { id: 'gaz', label: 'Gaz', kinds: ['gaz'] },
];

const describeMeter = (meter: Meter): string => `${METER_LABELS[meter.kind]} ${meter.ref}`;

export function RelevesScreen() {
  const { Link } = useBiensEnvironment();
  const query = useReadings();
  const [view, setView] = useState<View>('actifs');
  const [search, setSearch] = useState('');
  const [place, setPlace] = useState('');
  const [reason, setReason] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Reading | null>(null);
  const [archiving, setArchiving] = useState<Reading | null>(null);
  const [removing, setRemoving] = useState<Reading | null>(null);
  const list = useListState({ key: 'date', direction: 'desc' });

  const archive = useCommand((source, input: { id: string; archived: boolean }) => source.setReadingArchived(input.id, input.archived), {
    success: (_result, input) => (input.archived ? 'Relevé archivé' : 'Relevé restauré'),
    onDone: () => { setArchiving(null); },
  });
  const remove = useCommand((source, id: string) => source.deleteReading(id), {
    success: () => 'Relevé supprimé',
    onDone: () => { setRemoving(null); },
  });
  const attach = useCommand((source, id: string) => source.attachReadingPhoto(id), { success: () => 'Photo jointe au relevé' });

  const restart = () => { list.restart(); };

  const columns = (data: ReadingsData): Column<Reading>[] => [
    {
      id: 'meter',
      header: 'Compteur',
      strong: true,
      sortBy: (row) => `${METER_LABELS[row.kind]} ${row.meterRef}`,
      cell: (row) => `${METER_LABELS[row.kind]} ${row.meterRef}`,
    },
    { id: 'lot', header: 'Bien', sortBy: (row) => row.lotName, cell: (row) => <Link href={biensPaths.lot(row.lotId, 'compteurs')} className="hover:underline">{row.lotName}</Link> },
    { id: 'tenant', header: 'Locataire', sortBy: (row) => row.tenant, cell: (row) => row.tenant ?? <span className="text-fg-subtle">Sans locataire</span> },
    { id: 'reason', header: 'Motif', sortBy: (row) => REASON_LABELS[row.reason], cell: (row) => <Badge tone={row.reason === 'en_cours_de_bail' ? 'neutral' : 'info'}>{REASON_LABELS[row.reason]}</Badge> },
    { id: 'date', header: 'Date', sortBy: (row) => row.date, cell: (row) => formatDate(row.date) },
    { id: 'index', header: 'Index', numeric: true, sortBy: (row) => row.index, cell: (row) => `${formatNumber(row.index, 1)} ${row.unit}` },
    { id: 'delta', header: 'Consommation', numeric: true, sortBy: (row) => row.delta, cell: (row) => (row.delta === null ? '—' : `${formatNumber(row.delta, 1)} ${row.unit}`) },
    { id: 'cost', header: 'Coût', numeric: true, sortBy: (row) => row.cost, cell: (row) => (row.cost === null ? '—' : formatMoney(row.cost, data.currency)) },
    {
      id: 'actions',
      header: 'Action',
      hideHeader: true,
      cell: (row) =>
        row.archived ? (
          <RowActions
            name={`${METER_LABELS[row.kind]} ${row.lotName}`}
            items={[
              { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, onSelect: () => { archive.execute({ id: row.id, archived: false }); } },
              { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => { setRemoving(row); } },
            ]}
          />
        ) : (
          <RowActions
            name={`${METER_LABELS[row.kind]} ${row.lotName}`}
            primary={{ label: 'Ouvrir', href: biensPaths.lot(row.lotId, 'compteurs') }}
            items={[
              { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => { setEditing(row); } },
              { id: 'photo', label: 'Joindre une photo', icon: Camera, disabled: row.hasPhoto, onSelect: () => { attach.execute(row.id); } },
              { id: 'regularisation', label: 'Utiliser pour la régularisation', icon: Calculator, href: externalPaths.regularisation },
              { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { setArchiving(row); } },
              { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setRemoving(row); } },
            ]}
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: 'Relevés de compteurs' }]}
        title="Relevés de compteurs"
        subtitle="Index relevés à l’entrée, à la sortie et en cours de bail. Les consommations alimentent la régularisation des charges."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={query.data === undefined || query.data.items.length === 0}
              onClick={() => {
                if (!query.data) return;
                downloadFile(
                  'releves.csv',
                  toCsv([
                    ['Compteur', 'Bien', 'Locataire', 'Motif', 'Date', 'Index', 'Unité', 'Consommation', 'Origine', 'Archivé'],
                    ...query.data.items.map((item) => [
                      `${METER_LABELS[item.kind]} ${item.meterRef}`,
                      item.lotName,
                      item.tenant ?? '',
                      REASON_LABELS[item.reason],
                      formatDate(item.date),
                      String(item.index).replace('.', ','),
                      item.unit,
                      item.delta === null ? '' : String(item.delta).replace('.', ','),
                      item.origin,
                      item.archived ? 'Oui' : 'Non',
                    ]),
                  ]),
                );
              }}
            >
              Exporter
            </Button>
            <Button
              disabled={query.data === undefined || query.data.meters.length === 0}
              onClick={() => { setCreating(true); }}
            >
              Nouveau relevé
            </Button>
          </>
        }
      />
      <QueryBoundary query={query} errorTitle="Les relevés n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des relevés" />}>
        {(data) => {
          const active = data.items.filter((item) => !item.archived);
          const archived = data.items.filter((item) => item.archived);
          const pool = view === 'actifs' ? active : archived;
          const places = [...new Set(data.items.map((item) => item.lotName))].sort((a, b) => a.localeCompare(b, 'fr'));
          const kinds = groups.flatMap((group) => GROUPS.find((entry) => entry.id === group)?.kinds ?? []);
          const filtered = pool.filter(
            (item) =>
              matches(search, item.lotName, item.meterRef, METER_LABELS[item.kind], item.tenant) &&
              (place === '' || item.lotName === place) &&
              (reason === '' || item.reason === reason) &&
              (kinds.length === 0 || kinds.includes(item.kind)),
          );
          const hasFilters = search !== '' || place !== '' || reason !== '' || groups.length > 0;
          return (
            <>
              <Tabs value={view} defaultValue="actifs" onValueChange={(next) => { setView(next === 'archives' ? 'archives' : 'actifs'); restart(); }}>
                <TabList aria-label="Vues des relevés">
                  <Tab value="actifs" count={active.length}>Actifs</Tab>
                  <Tab value="archives" count={archived.length}>Archives</Tab>
                </TabList>
              <TabPanel value={view} className="flex flex-col gap-3 pt-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-full sm:w-64">
                  <TextField label="Rechercher un relevé" hideLabel type="search" placeholder="Bien, compteur ou locataire" value={search} onChange={(event) => { setSearch(event.target.value); restart(); }} className="pl-8" />
                  <Icon icon={Search} className="pointer-events-none absolute top-2 left-2.5 text-fg-subtle" />
                </div>
                <Select label="Bien" hideLabel placeholder="Bien : tous" options={[{ value: '', label: 'Tous les biens' }, ...places.map((entry) => ({ value: entry, label: entry }))]} value={place} onValueChange={(next) => { setPlace(next); restart(); }} className="w-44" />
                <Select label="Motif" hideLabel placeholder="Motif : tous" options={[{ value: '', label: 'Tous les motifs' }, ...REASONS.map((entry) => ({ value: entry, label: REASON_LABELS[entry] }))]} value={reason} onValueChange={(next) => { setReason(next); restart(); }} className="w-48" />
                <div role="group" aria-label="Filtrer par énergie" className="flex flex-wrap gap-1.5">
                  {GROUPS.map((group) => (
                    <Chip
                      key={group.id}
                      pressed={groups.includes(group.id)}
                      onClick={() => {
                        setGroups((current) => (current.includes(group.id) ? current.filter((entry) => entry !== group.id) : [...current, group.id]));
                        restart();
                      }}
                    >
                      {group.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <DataTable
                label={view === 'actifs' ? 'Liste des relevés' : 'Relevés archivés'}
                rows={filtered}
                columns={columns(data)}
                getId={(row) => row.id}
                list={list}
                empty={
                  <EmptyState
                    icon={Gauge}
                    title={hasFilters ? 'Aucun relevé ne correspond' : view === 'actifs' ? 'Aucun relevé pour le moment' : 'Aucun relevé archivé'}
                    description={hasFilters ? 'Modifiez ou retirez des filtres pour élargir la recherche.' : 'Enregistrez l’index d’un compteur pour suivre les consommations.'}
                  >
                    {hasFilters ? (
                      <Button variant="secondary" onClick={() => { setSearch(''); setPlace(''); setReason(''); setGroups([]); restart(); }}>
                        Réinitialiser les filtres
                      </Button>
                    ) : null}
                  </EmptyState>
                }
              />
              <ReadingDialog open={creating} onOpenChange={setCreating} meters={data.meters} describe={describeMeter} />
              <ReadingDialog
                key={editing?.id ?? 'none'}
                open={editing !== null}
                onOpenChange={(open) => { if (!open) setEditing(null); }}
                meters={data.meters}
                describe={describeMeter}
                reading={editing ?? undefined}
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
        title="Archiver ce relevé ?"
        description={archiving ? `Le relevé du ${formatDate(archiving.date)} (${archiving.lotName}) quittera la liste active.` : ''}
        confirmLabel="Archiver"
        loading={archive.isPending}
        onConfirm={() => { if (archiving) archive.execute({ id: archiving.id, archived: true }); }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Supprimer ce relevé ?"
        description={removing ? `Le relevé du ${formatDate(removing.date)} (${removing.lotName}) sera supprimé définitivement ; la consommation du relevé suivant sera recalculée.` : ''}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.execute(removing.id); }}
      />
    </>
  );
}
