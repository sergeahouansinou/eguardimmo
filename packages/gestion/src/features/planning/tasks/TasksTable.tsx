'use client';

import { Badge, Button, Checkbox, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useState } from 'react';
import { NoRows, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { ActionError, QueryState } from '../../orgapi';
import { CursorPager } from '../../finances/rent/CursorPager';
import type { CursorPages } from '../../finances/rent/CursorPager';
import { useCompleteTask, useTasks } from '../hooks';
import type { PlanningTask, TaskQuery } from '../model';
import { taskPaths } from '../taskPaths';
import { useTaskChoices } from './choices';
import { taskStatusBadge } from './labels';
import { useRetryPlanning } from './retry';
import type { TaskPermissions } from './permissions';

export interface TasksTableProps {
  query: TaskQuery;
  pages: CursorPages;
  permissions: TaskPermissions;
  filtered: boolean;
  selection: ReadonlySet<string>;
  onSelectionChange: (next: ReadonlySet<string>) => void;
}

export function TasksTable({ query, pages, permissions, filtered, selection, onSelectionChange }: TasksTableProps) {
  const tasks = useTasks(query);
  const choices = useTaskChoices();
  const complete = useCompleteTask();
  const notify = useNotify();
  const retry = useRetryPlanning();
  const [failure, setFailure] = useState<unknown>(null);

  if (tasks.data === undefined) return <QueryState query={tasks} label="Chargement des tâches" title="Impossible de charger les tâches" onRetry={retry} />;
  const { items, nextCursor } = tasks.data;
  if (items.length === 0) return <NoRows>{filtered || pages.page > 1 ? 'Aucune tâche ne correspond à ces filtres.' : 'Aucune tâche pour le moment. Créez la première.'}</NoRows>;

  const selectable = permissions.write ? items.filter((task) => task.status === 'open') : [];
  const allSelected = selectable.length > 0 && selectable.every((task) => selection.has(task.id));
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selection);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  const finish = async (task: PlanningTask) => {
    setFailure(null);
    try {
      await complete.mutateAsync(task.id);
      notify({ title: 'Tâche terminée' });
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <>
      {failure === null ? null : <ActionError title="Tâche non terminée" error={failure} />}
      <Table aria-label="Tâches" scrollLabel="Tâches, défilement horizontal">
        <TableHead>
          <TableRow>
            {permissions.write ? (
              <TableHeaderCell className="w-8">
                <Checkbox label="Sélectionner toutes les tâches ouvertes de la page" hideLabel checked={allSelected} disabled={selectable.length === 0} onChange={(event) => { onSelectionChange(event.target.checked ? new Set(selectable.map((task) => task.id)) : new Set()); }} />
              </TableHeaderCell>
            ) : null}
            <TableHeaderCell>Tâche</TableHeaderCell>
            <TableHeaderCell>Échéance</TableHeaderCell>
            <TableHeaderCell>Responsable</TableHeaderCell>
            <TableHeaderCell>Lié à</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Action</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((task) => (
            <TaskRow key={task.id} task={task} permissions={permissions} choices={choices} selected={selection.has(task.id)} onToggle={toggle} onComplete={finish} completing={complete.isPending && complete.variables === task.id} />
          ))}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={nextCursor} label="Pagination des tâches" />
    </>
  );
}

interface TaskRowProps {
  task: PlanningTask;
  permissions: TaskPermissions;
  choices: ReturnType<typeof useTaskChoices>;
  selected: boolean;
  completing: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onComplete: (task: PlanningTask) => Promise<void>;
}

function TaskRow({ task, permissions, choices, selected, completing, onToggle, onComplete }: TaskRowProps) {
  const { Link } = useGestionNavigation();
  const status = taskStatusBadge[task.status];
  const linkClass = 'text-action-on-subtle underline-offset-2 hover:underline';
  return (
    <TableRow selected={selected}>
      {permissions.write ? (
        <TableCell>
          {task.status === 'open' ? <Checkbox label={`Sélectionner la tâche ${task.title}`} hideLabel checked={selected} onChange={(event) => { onToggle(task.id, event.target.checked); }} /> : null}
        </TableCell>
      ) : null}
      <TableCell strong>
        <Link href={taskPaths.detail(task.id)} className="text-action-on-subtle underline-offset-2 hover:underline [overflow-wrap:anywhere]">{task.title}</Link>
      </TableCell>
      <TableCell>
        {formatDateFr(task.dueOn)}
        {task.isOverdue ? <Badge tone="danger" className="ml-2">En retard</Badge> : null}
      </TableCell>
      <TableCell>
        {choices.assigneeLabel(task)}
        {task.assigneeActive === false ? <Badge tone="warning" className="ml-2">Inactif</Badge> : null}
      </TableCell>
      <TableCell>
        <span className="flex flex-col gap-0.5">
          {task.propertyId === null ? null : <Link href={taskPaths.property(task.propertyId)} className={linkClass}>{choices.propertyName(task.propertyId)}</Link>}
          {task.unitId === null ? null : <Link href={taskPaths.unit(task.unitId)} className={linkClass}>Lot</Link>}
          {task.leaseId === null ? null : <Link href={taskPaths.lease(task.leaseId)} className={linkClass}>{choices.leaseLabel(task.leaseId)}</Link>}
          {task.propertyId === null && task.unitId === null && task.leaseId === null ? '—' : null}
        </span>
      </TableCell>
      <TableCell><Badge tone={status.tone}>{status.label}</Badge></TableCell>
      <TableCell>
        {task.status === 'open' && permissions.progress ? (
          <Button size="sm" variant="secondary" loading={completing} aria-label={`Terminer la tâche ${task.title}`} onClick={() => { void onComplete(task); }}>Terminer</Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
