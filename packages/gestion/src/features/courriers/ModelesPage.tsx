'use client';

import { Archive, ArchiveRestore, Copy, Eye, FilePen, Pencil, Trash2 } from 'lucide-react';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  Pagination,
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
import { useArchiveTemplate, useDeleteTemplate, useDuplicateTemplate, useTemplates } from './hooks';
import { courriersPaths } from './paths';
import { templateCategoryLabel } from './schemas';
import type { Template } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const tabs: ListTab<Template>[] = [
  { id: 'tous', label: 'Tous', match: (item) => !item.archived },
  { id: 'loyers', label: 'Loyers', match: (item) => !item.archived && item.category === 'loyers' },
  { id: 'baux', label: 'Baux', match: (item) => !item.archived && item.category === 'baux' },
  { id: 'general', label: 'Général', match: (item) => !item.archived && item.category === 'general' },
  { id: 'archives', label: 'Archivés', match: (item) => item.archived },
];

export function ModelesPage() {
  const templates = useTemplates();
  const { push, Link } = useGestionNavigation();
  const notify = useNotify();
  const duplicate = useDuplicateTemplate();
  const archive = useArchiveTemplate();
  const remove = useDeleteTemplate();
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);

  const items = templates.data ?? [];
  const view = useListView({ items, tabs, searchText: (item) => `${item.name} ${item.subject}` });

  const run = async (task: () => Promise<unknown>, success: { title: string; description?: string }) => {
    try {
      await task();
      notify(success);
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Template): ActionItem[] => [
    { id: 'preview', label: 'Aperçu', icon: Eye, onSelect: () => { push(courriersPaths.modele(item.id)); } },
    { id: 'use', label: 'Utiliser pour un courrier', icon: FilePen, disabled: item.archived, onSelect: () => { push(links.newCourrier({ modele: item.id })); } },
    { id: 'edit', label: 'Modifier', icon: Pencil, disabled: item.builtIn || item.archived, onSelect: () => { push(courriersPaths.editModele(item.id)); } },
    { id: 'duplicate', label: 'Dupliquer', icon: Copy, onSelect: () => { void run(() => duplicate.mutateAsync(item.id), { title: 'Modèle dupliqué', description: `${item.name}, copie` }); } },
    item.archived
      ? { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, separatorBefore: true, onSelect: () => { void run(() => archive.mutateAsync({ id: item.id, archived: false }), { title: 'Modèle restauré', description: item.name }); } }
      : { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { void run(() => archive.mutateAsync({ id: item.id, archived: true }), { title: 'Modèle archivé', description: item.name }); } },
    { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', disabled: item.builtIn, onSelect: () => { setPendingDelete(item); } },
  ];

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target) await run(() => remove.mutateAsync(target.id), { title: 'Modèle supprimé', description: target.name });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Modèles de courriers' }]}
        title="Modèles de courriers"
        subtitle="Les champs entre accolades sont remplis automatiquement à la génération."
        actions={<LinkButton href={courriersPaths.newModele} variant="primary">Nouveau modèle</LinkButton>}
      />
      {templates.isError ? <LoadError title="Les modèles n’ont pas pu être chargés" /> : null}
      <Card role="region" aria-label="Liste des modèles" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="tous">
          <TabList aria-label="Filtrer les modèles">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <SearchInput label="Rechercher un modèle" placeholder="Nom ou objet" value={view.query} onValueChange={view.setQuery} />
            {templates.isPending ? <ListLoading label="Chargement des modèles" /> : null}
            {templates.data && view.rows.length === 0 ? (
              <EmptyState icon={FilePen} title="Aucun modèle" description={view.query === '' ? 'Rien à afficher dans cette rubrique pour le moment.' : 'Aucun modèle ne correspond à cette recherche.'}>
                <LinkButton href={courriersPaths.newModele} variant="primary">Nouveau modèle</LinkButton>
              </EmptyState>
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Modèles">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Modèle</TableHeaderCell>
                    <TableHeaderCell>Catégorie</TableHeaderCell>
                    <TableHeaderCell>Origine</TableHeaderCell>
                    <TableHeaderCell>Mis à jour</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell strong>
                        <Link href={courriersPaths.modele(item.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{item.name}</Link>
                        <span className="block text-caption font-normal text-fg-subtle">{item.subject}</span>
                      </TableCell>
                      <TableCell>{templateCategoryLabel[item.category]}</TableCell>
                      <TableCell><Badge tone={item.builtIn ? 'info' : 'neutral'}>{item.builtIn ? 'Fourni' : 'Personnalisé'}</Badge></TableCell>
                      <TableCell>{formatDateFr(item.updatedOn)}</TableCell>
                      <TableCell><ActionMenu label={`Plus d’actions, ${item.name}`} items={actionsFor(item)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des modèles" />
          </TabPanel>
        </Tabs>
      </Card>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title="Supprimer ce modèle ?"
        description={`« ${pendingDelete?.name ?? ''} » sera supprimé définitivement. Refusé si des courriers l’ont utilisé : archivez-le alors.`}
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={() => { void confirmDelete(); }}
      />
    </>
  );
}
