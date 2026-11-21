'use client';

import { Alert, Badge, Button, Card, Icon } from '@eguardimmo/ui';
import { CheckCircle2, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { DescriptionList, LinkButton, PageHeader, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { ActionError, ConfirmAction, QueryState, formatDateTimeFr, useOrgTimezone, useOrgUnitChoices } from '../../orgapi';
import { useCancelTask, useCompleteTask, usePlanningTask, useReopenTask } from '../hooks';
import type { PlanningTask } from '../model';
import { taskPaths } from '../taskPaths';
import { useTaskChoices } from './choices';
import { taskStatusBadge } from './labels';
import { useTaskPermissions } from './permissions';
import { useRetryPlanning } from './retry';

const NOT_FOUND = { title: 'Tâche introuvable', description: 'Cette tâche n’existe pas ou n’appartient pas à votre organisation.', backHref: taskPaths.list, backLabel: 'Retour aux tâches' };

export function PlanningTaskDetailPage({ id }: { id: string }) {
  const task = usePlanningTask(id);
  const retry = useRetryPlanning();
  return (
    <>
      {task.data === undefined ? <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Tâches', href: taskPaths.list }, { label: 'Tâche' }]} title="Tâche" /> : null}
      <QueryState query={task} label="Chargement de la tâche" title="Impossible de charger la tâche" notFound={NOT_FOUND} onRetry={retry} />
      {task.data === undefined ? null : <TaskDetail task={task.data} />}
    </>
  );
}

function TaskDetail({ task }: { task: PlanningTask }) {
  const status = taskStatusBadge[task.status];
  const permissions = useTaskPermissions();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Tâches', href: taskPaths.list }, { label: 'Tâche' }]}
        title={task.title}
        badges={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {task.isOverdue ? <Badge tone="danger">En retard</Badge> : null}
          </>
        }
        actions={task.status === 'open' && permissions.write ? <LinkButton href={taskPaths.edit(task.id)} icon={Pencil}>Modifier</LinkButton> : null}
      />
      <Card role="region" aria-label="Détail de la tâche" className="gap-4">
        <TaskFacts task={task} />
        <TaskActions task={task} permissions={permissions} />
      </Card>
    </>
  );
}

function TaskFacts({ task }: { task: PlanningTask }) {
  const { Link } = useGestionNavigation();
  const timezone = useOrgTimezone();
  const choices = useTaskChoices();
  const units = useOrgUnitChoices(task.propertyId);
  const doneBy = task.doneByUserId === null ? null : choices.assigneeLabel({ assigneeUserId: task.doneByUserId, assigneeActive: null });
  const unit = units.data?.find((candidate) => candidate.id === task.unitId);
  const linkClass = 'text-action-on-subtle underline underline-offset-2';

  const items = [
    { term: 'Échéance', detail: formatDateFr(task.dueOn) },
    { term: 'Responsable', detail: task.assigneeUserId === null ? 'Non assignée' : <>{choices.assigneeLabel(task)}{task.assigneeActive === false ? <Badge tone="warning" className="ml-2">Inactif</Badge> : null}</> },
    { term: 'Rappel', detail: task.remindDaysBefore === null ? 'Aucun' : task.remindDaysBefore === 0 ? 'Le jour de l’échéance' : `${String(task.remindDaysBefore)} jour${task.remindDaysBefore > 1 ? 's' : ''} avant`},
    ...(task.propertyId === null ? [] : [{ term: 'Bien', detail: <Link href={taskPaths.property(task.propertyId)} className={linkClass}>{choices.propertyName(task.propertyId)}</Link> }]),
    ...(task.unitId === null ? [] : [{ term: 'Lot', detail: <Link href={taskPaths.unit(task.unitId)} className={linkClass}>{unit?.reference ?? 'Voir le lot'}</Link> }]),
    ...(task.leaseId === null ? [] : [{ term: 'Bail', detail: <Link href={taskPaths.lease(task.leaseId)} className={linkClass}>{choices.leaseLabel(task.leaseId)}</Link> }]),
    ...(task.doneAt === null ? [] : [{ term: 'Terminée', detail: `${timezone.data === undefined ? formatDateFr(task.doneAt) : formatDateTimeFr(task.doneAt, timezone.data)}${doneBy === null ? '' : ` par ${doneBy}`}` }]),
  ];
  return <DescriptionList items={items} termWidth="140px" />;
}

function TaskActions({ task, permissions }: { task: PlanningTask; permissions: ReturnType<typeof useTaskPermissions> }) {
  const notify = useNotify();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const cancel = useCancelTask();
  const [failure, setFailure] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);

  const act = async (run: () => Promise<PlanningTask>, title: string): Promise<void> => {
    setFailure(null);
    try {
      await run();
      notify({ title });
    } catch (error) {
      setFailure(error);
    }
  };

  const canReopen = !permissions.pending && permissions.progress && (task.status === 'done' || (task.status === 'cancelled' && permissions.reopenCancelled));
  const cancelledLocked = !permissions.pending && task.status === 'cancelled' && !canReopen;
  const canAct = task.status === 'open' && (permissions.progress || permissions.write);
  if (!canAct && !canReopen && !cancelledLocked && failure === null) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {failure === null ? null : <ActionError title="Action impossible" error={failure} />}
      {cancelledLocked ? <Alert tone="info" title="Tâche annulée">Seuls le propriétaire, l’administrateur et le gestionnaire peuvent rouvrir une tâche annulée.</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {task.status === 'open' && permissions.progress ? (
          <Button loading={complete.isPending} onClick={() => { void act(() => complete.mutateAsync(task.id), 'Tâche terminée'); }}>
            <Icon icon={CheckCircle2} />
            Terminer
          </Button>
        ) : null}
        {canReopen ? (
          <Button variant="secondary" loading={reopen.isPending} onClick={() => { void act(() => reopen.mutateAsync(task.id), 'Tâche rouverte'); }}>
            <Icon icon={RotateCcw} />
            Rouvrir
          </Button>
        ) : null}
        {task.status === 'open' && permissions.write ? (
          <Button variant="danger" onClick={() => { setConfirming(true); }}>
            <Icon icon={XCircle} />
            Annuler la tâche
          </Button>
        ) : null}
      </div>
      <ConfirmAction
        open={confirming}
        title="Annuler cette tâche ?"
        description={<>« {task.title} » ne sera plus à faire. Rien n’est supprimé : un propriétaire, un administrateur ou un gestionnaire pourra la rouvrir.</>}
        confirmLabel="Annuler la tâche"
        failureTitle="Tâche non annulée"
        tone="danger"
        run={async () => { await cancel.mutateAsync(task.id); notify({ title: 'Tâche annulée' }); }}
        onClose={() => { setConfirming(false); }}
      />
    </div>
  );
}
