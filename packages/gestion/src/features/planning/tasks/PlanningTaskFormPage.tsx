'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { LinkButton, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { ActionError, OrgApiError, QueryState, todayIn, useOrgTimezone } from '../../orgapi';
import { useCreateTask, usePlanningTask, useUpdateTask } from '../hooks';
import type { PlanningTask } from '../model';
import { taskPaths } from '../taskPaths';
import { useAttemptId } from './attemptId';
import { useTaskChoices } from './choices';
import { useTaskPermissions } from './permissions';
import { useRetryPlanning } from './retry';
import { taskFormSchema, taskToFormValues, toTaskInput } from './schema';
import type { TaskFormOutput, TaskFormValues } from './schema';
import { TaskFormFields } from './TaskFormFields';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CRUMBS = [{ label: 'Accueil', href: links.home }, { label: 'Tâches', href: taskPaths.list }] as const;
const NOT_FOUND = { title: 'Tâche introuvable', description: 'Cette tâche n’existe pas ou n’appartient pas à votre organisation.', backHref: taskPaths.list, backLabel: 'Retour aux tâches' };

export function PlanningTaskFormPage({ id }: { id?: string }) {
  return id === undefined ? <CreateTask /> : <EditTask id={id} />;
}

function Denied({ title }: { title: string }) {
  return (
    <>
      <PageHeader crumbs={[...CRUMBS, { label: title }]} title={title} />
      <Alert tone="info" title="Accès refusé">Votre rôle ne permet pas de créer ou de modifier des tâches. Vous pouvez en consulter la liste.</Alert>
    </>
  );
}

function CreateTask() {
  const permissions = useTaskPermissions();
  const timezone = useOrgTimezone();
  const { search } = useGestionNavigation();
  const retry = useRetryPlanning();
  if (!permissions.pending && !permissions.write) return <Denied title="Nouvelle tâche" />;
  const link = (key: string): string => {
    const value = search.get(key) ?? '';
    return UUID.test(value) ? value : '';
  };
  return (
    <>
      <PageHeader crumbs={[...CRUMBS, { label: 'Nouvelle tâche' }]} title="Nouvelle tâche" subtitle="Une action à faire, avec son échéance et, si besoin, son responsable." />
      <QueryState query={timezone} label="Chargement du formulaire" title="Impossible de préparer le formulaire" onRetry={retry} />
      {timezone.data === undefined ? null : <TaskForm task={null} defaults={{ ...emptyValues(todayIn(timezone.data)), propertyId: link('bien'), unitId: link('lot'), leaseId: link('bail') }} />}
    </>
  );
}

function emptyValues(dueOn: string): TaskFormValues {
  return { title: '', dueOn, assigneeUserId: '', remindDaysBefore: '', propertyId: '', unitId: '', leaseId: '' };
}

function EditTask({ id }: { id: string }) {
  const permissions = useTaskPermissions();
  const task = usePlanningTask(id);
  const retry = useRetryPlanning();
  const [conflict, setConflict] = useState(false);
  if (!permissions.pending && !permissions.write) return <Denied title="Modifier la tâche" />;
  return (
    <>
      <PageHeader crumbs={[...CRUMBS, { label: 'Modifier la tâche' }]} title="Modifier la tâche" subtitle="Seule une tâche ouverte peut être modifiée." />
      <QueryState query={task} label="Chargement de la tâche" title="Impossible de charger la tâche" notFound={NOT_FOUND} onRetry={retry} />
      {task.data === undefined ? null : task.data.status === 'open' ? (
        <TaskForm key={task.data.lockVersion} task={task.data} defaults={taskToFormValues(task.data)} reloaded={conflict} onConflict={() => { setConflict(true); }} />
      ) : (
        <Alert tone="info" title="Tâche non modifiable">
          Cette tâche est {task.data.status === 'done' ? 'terminée' : 'annulée'} : rouvrez-la depuis sa fiche pour la modifier.
          <span className="ml-2"><LinkButton href={taskPaths.detail(task.data.id)} size="sm">Ouvrir la tâche</LinkButton></span>
        </Alert>
      )}
    </>
  );
}

interface TaskFormProps {
  task: PlanningTask | null;
  defaults: TaskFormValues;
  reloaded?: boolean;
  onConflict?: () => void;
}

function TaskForm({ task, defaults, reloaded = false, onConflict }: TaskFormProps) {
  const { push } = useGestionNavigation();
  const create = useCreateTask();
  const update = useUpdateTask();
  const attemptId = useAttemptId();
  const choices = useTaskChoices();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm<TaskFormValues, undefined, TaskFormOutput>({ resolver: zodResolver(taskFormSchema), defaultValues: defaults, mode: 'onSubmit', reValidateMode: 'onChange' });

  const inactiveOption = task?.assigneeUserId && task.assigneeActive === false ? [{ value: task.assigneeUserId, label: choices.assigneeLabel(task) }] : [];
  const assigneeOptions = [...choices.memberOptions, ...inactiveOption.filter((option) => !choices.memberOptions.some((member) => member.value === option.value))];
  const incomplete = choices.members.data?.complete === false;
  const assigneeHint = task?.assigneeActive === false ? 'Ce responsable a quitté l’organisation : choisissez-en un nouveau.' : incomplete ? 'Seuls les membres dont l’identifiant est connu du serveur peuvent être choisis.' : undefined;

  const run = async (values: TaskFormOutput): Promise<void> => {
    setFailure(null);
    const input = toTaskInput(values);
    try {
      const saved = task === null ? await create.mutateAsync({ input, clientId: attemptId(JSON.stringify(input)) }) : await update.mutateAsync({ id: task.id, lockVersion: task.lockVersion, input });
      noticeAfterNavigation({ title: task === null ? 'Tâche créée' : 'Tâche modifiée' });
      push(taskPaths.detail(saved.id));
    } catch (error) {
      if (error instanceof OrgApiError && error.kind === 'stale') onConflict?.();
      setFailure(error);
    }
  };

  const submit = form.handleSubmit(run);

  return (
    <Card role="region" aria-label="Formulaire de tâche" className="gap-4">
      <form noValidate className="flex flex-col gap-4" onSubmit={(event) => { void submit(event); }}>
        {reloaded ? <Alert tone="warning" title="Tâche rechargée">Cette tâche a été modifiée entre-temps. Les valeurs ci-dessous sont celles du serveur : relisez-les avant d’enregistrer de nouveau.</Alert> : null}
        <TaskFormFields control={form.control} register={form.register} setValue={form.setValue} errors={form.formState.errors} assigneeOptions={assigneeOptions} assigneeHint={assigneeHint} propertyOptions={choices.propertyOptions} leaseOptions={choices.leaseOptions} />
        {Object.keys(form.formState.errors).length > 0 ? <Alert tone="danger" title="Le formulaire contient des erreurs">Corrigez les champs signalés puis enregistrez de nouveau.</Alert> : null}
        {failure === null ? null : <ActionError title={task === null ? 'Tâche non créée' : 'Tâche non modifiée'} error={failure} />}
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href={task === null ? taskPaths.list : taskPaths.detail(task.id)} variant="ghost">Annuler</LinkButton>
          <Button type="submit" loading={form.formState.isSubmitting || create.isPending || update.isPending}>{task === null ? 'Créer la tâche' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Card>
  );
}
