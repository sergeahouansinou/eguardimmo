'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore, Bell, CircleCheck, Pencil, PlayCircle, Receipt, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
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
import { ALL, bienLabel, bienOptions, matchesBien } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { usePaging } from '../shared/paging';
import { nextSort, sortItems } from '../shared/sort';
import type { SortState } from '../shared/sort';
import { matchesQuery } from '../shared/text';
import { FilterSelect, Notice, PaginationBar, RowMenu, Toolbar } from '../shared/ui';
import type { RowAction } from '../shared/ui';
import { InterventionDialogHost } from './InterventionDialogHost';
import type { DialogState } from './InterventionDialogHost';
import { useIntervenantNames } from './hooks';
import { compareInterventions, defaultOrder, expenseHref, isLate } from './logic';
import type { SortKey } from './logic';
import { priorityLabels, PRIORITIES, statusLabels } from './schemas';
import type { Intervention, InterventionStatus, Priority } from './schemas';
import { INTERVENTIONS_KEY, useInterventions, useInterventionsSource } from './source';

const priorityTone: Record<Priority, BadgeTone> = { urgente: 'danger', normale: 'warning', basse: 'info' };
const statusTone: Record<InterventionStatus, BadgeTone> = { ouverte: 'neutral', en_cours: 'warning', terminee: 'success' };

type TabKey = 'actives' | 'archives';

export function InterventionsPage({ Link, navigate }: ScreenProps) {
  const query = useInterventions();
  const source = useInterventionsSource();
  const intervenants = useIntervenantNames((query.data ?? []).map((item) => item.intervenant));
  const [tab, setTab] = useState<TabKey>('actives');
  const [search, setSearch] = useState('');
  const [bien, setBien] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [intervenant, setIntervenant] = useState(ALL);
  const [late, setLate] = useState(false);
  const [statuses, setStatuses] = useState<readonly InterventionStatus[]>([]);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: null, direction: 'asc' });
  const [toDelete, setToDelete] = useState<Intervention | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = [INTERVENTIONS_KEY] as const;
  const setStatus = useSourceMutation((input: { id: string; status: InterventionStatus }) => source.setStatus(input.id, input.status), invalidate);
  const setArchived = useSourceMutation((input: { id: string; archived: boolean }) => source.setArchived(input.id, input.archived), invalidate);
  const remove = useSourceMutation((id: string) => source.remove(id), invalidate);

  const fail = () => { setError('L’action n’a pas abouti. Réessayez dans un instant.'); };
  const changeStatus = (item: Intervention, status: InterventionStatus) => {
    setStatus.mutate(
      { id: item.id, status },
      {
        onSuccess: () => { pushFlash(`Intervention « ${item.subject} » : ${statusLabels[status].toLowerCase()}.`); },
        onError: fail,
      },
    );
  };
  const archive = (item: Intervention, archived: boolean) => {
    setArchived.mutate(
      { id: item.id, archived },
      {
        onSuccess: () => { pushFlash(archived ? `Intervention « ${item.subject} » archivée.` : `Intervention « ${item.subject} » remise parmi les actives.`); },
        onError: fail,
      },
    );
  };

  const all = query.data ?? [];
  const activeCount = all.filter((item) => !item.archived).length;
  const archiveCount = all.length - activeCount;
  const filtered = all.filter((item) => {
    if (item.archived !== (tab === 'archives')) return false;
    if (!matchesQuery(search, item.subject, bienLabel(item.bienId))) return false;
    if (!matchesBien(item.bienId, bien)) return false;
    if (priority !== ALL && item.priority !== priority) return false;
    if (intervenant !== ALL && (item.intervenant ?? '') !== intervenant) return false;
    if (!late && statuses.length === 0) return true;
    return (late && isLate(item)) || statuses.includes(item.status);
  });
  const ordered = sort.key === null ? [...filtered].sort(defaultOrder) : sortItems(filtered, sort, compareInterventions);
  const paging = usePaging(ordered, 10);
  const filtering = search !== '' || bien !== ALL || priority !== ALL || intervenant !== ALL || late || statuses.length > 0;

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    paging.reset();
  };
  const toggleStatus = (status: InterventionStatus) => {
    setStatuses((current) => (current.includes(status) ? current.filter((item) => item !== status) : [...current, status]));
    paging.reset();
  };
  const clearFilters = () => {
    setSearch('');
    setBien(ALL);
    setPriority(ALL);
    setIntervenant(ALL);
    setLate(false);
    setStatuses([]);
    paging.reset();
  };
  const sortHeader = (key: SortKey, label: string) => (
    <SortTh
      label={label}
      active={sort.key === key}
      direction={sort.direction}
      onSort={() => {
        setSort(nextSort(sort, key));
        paging.reset();
      }}
    />
  );

  const actionsFor = (item: Intervention): RowAction[] => {
    const actions: RowAction[] = [
      { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => { navigate(`/interventions/${item.id}/modifier`); } },
      { id: 'assign', label: 'Assigner un intervenant', icon: UserPlus, onSelect: () => { setDialog({ kind: 'assign', item }); } },
    ];
    if (item.status === 'ouverte') actions.push({ id: 'start', label: 'Passer en cours', icon: PlayCircle, onSelect: () => { changeStatus(item, 'en_cours'); } });
    if (item.status !== 'terminee') actions.push({ id: 'done', label: 'Marquer terminée', icon: CircleCheck, onSelect: () => { changeStatus(item, 'terminee'); } });
    if (item.status === 'terminee') actions.push({ id: 'reopen', label: 'Rouvrir', icon: RotateCcw, onSelect: () => { changeStatus(item, 'ouverte'); } });
    actions.push({ id: 'notify', label: 'Prévenir le locataire', icon: Bell, onSelect: () => { setDialog({ kind: 'notify', item }); } });
    actions.push({ id: 'expense', label: 'Ajouter une dépense', icon: Receipt, onSelect: () => { navigate(expenseHref(item)); } });
    actions.push({
      id: 'archive',
      label: item.archived ? 'Désarchiver' : 'Archiver',
      icon: item.archived ? ArchiveRestore : Archive,
      separatorBefore: true,
      onSelect: () => { archive(item, !item.archived); },
    });
    actions.push({ id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setToDelete(item); } });
    return actions;
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Interventions' }]}
        title="Interventions"
        description="Travaux et dépannages chez les locataires. Les urgences sont en tête."
        actions={
          <Button asChild>
            <Link href="/interventions/nouvelle">Nouvelle intervention</Link>
          </Button>
        }
      />
      <Notice tone="danger" message={error} onDismiss={() => { setError(null); }} />
      <Card role="region" aria-label="Liste des interventions">
        <Tabs
          value={tab}
          defaultValue="actives"
          onValueChange={(value) => {
            setTab(value === 'archives' ? 'archives' : 'actives');
            paging.reset();
          }}
        >
          <TabList aria-label="Interventions">
            <Tab value="actives" count={query.data ? activeCount : undefined}>Actives</Tab>
            <Tab value="archives" count={query.data ? archiveCount : undefined}>Archives</Tab>
          </TabList>
          <TabPanel value={tab} className="flex flex-col gap-2">
            <Toolbar>
              <div className="w-full sm:w-56">
                <TextField
                  label="Rechercher"
                  hideLabel
                  placeholder="Sujet, bien"
                  type="search"
                  value={search}
                  onChange={(event) => { touch(setSearch)(event.target.value); }}
                />
              </div>
              <FilterSelect label="Bien" allLabel="Bien : Tous" options={bienOptions()} value={bien} onValueChange={touch(setBien)} />
              <FilterSelect
                label="Priorité"
                allLabel="Priorité : Toutes"
                options={PRIORITIES.map((value) => ({ value, label: priorityLabels[value] }))}
                value={priority}
                onValueChange={touch(setPriority)}
              />
              <FilterSelect
                label="Intervenant"
                allLabel="Intervenant : Tous"
                options={intervenants.map((value) => ({ value, label: value }))}
                value={intervenant}
                onValueChange={touch(setIntervenant)}
              />
            </Toolbar>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par état">
              <FilterChip pressed={late} onPressedChange={touch(setLate)}>En retard</FilterChip>
              {(['ouverte', 'en_cours', 'terminee'] as const).map((status) => (
                <FilterChip key={status} pressed={statuses.includes(status)} onPressedChange={() => { toggleStatus(status); }}>
                  {statusLabels[status]}
                </FilterChip>
              ))}
            </div>
            <QueryState query={query} errorTitle="Les interventions n’ont pas pu être chargées" loadingLabel="Chargement des interventions">
              {() =>
                ordered.length === 0 ? (
                  <EmptyBlock
                    title={filtering ? 'Aucune intervention ne correspond' : tab === 'archives' ? 'Aucune intervention archivée' : 'Aucune intervention active'}
                    action={
                      filtering ? (
                        <Button variant="secondary" size="sm" onClick={clearFilters}>Réinitialiser les filtres</Button>
                      ) : tab === 'actives' ? (
                        <Button size="sm" asChild><Link href="/interventions/nouvelle">Nouvelle intervention</Link></Button>
                      ) : undefined
                    }
                  >
                    {filtering ? 'Modifiez la recherche ou les filtres.' : 'Créez une intervention pour suivre un dépannage ou des travaux.'}
                  </EmptyBlock>
                ) : (
                  <>
                    <DataTable caption="Interventions">
                      <thead>
                        <tr>
                          {sortHeader('subject', 'Sujet')}
                          {sortHeader('bien', 'Bien')}
                          <Th>Intervenant</Th>
                          {sortHeader('dueDate', 'Échéance')}
                          {sortHeader('updatedAt', 'Mise à jour')}
                          {sortHeader('priority', 'Priorité')}
                          {sortHeader('status', 'État')}
                          <Th className="relative"><span className="sr-only">Actions</span></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {paging.pageItems.map((item) => (
                          <tr key={item.id}>
                            <Td strong>{item.subject}</Td>
                            <Td>{bienLabel(item.bienId)}</Td>
                            <Td className={item.intervenant ? undefined : 'text-fg-subtle'}>{item.intervenant ?? 'À assigner'}</Td>
                            <Td>{item.dueDate ? formatFrDate(item.dueDate) : '—'}</Td>
                            <Td>{formatFrDate(item.updatedAt)}</Td>
                            <Td><Badge tone={priorityTone[item.priority]}>{priorityLabels[item.priority]}</Badge></Td>
                            <Td>
                              <span className="inline-flex items-center gap-1">
                                <Badge tone={statusTone[item.status]}>{statusLabels[item.status]}</Badge>
                                {isLate(item) ? <Badge tone="danger">En retard</Badge> : null}
                              </span>
                            </Td>
                            <Td>
                              <span className="flex items-center justify-end gap-1">
                                <Button variant="link" size="sm" asChild>
                                  <Link href={`/interventions/${item.id}`} aria-label={`Ouvrir ${item.subject}`}>Ouvrir</Link>
                                </Button>
                                <RowMenu label={`Plus d’actions, ${item.subject}`} actions={actionsFor(item)} />
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                    <PaginationBar paging={paging} label="Pagination des interventions" />
                  </>
                )
              }
            </QueryState>
          </TabPanel>
        </Tabs>
      </Card>
      <InterventionDialogHost state={dialog} onClose={() => { setDialog(null); }} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        title="Supprimer cette intervention ?"
        description={toDelete ? `« ${toDelete.subject} » sera supprimée définitivement.` : ''}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              pushFlash(`Intervention « ${toDelete.subject} » supprimée.`);
              setToDelete(null);
            },
            onError: () => {
              setToDelete(null);
              fail();
            },
          });
        }}
      />
    </>
  );
}
