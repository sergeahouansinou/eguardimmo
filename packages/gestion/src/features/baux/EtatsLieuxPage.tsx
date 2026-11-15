'use client';

import { Archive, ArchiveRestore, ClipboardList, FileText, GitCompare, LogOut, Pencil, PenLine, Printer, Send, Trash2 } from 'lucide-react';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Select,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
} from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from './BauxParts';
import { EdlStatusBadge } from './EdlParts';
import { useArchiveEdl, useDeleteEdl, useEdls, useSetEdlStatus } from './hooks';
import { bauxPaths } from './paths';
import { useEdlActions } from './useEdlActions';
import { EDL_TYPES, edlTypeLabel } from './schemas';
import type { Edl } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'tous';

const tabs: ListTab<Edl>[] = [
  { id: 'a_traiter', label: 'À traiter', match: (edl) => !edl.archived && edl.status !== 'signe' },
  { id: 'signes', label: 'Signés', match: (edl) => !edl.archived && edl.status === 'signe' },
  { id: 'tous', label: 'Tous', match: (edl) => !edl.archived },
  { id: 'archives', label: 'Archivés', match: (edl) => edl.archived },
];

export function EtatsLieuxPage() {
  const edls = useEdls();
  const lookups = useLeaseLookups();
  const { push, Link } = useGestionNavigation();
  const notify = useNotify();
  const sign = useSetEdlStatus();
  const archive = useArchiveEdl();
  const remove = useDeleteEdl();
  const { sendForSignature, prepareExitState } = useEdlActions();
  const [type, setType] = useState(ALL);
  const [pendingDelete, setPendingDelete] = useState<Edl | null>(null);

  const items = edls.data ?? [];
  const searchText = (edl: Edl) => `${edl.reference} ${lookups.unitLabel(edl.unitId)} ${edl.tenantId ? lookups.tenantName(edl.tenantId) : ''}`;
  const view = useListView({ items, tabs, searchText, predicate: (edl) => type === ALL || edl.type === type });

  const countOf = (id: string) => view.counts[id] ?? 0;

  const run = async (task: () => Promise<unknown>, success: { title: string; description?: string }) => {
    try {
      await task();
      notify(success);
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (edl: Edl): ActionItem[] => [
    { id: 'open', label: 'Ouvrir', icon: FileText, onSelect: () => { push(bauxPaths.edl(edl.id)); } },
    { id: 'edit', label: 'Modifier', icon: Pencil, disabled: edl.status === 'signe' || edl.archived, onSelect: () => { push(bauxPaths.editEdl(edl.id)); } },
    { id: 'pdf', label: 'Télécharger le PDF', icon: Printer, onSelect: () => { push(`${bauxPaths.edl(edl.id)}?imprimer=1`); } },
    { id: 'compare', label: 'Comparer avec l’entrée', icon: GitCompare, disabled: edl.type === 'entree', onSelect: () => { push(bauxPaths.compareEdl(edl.id)); } },
    { id: 'send', label: 'Envoyer pour signature', icon: Send, disabled: edl.status === 'signe' || edl.archived, onSelect: () => { void sendForSignature(edl); } },
    { id: 'exit', label: 'Préparer l’état de sortie', icon: LogOut, disabled: edl.type !== 'entree' || edl.archived, onSelect: () => { void prepareExitState(edl); } },
    {
      id: 'sign',
      label: 'Marquer comme signé',
      icon: PenLine,
      disabled: edl.status === 'signe' || edl.archived,
      onSelect: () => { void run(() => sign.mutateAsync({ id: edl.id, status: 'signe' }), { title: 'État des lieux signé', description: edl.reference }); },
    },
    edl.archived
      ? { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, separatorBefore: true, onSelect: () => { void run(() => archive.mutateAsync({ id: edl.id, archived: false }), { title: 'État des lieux restauré', description: edl.reference }); } }
      : { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { void run(() => archive.mutateAsync({ id: edl.id, archived: true }), { title: 'État des lieux archivé', description: edl.reference }); } },
    { id: 'delete', label: 'Supprimer le brouillon', icon: Trash2, tone: 'danger', disabled: edl.status !== 'brouillon', onSelect: () => { setPendingDelete(edl); } },
  ];

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target) await run(() => remove.mutateAsync(target.id), { title: 'Brouillon supprimé', description: target.reference });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'États des lieux' }]}
        title="États des lieux"
        subtitle={edls.data ? `${String(countOf('a_traiter'))} à traiter, ${String(countOf('signes'))} signés.` : ' '}
        actions={<LinkButton href={bauxPaths.newEdl} variant="primary">Nouvel état des lieux</LinkButton>}
      />
      {edls.isError ? <LoadError title="Les états des lieux n’ont pas pu être chargés" /> : null}
      <Card role="region" aria-label="Liste des états des lieux" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="a_traiter">
          <TabList aria-label="Filtrer les états des lieux">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher un état des lieux" placeholder="Référence, bien, locataire" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Type"
                hideLabel
                placeholder="Type : Tous"
                value={type}
                onValueChange={(value) => { setType(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Type : Tous' }, ...EDL_TYPES.map((entry) => ({ value: entry, label: edlTypeLabel[entry] }))]}
                className="w-44"
              />
            </div>
            {edls.isPending ? <ListLoading label="Chargement des états des lieux" /> : null}
            {edls.data && view.rows.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Aucun état des lieux" description={view.query !== '' || type !== ALL ? 'Aucun état des lieux ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'}>
                <LinkButton href={bauxPaths.newEdl} variant="primary">Nouvel état des lieux</LinkButton>
              </EmptyState>
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="États des lieux">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Référence</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Locataire</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((edl) => (
                    <TableRow key={edl.id}>
                      <TableCell strong>
                        <Link href={bauxPaths.edl(edl.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{edl.reference}</Link>
                      </TableCell>
                      <TableCell>{edlTypeLabel[edl.type]}</TableCell>
                      <TableCell>{lookups.unitShort(edl.unitId)}</TableCell>
                      <TableCell>{edl.tenantId ? lookups.tenantName(edl.tenantId) : '—'}</TableCell>
                      <TableCell>{edl.date ? formatDateFr(edl.date) : 'À planifier'}</TableCell>
                      <TableCell><EdlStatusBadge status={edl.status} /></TableCell>
                      <TableCell><ActionMenu label={`Plus d’actions, ${edl.reference}`} items={actionsFor(edl)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des états des lieux" />
          </TabPanel>
        </Tabs>
      </Card>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title="Supprimer ce brouillon ?"
        description="Le brouillon sera supprimé définitivement. Un état des lieux planifié ou signé s’archive."
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={() => { void confirmDelete(); }}
      />
    </>
  );
}
