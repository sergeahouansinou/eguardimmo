'use client';

import { Archive, ArchiveRestore, ClipboardList, Copy, Download, Pencil, PenLine, Search, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { RowActions } from '../../components/RowActions';
import { useCommand } from '../../hooks/useCommand';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { downloadFile } from '../../lib/files';
import { matches } from '../../lib/text';
import { biensPaths } from '../../paths';
import { useInventaires, useLots } from '../../queries';
import type { Inventaire, InventairesData } from '../../schemas/releves';
import { formatMoney } from '../../../../format/money';
import { InventaireDialog } from './InventaireDialog';

type View = 'actifs' | 'archives';

export function InventairesScreen() {
  const query = useInventaires();
  const lots = useLots();
  const [view, setView] = useState<View>('actifs');
  const [search, setSearch] = useState('');
  const [place, setPlace] = useState('');
  const [template, setTemplate] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Inventaire | null>(null);
  const [archiving, setArchiving] = useState<Inventaire | null>(null);
  const [removing, setRemoving] = useState<Inventaire | null>(null);
  const list = useListState({ key: 'createdOn', direction: 'desc' });

  const archive = useCommand((source, input: { id: string; archived: boolean }) => source.setInventaireArchived(input.id, input.archived), {
    success: (_result, input) => (input.archived ? 'Inventaire archivé' : 'Inventaire restauré'),
    onDone: () => { setArchiving(null); },
  });
  const duplicate = useCommand((source, id: string) => source.duplicateInventaire(id), { success: () => 'Inventaire dupliqué' });
  const sign = useCommand((source, item: Inventaire) => source.requestInventaireSignature(item.id), {
    success: (_result, item) => `Demande de signature envoyée à ${item.tenant ?? 'le locataire'}`,
  });
  const remove = useCommand((source, id: string) => source.deleteInventaire(id), {
    success: () => 'Inventaire supprimé',
    onDone: () => { setRemoving(null); },
  });

  const restart = () => { list.restart(); };

  const columns = (data: InventairesData): Column<Inventaire>[] => [
    {
      id: 'ref',
      header: 'Identifiant',
      strong: true,
      sortBy: (row) => row.ref,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {row.ref}
          {row.signatureSentOn ? <Badge tone="info">{`Signature demandée le ${formatDate(row.signatureSentOn)}`}</Badge> : null}
        </span>
      ),
    },
    { id: 'lot', header: 'Bien', sortBy: (row) => row.lotName, cell: (row) => `${row.lotName}, ${row.immeubleName}` },
    { id: 'tenant', header: 'Locataire', sortBy: (row) => row.tenant, cell: (row) => row.tenant ?? '—' },
    { id: 'value', header: 'Valeur', numeric: true, sortBy: (row) => row.value, cell: (row) => formatMoney(row.value, data.currency) },
    { id: 'createdOn', header: 'Créé le', sortBy: (row) => row.createdOn, cell: (row) => formatDate(row.createdOn) },
    { id: 'template', header: 'Modèle', sortBy: (row) => row.template, cell: (row) => row.template },
    {
      id: 'actions',
      header: 'Action',
      hideHeader: true,
      cell: (row) => {
        const pdf = {
          id: 'pdf',
          label: 'Télécharger le PDF',
          icon: Download,
          onSelect: () => {
            downloadFile(`${row.ref.toLowerCase()}.txt`, `Inventaire ${row.ref}\r\nBien : ${row.lotName}, ${row.immeubleName}\r\nLocataire : ${row.tenant ?? 'non renseigné'}\r\nModèle : ${row.template}\r\nValeur : ${formatMoney(row.value, data.currency)}\r\nCréé le ${formatDate(row.createdOn)}\r\n`, 'text/plain;charset=utf-8');
          },
        };
        return row.archived ? (
          <RowActions
            name={row.ref}
            items={[
              { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, onSelect: () => { archive.execute({ id: row.id, archived: false }); } },
              pdf,
              { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => { setRemoving(row); } },
            ]}
          />
        ) : (
          <RowActions
            name={row.ref}
            items={[
              { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => { setEditing(row); } },
              pdf,
              { id: 'sign', label: 'Envoyer pour signature', icon: PenLine, onSelect: () => { sign.execute(row); } },
              { id: 'duplicate', label: 'Dupliquer', icon: Copy, onSelect: () => { duplicate.execute(row.id); } },
              { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { setArchiving(row); } },
              { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setRemoving(row); } },
            ]}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: 'Inventaires' }]}
        title="Inventaires"
        subtitle="Inventaire du mobilier fourni par bien, avec sa valeur. Il sert de référence à la sortie du locataire."
        actions={
          <Button disabled={query.data === undefined || lots.data === undefined} onClick={() => { setCreating(true); }}>
            Nouvel inventaire
          </Button>
        }
      />
      <QueryBoundary query={query} errorTitle="Les inventaires n’ont pas pu être chargés" skeleton={<SkeletonRows rows={5} label="Chargement des inventaires" />}>
        {(data) => {
          const active = data.items.filter((item) => !item.archived);
          const archived = data.items.filter((item) => item.archived);
          const pool = view === 'actifs' ? active : archived;
          const places = [...new Set(data.items.map((item) => item.lotName))].sort((a, b) => a.localeCompare(b, 'fr'));
          const filtered = pool.filter(
            (item) =>
              matches(search, item.lotName, item.immeubleName, item.tenant, item.ref) &&
              (place === '' || item.lotName === place) &&
              (template === '' || item.template === template),
          );
          const hasFilters = search !== '' || place !== '' || template !== '';
          return (
            <>
              <Tabs value={view} defaultValue="actifs" onValueChange={(next) => { setView(next === 'archives' ? 'archives' : 'actifs'); restart(); }}>
                <TabList aria-label="Vues des inventaires">
                  <Tab value="actifs" count={active.length}>Actifs</Tab>
                  <Tab value="archives" count={archived.length}>Archives</Tab>
                </TabList>
              <TabPanel value={view} className="flex flex-col gap-3 pt-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-full sm:w-64">
                  <TextField label="Rechercher un inventaire" hideLabel type="search" placeholder="Bien, locataire ou identifiant" value={search} onChange={(event) => { setSearch(event.target.value); restart(); }} className="pl-8" />
                  <Icon icon={Search} className="pointer-events-none absolute top-2 left-2.5 text-fg-subtle" />
                </div>
                <Select label="Bien" hideLabel placeholder="Tous les biens" options={[{ value: '', label: 'Tous les biens' }, ...places.map((entry) => ({ value: entry, label: entry }))]} value={place} onValueChange={(next) => { setPlace(next); restart(); }} className="w-44" />
                <Select label="Modèle" hideLabel placeholder="Tous les modèles" options={[{ value: '', label: 'Tous les modèles' }, ...data.templates.map((entry) => ({ value: entry, label: entry }))]} value={template} onValueChange={(next) => { setTemplate(next); restart(); }} className="w-48" />
              </div>
              <DataTable
                label={view === 'actifs' ? 'Liste des inventaires' : 'Inventaires archivés'}
                rows={filtered}
                columns={columns(data)}
                getId={(row) => row.id}
                list={list}
                empty={
                  <EmptyState
                    icon={ClipboardList}
                    title={hasFilters ? 'Aucun inventaire ne correspond' : view === 'actifs' ? 'Aucun inventaire pour le moment' : 'Aucun inventaire archivé'}
                    description={hasFilters ? 'Modifiez ou retirez des filtres pour élargir la recherche.' : 'Créez l’inventaire du mobilier d’un bien meublé.'}
                  >
                    {hasFilters ? (
                      <Button variant="secondary" onClick={() => { setSearch(''); setPlace(''); setTemplate(''); restart(); }}>
                        Réinitialiser les filtres
                      </Button>
                    ) : null}
                  </EmptyState>
                }
              />
              {lots.data ? (
                <>
                  <InventaireDialog open={creating} onOpenChange={setCreating} currency={data.currency} lots={lots.data.items} templates={data.templates} />
                  <InventaireDialog
                    key={editing?.id ?? 'none'}
                    open={editing !== null}
                    onOpenChange={(open) => { if (!open) setEditing(null); }}
                    currency={data.currency}
                    lots={lots.data.items}
                    templates={data.templates}
                    inventaire={editing ?? undefined}
                  />
                </>
              ) : null}
              </TabPanel>
              </Tabs>
            </>
          );
        }}
      </QueryBoundary>
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => { if (!open) setArchiving(null); }}
        title="Archiver cet inventaire ?"
        description={archiving ? `${archiving.ref} (${archiving.lotName}) quittera la liste active. Vous pourrez le restaurer depuis l’onglet Archives.` : ''}
        confirmLabel="Archiver"
        loading={archive.isPending}
        onConfirm={() => { if (archiving) archive.execute({ id: archiving.id, archived: true }); }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Supprimer cet inventaire ?"
        description={removing ? `${removing.ref} (${removing.lotName}) sera supprimé définitivement. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.execute(removing.id); }}
      />
    </>
  );
}
