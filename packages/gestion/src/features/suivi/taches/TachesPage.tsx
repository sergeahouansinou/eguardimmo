'use client';

import { useState } from 'react';
import { CalendarClock, Eye, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Checkbox, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import {
  ConfirmDialog,
  DataTable,
  DEMO_TODAY,
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
import { ALL, ASSIGNEES, bienOptions, bienShort, matchesBien } from '../shared/biens';
import type { Assignee } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { usePaging } from '../shared/paging';
import { nextSort, sortItems } from '../shared/sort';
import type { SortState } from '../shared/sort';
import { matchesQuery } from '../shared/text';
import { BulkBar, countLabel, FilterSelect, Notice, PaginationBar, RowMenu, selectionLabel, Toolbar } from '../shared/ui';
import { compareTasks, defaultOrder, isOverdue, isThisMonth, isThisWeek, lateDays } from './logic';
import type { SortKey } from './logic';
import { reminderLabel } from './schemas';
import type { Task } from './schemas';
import { AssignTaskDialog, PostponeDialog } from './TaskDialogs';
import { TaskDetailDialog } from './TaskDetailDialog';
import { TASKS_KEY, useTasks, useTasksSource } from './source';

type TabKey = 'todo' | 'late' | 'done';

function StateBadge({ task }: { task: Task }) {
  if (task.done) return <Badge tone="success">Terminée</Badge>;
  if (isOverdue(task)) {
    const days = lateDays(task);
    return <Badge tone="danger">{`En retard, ${String(days)} jour${days > 1 ? 's' : ''}`}</Badge>;
  }
  if (isThisWeek(task)) return <Badge tone="warning">Cette semaine</Badge>;
  return <Badge tone="neutral">À faire</Badge>;
}

export function TachesPage({ Link, navigate }: ScreenProps) {
  const query = useTasks();
  const source = useTasksSource();
  const [tab, setTab] = useState<TabKey>('todo');
  const [search, setSearch] = useState('');
  const [bien, setBien] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [week, setWeek] = useState(false);
  const [month, setMonth] = useState(false);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: null, direction: 'asc' });
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [postponing, setPostponing] = useState<readonly Task[] | null>(null);
  const [assigning, setAssigning] = useState<readonly Task[] | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = [TASKS_KEY] as const;
  const setDone = useSourceMutation((input: { id: string; done: boolean }) => source.setDone(input.id, input.done), invalidate);
  const complete = useSourceMutation((ids: readonly string[]) => source.complete(ids), invalidate);
  const postpone = useSourceMutation((input: { ids: readonly string[]; dueDate: string }) => source.postponeTo(input.ids, input.dueDate), invalidate);
  const assign = useSourceMutation((input: { ids: readonly string[]; assignee: Assignee }) => source.assign(input.ids, input.assignee), invalidate);
  const remove = useSourceMutation((id: string) => source.remove(id), invalidate);
  const fail = () => { setError('L’action n’a pas abouti. Réessayez dans un instant.'); };

  const all = query.data ?? [];
  const todo = all.filter((task) => !task.done);
  const counts = { todo: todo.length, late: todo.filter(isOverdue).length, done: all.length - todo.length };
  const filtered = all.filter((task) => {
    if (tab === 'done' ? !task.done : task.done) return false;
    if (tab === 'late' && !isOverdue(task)) return false;
    if (!matchesQuery(search, task.title, bienShort(task.bienId))) return false;
    if (!matchesBien(task.bienId, bien)) return false;
    if (assignee !== ALL && task.assignee !== assignee) return false;
    if (!week && !month) return true;
    return (week && isThisWeek(task)) || (month && isThisMonth(task));
  });
  const ordered =
    sort.key === null
      ? [...filtered].sort((a, b) => (tab === 'done' ? defaultOrder(b, a) : defaultOrder(a, b)))
      : sortItems(filtered, sort, compareTasks);
  const paging = usePaging(ordered, 5);
  const filtering = search !== '' || bien !== ALL || assignee !== ALL || week || month;
  const selectedTasks = ordered.filter((task) => selected.includes(task.id));
  const pageIds = paging.pageItems.map((task) => task.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    paging.reset();
  };
  const finish = (task: Task, done: boolean) => {
    setDone.mutate(
      { id: task.id, done },
      {
        onSuccess: () => { pushFlash(done ? `Tâche « ${task.title} » terminée.` : `Tâche « ${task.title} » rouverte.`); },
        onError: fail,
      },
    );
  };
  const bulkComplete = () => {
    const ids = selectedTasks.filter((task) => !task.done).map((task) => task.id);
    complete.mutate(ids, {
      onSuccess: () => {
        pushFlash(`${String(ids.length)} tâche${ids.length > 1 ? 's' : ''} marquée${ids.length > 1 ? 's' : ''} terminée${ids.length > 1 ? 's' : ''}.`);
        setSelected([]);
      },
      onError: fail,
    });
  };
  const closeDialogs = () => {
    setPostponing(null);
    setAssigning(null);
    setDialogError(null);
  };
  const submitPostpone = (tasks: readonly Task[], dueDate: string) => {
    postpone.mutate(
      { ids: tasks.map((task) => task.id), dueDate },
      {
        onSuccess: () => {
          pushFlash(`Échéance reportée au ${formatFrDate(dueDate)} pour ${countLabel(tasks.length, 'tâche')}.`);
          setSelected([]);
          closeDialogs();
        },
        onError: () => { setDialogError('Réessayez dans un instant.'); },
      },
    );
  };
  const submitAssign = (tasks: readonly Task[], assignee: Assignee) => {
    assign.mutate(
      { ids: tasks.map((task) => task.id), assignee },
      {
        onSuccess: () => {
          pushFlash(`${countLabel(tasks.length, 'tâche')} assignée${tasks.length > 1 ? 's' : ''} à ${assignee}.`);
          setSelected([]);
          closeDialogs();
        },
        onError: () => { setDialogError('Réessayez dans un instant.'); },
      },
    );
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

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Suivi' }, { label: 'Tâches et rappels' }]}
        title="Tâches et rappels"
        description="Rappels datés : assurance, révision du loyer, relevés. Les tâches en retard passent en tête."
        actions={
          <Button asChild>
            <Link href="/taches/nouvelle">Nouvelle tâche</Link>
          </Button>
        }
      />
      <Notice tone="danger" message={error} onDismiss={() => { setError(null); }} />
      <Card role="region" aria-label="Liste des tâches">
        <Tabs
          value={tab}
          defaultValue="todo"
          onValueChange={(value) => {
            setTab(value === 'late' ? 'late' : value === 'done' ? 'done' : 'todo');
            setSelected([]);
            paging.reset();
          }}
        >
          <TabList aria-label="Tâches">
            <Tab value="todo" count={query.data ? counts.todo : undefined}>À faire</Tab>
            <Tab value="late" count={query.data ? counts.late : undefined}>En retard</Tab>
            <Tab value="done" count={query.data ? counts.done : undefined}>Terminées</Tab>
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
              <FilterSelect label="Bien" allLabel="Bien : Tous" options={bienOptions('short')} value={bien} onValueChange={touch(setBien)} />
              <FilterSelect
                label="Assignée à"
                allLabel="Assignée à : Toutes"
                options={ASSIGNEES.map((value) => ({ value, label: value }))}
                value={assignee}
                onValueChange={touch(setAssignee)}
              />
              <div className="flex flex-wrap gap-1.5 pb-0.5" role="group" aria-label="Filtrer par période">
                <FilterChip pressed={week} onPressedChange={touch(setWeek)}>Cette semaine</FilterChip>
                <FilterChip pressed={month} onPressedChange={touch(setMonth)}>Ce mois-ci</FilterChip>
              </div>
            </Toolbar>
            {selectedTasks.length > 0 ? (
              <BulkBar summary={selectionLabel(selectedTasks.length, 'tâche', true)}>
                {selectedTasks.some((task) => !task.done) ? (
                  <Button variant="secondary" size="sm" loading={complete.isPending} onClick={bulkComplete}>Marquer terminée</Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => { setPostponing(selectedTasks); }}>Reporter</Button>
                <Button variant="ghost" size="sm" onClick={() => { setAssigning(selectedTasks); }}>Assigner à</Button>
              </BulkBar>
            ) : null}
            <QueryState query={query} errorTitle="Les tâches n’ont pas pu être chargées" loadingLabel="Chargement des tâches">
              {() =>
                ordered.length === 0 ? (
                  <EmptyBlock
                    title={filtering ? 'Aucune tâche ne correspond' : tab === 'done' ? 'Aucune tâche terminée' : tab === 'late' ? 'Aucune tâche en retard' : 'Aucune tâche à faire'}
                    action={
                      filtering ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setBien(ALL);
                            setAssignee(ALL);
                            setWeek(false);
                            setMonth(false);
                            paging.reset();
                          }}
                        >
                          Réinitialiser les filtres
                        </Button>
                      ) : tab === 'todo' ? (
                        <Button size="sm" asChild><Link href="/taches/nouvelle">Nouvelle tâche</Link></Button>
                      ) : undefined
                    }
                  >
                    {filtering ? 'Modifiez la recherche ou les filtres.' : 'Les rappels datés apparaîtront ici.'}
                  </EmptyBlock>
                ) : (
                  <>
                    <DataTable caption="Tâches et rappels">
                      <thead>
                        <tr>
                          <Th className="w-8">
                            <Checkbox
                              label="Sélectionner toutes les tâches de la page"
                              hideLabel
                              checked={allOnPage}
                              onChange={(event) => {
                                setSelected(
                                  event.target.checked
                                    ? [...new Set([...selected, ...pageIds])]
                                    : selected.filter((id) => !pageIds.includes(id)),
                                );
                              }}
                            />
                          </Th>
                          <Th className="w-20">Terminée</Th>
                          {sortHeader('title', 'Sujet')}
                          {sortHeader('bien', 'Bien')}
                          {sortHeader('assignee', 'Assignée à')}
                          {sortHeader('dueDate', 'Échéance')}
                          <Th>Rappel</Th>
                          <Th>État</Th>
                          <Th className="relative"><span className="sr-only">Actions</span></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {paging.pageItems.map((task) => (
                          <tr key={task.id} className={selected.includes(task.id) ? 'bg-action-subtle' : undefined}>
                            <Td>
                              <Checkbox
                                label={`Sélectionner ${task.title}`}
                                hideLabel
                                checked={selected.includes(task.id)}
                                onChange={(event) => {
                                  setSelected(event.target.checked ? [...selected, task.id] : selected.filter((id) => id !== task.id));
                                }}
                              />
                            </Td>
                            <Td>
                              <Checkbox
                                label={`${task.done ? 'Rouvrir' : 'Terminer'} ${task.title}`}
                                hideLabel
                                checked={task.done}
                                onChange={() => { finish(task, !task.done); }}
                              />
                            </Td>
                            <Td strong>{task.title}</Td>
                            <Td>{bienShort(task.bienId)}</Td>
                            <Td>{task.assignee}</Td>
                            <Td>{formatFrDate(task.dueDate)}</Td>
                            <Td>{reminderLabel(task.reminder)}</Td>
                            <Td><StateBadge task={task} /></Td>
                            <Td>
                              <span className="flex items-center justify-end gap-1">
                                <RowMenu
                                  label={`Plus d’actions, ${task.title}`}
                                  actions={[
                                    { id: 'detail', label: 'Voir le détail', icon: Eye, onSelect: () => { setDetail(task); } },
                                    { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => { navigate(`/taches/${task.id}/modifier`); } },
                                    ...(task.done
                                      ? []
                                      : [{ id: 'postpone', label: 'Reporter à une date', icon: CalendarClock, onSelect: () => { setPostponing([task]); } }]),
                                    { id: 'assign', label: 'Assigner à', icon: UserPlus, onSelect: () => { setAssigning([task]); } },
                                    { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, separatorBefore: true, onSelect: () => { setToDelete(task); } },
                                  ]}
                                />
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                    <PaginationBar paging={paging} label="Pagination des tâches" />
                  </>
                )
              }
            </QueryState>
          </TabPanel>
        </Tabs>
      </Card>
      <PostponeDialog
        open={postponing !== null}
        count={postponing?.length ?? 0}
        initialDate={postponing?.length === 1 ? (postponing[0]?.dueDate ?? DEMO_TODAY) : DEMO_TODAY}
        pending={postpone.isPending}
        error={dialogError}
        onClose={closeDialogs}
        onSubmit={(dueDate) => { if (postponing) submitPostpone(postponing, dueDate); }}
      />
      <AssignTaskDialog
        open={assigning !== null}
        count={assigning?.length ?? 0}
        pending={assign.isPending}
        error={dialogError}
        onClose={closeDialogs}
        onSubmit={(assignee) => { if (assigning) submitAssign(assigning, assignee); }}
      />
      <TaskDetailDialog task={detail} onClose={() => { setDetail(null); }} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        title="Supprimer cette tâche ?"
        description={toDelete ? `« ${toDelete.title} » sera supprimée définitivement.` : ''}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              pushFlash(`Tâche « ${toDelete.title} » supprimée.`);
              setSelected(selected.filter((id) => id !== toDelete.id));
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
