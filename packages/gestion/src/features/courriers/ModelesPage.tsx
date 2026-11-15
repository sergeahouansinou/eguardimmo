'use client';

import { Archive, ArchiveRestore, Copy, Eye, FilePen, Pencil, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
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
import { useArchiveTemplate, useDeleteTemplate, useDuplicateTemplate, useTemplates } from './hooks';
import { courriersPaths } from './paths';
import { TEMPLATE_CATEGORIES, templateCategoryLabel } from './schemas';
import type { Template } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'toutes';

const tabs: ListTab<Template>[] = [
  { id: 'tous', label: 'Tous', match: (item) => !item.archived },
  { id: 'defaut', label: 'Par défaut', match: (item) => !item.archived && item.builtIn },
  { id: 'personnalises', label: 'Personnalisés', match: (item) => !item.archived && !item.builtIn },
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
  const [category, setCategory] = useState(ALL);

  const items = templates.data ?? [];
  const view = useListView({ items, tabs, searchText: (item) => `${item.name} ${item.subject} ${item.description}`, predicate: (item) => category === ALL || item.category === category });

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

  const customize = async (item: Template) => {
    try {
      const copy = await duplicate.mutateAsync(item.id);
      notify({ title: 'Modèle personnalisé créé', description: copy.name });
      push(courriersPaths.editModele(copy.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

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
        subtitle="Lettres types prêtes à l’envoi. Un modèle personnalisé remplace celui proposé par défaut."
        actions={<LinkButton href={courriersPaths.newModele} variant="primary">Nouveau modèle</LinkButton>}
      />
      <Alert tone="info">Les modèles par défaut sont des bases à adapter. Ils ne remplacent pas l’avis d’un professionnel du droit.</Alert>
      {templates.isError ? <LoadError title="Les modèles n’ont pas pu être chargés" /> : null}
      <Card role="region" aria-label="Liste des modèles" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="tous">
          <TabList aria-label="Filtrer les modèles">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher un modèle" placeholder="Titre, mot-clé" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Catégorie"
                hideLabel
                placeholder="Catégorie : Toutes"
                value={category}
                onValueChange={(value) => { setCategory(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Catégorie : Toutes' }, ...TEMPLATE_CATEGORIES.map((entry) => ({ value: entry, label: templateCategoryLabel[entry] }))]}
                className="w-56"
              />
            </div>
            {templates.isPending ? <ListLoading label="Chargement des modèles" /> : null}
            {templates.data && view.rows.length === 0 ? (
              <EmptyState icon={FilePen} title="Aucun modèle" description={view.query === '' && category === ALL ? 'Rien à afficher dans cette rubrique pour le moment.' : 'Aucun modèle ne correspond à cette recherche.'}>
                <LinkButton href={courriersPaths.newModele} variant="primary">Nouveau modèle</LinkButton>
              </EmptyState>
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Modèles">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Modèle</TableHeaderCell>
                    <TableHeaderCell>Catégorie</TableHeaderCell>
                    <TableHeaderCell>Source</TableHeaderCell>
                    <TableHeaderCell>Mis à jour</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell strong>
                        <Link href={courriersPaths.modele(item.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{item.name}</Link>
                        <span className="block text-caption font-normal text-fg-subtle">{item.description === '' ? item.subject : item.description}</span>
                      </TableCell>
                      <TableCell>{templateCategoryLabel[item.category]}</TableCell>
                      <TableCell><Badge tone={item.builtIn ? 'neutral' : 'info'}>{item.builtIn ? 'Par défaut' : 'Personnalisé'}</Badge></TableCell>
                      <TableCell>{formatDateFr(item.updatedOn)}</TableCell>
                      <TableCell><Badge tone={item.archived ? 'neutral' : 'success'}>{item.archived ? 'Archivé' : 'Actif'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.builtIn ? (
                            <Button variant="secondary" size="sm" aria-label={`Personnaliser, ${item.name}`} disabled={item.archived} loading={duplicate.isPending && duplicate.variables === item.id} onClick={() => { void customize(item); }}>Personnaliser</Button>
                          ) : (
                            <Button variant="secondary" size="sm" aria-label={`Utiliser, ${item.name}`} disabled={item.archived} onClick={() => { push(links.newCourrier({ modele: item.id })); }}>Utiliser</Button>
                          )}
                          <ActionMenu label={`Plus d’actions, ${item.name}`} items={actionsFor(item)} />
                        </div>
                      </TableCell>
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
