'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore, Download, Eye, EyeOff, FolderInput, Pencil, Share2, Trash2 } from 'lucide-react';
import { Button, Card, Checkbox, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import {
  ConfirmDialog,
  DataTable,
  EmptyBlock,
  FilterChip,
  PageHeader,
  pushFlash,
  QueryState,
  SortTh,
  Td,
  Th,
  useSourceMutation,
} from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { ALL, bienOptions, bienShort, matchesBien } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { formatSize } from '../shared/files';
import { usePaging } from '../shared/paging';
import { nextSort, sortItems } from '../shared/sort';
import type { SortState } from '../shared/sort';
import { matchesQuery } from '../shared/text';
import { BulkBar, FilterSelect, Notice, PaginationBar, RowMenu, selectionLabel, Toolbar } from '../shared/ui';
import type { RowAction } from '../shared/ui';
import { DocumentDetailDialog, DocumentEditDialog } from './DocumentDialogs';
import type { EditMode } from './DocumentDialogs';
import { compareDocuments } from './logic';
import type { SortKey } from './logic';
import type { DocumentPatch, DocumentRecord } from './schemas';
import { ShareToggle } from './ShareToggle';
import { DOCUMENTS_KEY, useDocuments, useDocumentsSource } from './source';

type TabKey = 'actifs' | 'archives';
type ShareFilter = 'tous' | 'partage' | 'prive';

const SHARE_OPTIONS = [
  { value: 'partage', label: 'Partagé avec le locataire' },
  { value: 'prive', label: 'Privé' },
] as const;

const DOWNLOAD_NOTICE = 'Le téléchargement sera disponible avec le stockage des fichiers : en démonstration, seules les informations des documents sont conservées.';

export function DocumentsPage({ Link }: ScreenProps) {
  const query = useDocuments();
  const source = useDocumentsSource();
  const [tab, setTab] = useState<TabKey>('actifs');
  const [search, setSearch] = useState('');
  const [bien, setBien] = useState(ALL);
  const [share, setShare] = useState<ShareFilter>('tous');
  const [sort, setSort] = useState<SortState<SortKey>>({ key: null, direction: 'asc' });
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [toDelete, setToDelete] = useState<readonly DocumentRecord[]>([]);
  const [detail, setDetail] = useState<DocumentRecord | null>(null);
  const [editing, setEditing] = useState<{ document: DocumentRecord; mode: EditMode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = [DOCUMENTS_KEY] as const;
  const setShared = useSourceMutation((input: { ids: readonly string[]; shared: boolean }) => source.setShared(input.ids, input.shared), invalidate);
  const setArchived = useSourceMutation((input: { ids: readonly string[]; archived: boolean }) => source.setArchived(input.ids, input.archived), invalidate);
  const update = useSourceMutation((input: { id: string; patch: DocumentPatch }) => source.update(input.id, input.patch), invalidate);
  const remove = useSourceMutation((ids: readonly string[]) => source.remove(ids), invalidate);
  const fail = () => { setError('L’action n’a pas abouti. Réessayez dans un instant.'); };

  const all = query.data ?? [];
  const activeCount = all.filter((item) => !item.archived).length;
  const filtered = all.filter((item) => {
    if (item.archived !== (tab === 'archives')) return false;
    if (!matchesQuery(search, item.fileName)) return false;
    if (!matchesBien(item.bienId, bien)) return false;
    if (share === 'partage' && !item.shared) return false;
    if (share === 'prive' && item.shared) return false;
    return true;
  });
  const ordered = sortItems(filtered, sort, compareDocuments);
  const paging = usePaging(ordered, 10);
  const filtering = search !== '' || bien !== ALL || share !== 'tous';
  const selectedDocs = ordered.filter((item) => selected.includes(item.id));
  const pageIds = paging.pageItems.map((item) => item.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    paging.reset();
  };
  const plural = (count: number) => (count > 1 ? 's' : '');
  const shareDocs = (docs: readonly DocumentRecord[], shared: boolean) => {
    setShared.mutate(
      { ids: docs.map((item) => item.id), shared },
      {
        onSuccess: () => {
          const count = docs.length;
          pushFlash(shared ? `${String(count)} document${plural(count)} partagé${plural(count)} avec le locataire.` : `${String(count)} document${plural(count)} maintenant privé${plural(count)}.`);
        },
        onError: fail,
      },
    );
  };
  const archive = (docs: readonly DocumentRecord[], archived: boolean) => {
    setArchived.mutate(
      { ids: docs.map((item) => item.id), archived },
      {
        onSuccess: () => {
          const count = docs.length;
          pushFlash(archived ? `${String(count)} document${plural(count)} archivé${plural(count)}.` : `${String(count)} document${plural(count)} désarchivé${plural(count)}.`);
          setSelected([]);
        },
        onError: fail,
      },
    );
  };
  const sortHeader = (key: SortKey, label: string, numeric = false) => (
    <SortTh
      label={label}
      numeric={numeric}
      active={sort.key === key}
      direction={sort.direction}
      onSort={() => {
        setSort(nextSort(sort, key));
        paging.reset();
      }}
    />
  );
  const chip = (value: Exclude<ShareFilter, 'tous'>) => (pressed: boolean) => {
    setShare(pressed ? value : 'tous');
    paging.reset();
  };

  const actionsFor = (item: DocumentRecord): RowAction[] => [
    { id: 'open', label: 'Ouvrir', icon: Eye, onSelect: () => { setDetail(item); } },
    { id: 'download', label: 'Télécharger', icon: Download, onSelect: () => { setNotice(DOWNLOAD_NOTICE); } },
    {
      id: 'share',
      label: item.shared ? 'Rendre privé' : 'Partager avec le locataire',
      icon: item.shared ? EyeOff : Share2,
      onSelect: () => { shareDocs([item], !item.shared); },
    },
    { id: 'rename', label: 'Renommer', icon: Pencil, onSelect: () => { setEditing({ document: item, mode: 'rename' }); } },
    { id: 'attach', label: 'Rattacher à un bien', icon: FolderInput, onSelect: () => { setEditing({ document: item, mode: 'attach' }); } },
    {
      id: 'archive',
      label: item.archived ? 'Désarchiver' : 'Archiver',
      icon: item.archived ? ArchiveRestore : Archive,
      separatorBefore: true,
      onSelect: () => { archive([item], !item.archived); },
    },
    { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setToDelete([item]); } },
  ];

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Documents' }]}
        title="Documents"
        description="Chaque document a un bien, un partage et une date. Les documents partagés sont visibles par le locataire."
        actions={
          <Button asChild>
            <Link href="/documents/nouveau">Importer des documents</Link>
          </Button>
        }
      />
      <Notice tone="danger" message={error} onDismiss={() => { setError(null); }} />
      <Notice message={notice} onDismiss={() => { setNotice(null); }} />
      <Card role="region" aria-label="Liste des documents">
        <Tabs
          value={tab}
          defaultValue="actifs"
          onValueChange={(value) => {
            setTab(value === 'archives' ? 'archives' : 'actifs');
            setSelected([]);
            paging.reset();
          }}
        >
          <TabList aria-label="Documents">
            <Tab value="actifs" count={query.data ? activeCount : undefined}>Actifs</Tab>
            <Tab value="archives" count={query.data ? all.length - activeCount : undefined}>Archives</Tab>
          </TabList>
          <TabPanel value={tab} className="flex flex-col gap-2">
            <Toolbar>
              <div className="w-full sm:w-60">
                <TextField
                  label="Rechercher"
                  hideLabel
                  placeholder="Nom du fichier"
                  type="search"
                  value={search}
                  onChange={(event) => { touch(setSearch)(event.target.value); }}
                />
              </div>
              <FilterSelect label="Bien" allLabel="Bien : Tous" options={bienOptions('short')} value={bien} onValueChange={touch(setBien)} />
              <FilterSelect
                label="Partage"
                allLabel="Partage : Tous"
                options={SHARE_OPTIONS}
                value={share}
                onValueChange={(value) => { touch(setShare)(value === 'partage' ? 'partage' : value === 'prive' ? 'prive' : 'tous'); }}
                className="sm:w-52"
              />
              <div className="flex flex-wrap gap-1.5 pb-0.5" role="group" aria-label="Filtrer par partage">
                <FilterChip pressed={share === 'partage'} onPressedChange={chip('partage')}>Partagé avec le locataire</FilterChip>
                <FilterChip pressed={share === 'prive'} onPressedChange={chip('prive')}>Privé</FilterChip>
              </div>
            </Toolbar>
            {selectedDocs.length > 0 ? (
              <BulkBar summary={selectionLabel(selectedDocs.length, 'document')}>
                <Button variant="secondary" size="sm" loading={setShared.isPending} onClick={() => { shareDocs(selectedDocs, true); }}>Partager</Button>
                <Button variant="ghost" size="sm" loading={setShared.isPending} onClick={() => { shareDocs(selectedDocs, false); }}>Rendre privé</Button>
                <Button variant="ghost" size="sm" onClick={() => { setNotice(DOWNLOAD_NOTICE); }}>Télécharger</Button>
                <Button variant="ghost" size="sm" loading={setArchived.isPending} onClick={() => { archive(selectedDocs, tab === 'actifs'); }}>
                  {tab === 'actifs' ? 'Archiver' : 'Désarchiver'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setToDelete(selectedDocs); }}>Supprimer</Button>
              </BulkBar>
            ) : null}
            <QueryState query={query} errorTitle="Les documents n’ont pas pu être chargés" loadingLabel="Chargement des documents">
              {() =>
                ordered.length === 0 ? (
                  <EmptyBlock
                    title={filtering ? 'Aucun document ne correspond' : tab === 'archives' ? 'Aucun document archivé' : 'Aucun document'}
                    action={
                      filtering ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setBien(ALL);
                            setShare('tous');
                            paging.reset();
                          }}
                        >
                          Réinitialiser les filtres
                        </Button>
                      ) : tab === 'actifs' ? (
                        <Button size="sm" asChild><Link href="/documents/nouveau">Importer des documents</Link></Button>
                      ) : undefined
                    }
                  >
                    {filtering ? 'Modifiez la recherche ou les filtres.' : 'Importez vos baux, états des lieux et diagnostics.'}
                  </EmptyBlock>
                ) : (
                  <>
                    <DataTable caption="Documents">
                      <thead>
                        <tr>
                          <Th className="w-8">
                            <Checkbox
                              label="Sélectionner tous les documents de la page"
                              hideLabel
                              checked={allOnPage}
                              onChange={(event) => {
                                setSelected(event.target.checked ? [...new Set([...selected, ...pageIds])] : selected.filter((id) => !pageIds.includes(id)));
                              }}
                            />
                          </Th>
                          {sortHeader('fileName', 'Fichier')}
                          {sortHeader('bien', 'Bien')}
                          <Th>Description</Th>
                          <Th>Partagé avec</Th>
                          <Th>Partage</Th>
                          {sortHeader('size', 'Taille', true)}
                          {sortHeader('date', 'Date')}
                          <Th><span className="sr-only">Actions</span></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {paging.pageItems.map((item) => (
                          <tr key={item.id} className={selected.includes(item.id) ? 'bg-action-subtle' : undefined}>
                            <Td>
                              <Checkbox
                                label={`Sélectionner ${item.fileName}`}
                                hideLabel
                                checked={selected.includes(item.id)}
                                onChange={(event) => {
                                  setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id));
                                }}
                              />
                            </Td>
                            <Td strong>{item.fileName}</Td>
                            <Td>{item.bienId ? bienShort(item.bienId) : '—'}</Td>
                            <Td>{item.description === '' ? '—' : item.description}</Td>
                            <Td>{item.sharedWith ?? '—'}</Td>
                            <Td>
                              <ShareToggle
                                checked={item.shared}
                                label={`${item.shared ? 'Partagé' : 'Privé'} : ${item.fileName}`}
                                onCheckedChange={(checked) => { shareDocs([item], checked); }}
                              />
                            </Td>
                            <Td numeric>{formatSize(item.sizeBytes)}</Td>
                            <Td>{formatFrDate(item.date)}</Td>
                            <Td>
                              <span className="flex items-center justify-end gap-1">
                                <Button variant="link" size="sm" aria-label={`Ouvrir ${item.fileName}`} onClick={() => { setDetail(item); }}>Ouvrir</Button>
                                <RowMenu label={`Plus d’actions, ${item.fileName}`} actions={actionsFor(item)} />
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                    <PaginationBar paging={paging} label="Pagination des documents" />
                  </>
                )
              }
            </QueryState>
          </TabPanel>
        </Tabs>
      </Card>
      <DocumentDetailDialog document={detail} onClose={() => { setDetail(null); }} />
      <DocumentEditDialog
        document={editing?.document ?? null}
        mode={editing?.mode ?? 'rename'}
        pending={update.isPending}
        onClose={() => { setEditing(null); }}
        onSubmit={(patch) => {
          if (!editing) return;
          update.mutate(
            { id: editing.document.id, patch },
            {
              onSuccess: () => {
                pushFlash(editing.mode === 'rename' ? 'Document renommé.' : 'Document rattaché au bien.');
                setEditing(null);
              },
              onError: () => {
                setEditing(null);
                fail();
              },
            },
          );
        }}
      />
      <ConfirmDialog
        open={toDelete.length > 0}
        onOpenChange={(open) => { if (!open) setToDelete([]); }}
        title={toDelete.length > 1 ? `Supprimer ${String(toDelete.length)} documents ?` : 'Supprimer ce document ?'}
        description={toDelete.length === 1 ? `« ${toDelete[0]?.fileName ?? ''} » sera supprimé définitivement.` : 'Ces documents seront supprimés définitivement.'}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          const docs = toDelete;
          remove.mutate(docs.map((item) => item.id), {
            onSuccess: () => {
              pushFlash(docs.length > 1 ? `${String(docs.length)} documents supprimés.` : 'Document supprimé.');
              setSelected(selected.filter((id) => !docs.some((item) => item.id === id)));
              setToDelete([]);
            },
            onError: () => {
              setToDelete([]);
              fail();
            },
          });
        }}
      />
    </>
  );
}
