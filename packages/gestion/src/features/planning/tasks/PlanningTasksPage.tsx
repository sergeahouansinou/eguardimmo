'use client';

import { Alert, Card, Checkbox, Select, TextField } from '@eguardimmo/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { LinkButton, PageHeader } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { useCursorPages } from '../../finances/rent/CursorPager';
import { useTaskPermissions } from './permissions';
import { useTaskChoices } from './choices';
import { STATUS_FILTERS, statusOfFilter } from './labels';
import type { StatusFilter } from './labels';
import { TaskBulkBar } from './TaskBulkBar';
import { TasksTable } from './TasksTable';
import { taskPaths } from '../taskPaths';

const ALL = '';
const EMPTY: ReadonlySet<string> = new Set();

export function PlanningTasksPage() {
  const permissions = useTaskPermissions();
  const choices = useTaskChoices();
  const pages = useCursorPages();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [assignee, setAssignee] = useState(ALL);
  const [propertyId, setPropertyId] = useState(ALL);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [picked, setPicked] = useState<{ cursor: string | null; ids: ReadonlySet<string> }>({ cursor: null, ids: new Set() });
  const selection = picked.cursor === pages.cursor ? picked.ids : EMPTY;
  const setSelection = (ids: ReadonlySet<string>) => { setPicked({ cursor: pages.cursor, ids }); };

  const reset = () => {
    pages.reset();
    setSelection(EMPTY);
  };
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    reset();
  };

  const rangeInvalid = dueFrom !== '' && dueTo !== '' && dueTo <= dueFrom;
  const query = {
    cursor: pages.cursor,
    status: statusOfFilter(status),
    assignee: assignee === ALL ? null : assignee,
    propertyId: propertyId === ALL ? null : propertyId,
    dueFrom: dueFrom === '' ? null : dueFrom,
    dueTo: dueTo === '' ? null : dueTo,
    overdue,
  };
  const filtered = status !== 'open' || assignee !== ALL || propertyId !== ALL || dueFrom !== '' || dueTo !== '' || overdue;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Tâches' }]}
        title="Tâches"
        subtitle="Ce qui reste à faire, par échéance."
        actions={permissions.write ? <LinkButton href={taskPaths.create} variant="primary" icon={Plus}>Nouvelle tâche</LinkButton> : null}
      />
      <Card role="region" aria-label="Liste des tâches" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Statut" placeholder="Ouvertes" options={STATUS_FILTERS.map((option) => ({ value: option.value, label: option.label }))} value={status} onValueChange={(value) => { filter(setStatus)(STATUS_FILTERS.find((option) => option.value === value)?.value ?? 'open'); }} />
          <Select label="Responsable" placeholder="Tous" options={[{ value: ALL, label: 'Tous les responsables' }, { value: 'me', label: 'Mes tâches' }, ...choices.memberOptions]} value={assignee} onValueChange={filter(setAssignee)} searchable />
          <Select label="Bien" placeholder="Tous les biens" options={[{ value: ALL, label: 'Tous les biens' }, ...choices.propertyOptions]} value={propertyId} onValueChange={filter(setPropertyId)} searchable />
          <TextField label="Échéance à partir du" type="date" placeholder="AAAA-MM-JJ" value={dueFrom} onChange={(event) => { filter(setDueFrom)(event.target.value); }} />
          <TextField label="Échéance avant le (exclu)" type="date" placeholder="AAAA-MM-JJ" value={dueTo} error={rangeInvalid ? 'Cette date doit suivre la date de début.' : undefined} onChange={(event) => { filter(setDueTo)(event.target.value); }} />
          <div className="flex h-8 items-center">
            <Checkbox label="En retard seulement" checked={overdue} onChange={(event) => { filter(setOverdue)(event.target.checked); }} />
          </div>
        </div>
        {permissions.write ? <TaskBulkBar ids={[...selection]} assigneeOptions={choices.memberOptions} onDone={reset} onClear={() => { setSelection(EMPTY); }} /> : null}
        {rangeInvalid ? (
          <Alert tone="warning" title="Période invalide">La date de fin doit être postérieure à la date de début.</Alert>
        ) : (
          <TasksTable query={query} pages={pages} permissions={permissions} filtered={filtered} selection={selection} onSelectionChange={setSelection} />
        )}
      </Card>
    </>
  );
}
