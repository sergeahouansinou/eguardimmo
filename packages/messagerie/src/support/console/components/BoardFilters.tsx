'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Icon, Select, TextField } from '@eguardimmo/ui';
import { spaceLabel } from '../../copy';
import { priorityLabel } from '../copy';
import { CONSOLE_PRIORITIES, CONSOLE_SPACES, SEARCH_MAX } from '../model';
import type { ConsoleAssigneeFilter, ConsolePriority, ConsoleTicketQuery } from '../model';
import { useConsoleStaff } from '../queries';
import type { SupportRequestSpace } from '../../model';

const SEARCH_DELAY_MS = 350;

function isPriority(value: string): value is ConsolePriority {
  return (CONSOLE_PRIORITIES as readonly string[]).includes(value);
}

function isSpace(value: string): value is SupportRequestSpace {
  return (CONSOLE_SPACES as readonly string[]).includes(value);
}

export interface BoardFiltersProps {
  query: ConsoleTicketQuery;
  organizationLabel: string | null;
  onChange: (patch: Partial<ConsoleTicketQuery>) => void;
}

export function BoardFilters({ query, organizationLabel, onChange }: BoardFiltersProps) {
  const staff = useConsoleStaff();
  const [input, setInput] = useState(query.search);
  useEffect(() => {
    if (input === query.search) return;
    const timer = setTimeout(() => { onChange({ search: input.slice(0, SEARCH_MAX) }); }, SEARCH_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [input, query.search, onChange]);
  const assignees = [
    { value: 'all', label: 'Toutes les assignations' },
    { value: 'none', label: 'Non assignées' },
    { value: 'me', label: 'Assignées à moi' },
    ...(staff.data ?? []).map((person) => ({ value: person.id, label: person.name })),
  ];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="max-w-2xl">
        <TextField
          label="Rechercher une demande"
          hideLabel
          type="search"
          maxLength={SEARCH_MAX}
          placeholder="Référence, sujet, demandeur ou organisation"
          value={input}
          onChange={(event) => { setInput(event.target.value); }}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Priorité"
          placeholder="Toutes les priorités"
          value={query.priority}
          onValueChange={(value) => { onChange({ priority: value === 'all' ? 'all' : isPriority(value) ? value : 'all' }); }}
          options={[{ value: 'all', label: 'Toutes les priorités' }, ...CONSOLE_PRIORITIES.map((value) => ({ value, label: priorityLabel[value] }))]}
        />
        <Select
          label="Assignation"
          placeholder="Toutes les assignations"
          value={query.assignee}
          onValueChange={(value) => { onChange({ assignee: value satisfies ConsoleAssigneeFilter }); }}
          options={assignees}
          {...(staff.isError ? { hint: 'La liste de l’équipe n’a pas pu être chargée.' } : {})}
        />
        <Select
          label="Espace du demandeur"
          placeholder="Tous les espaces"
          value={query.space}
          onValueChange={(value) => { onChange({ space: value === 'all' ? 'all' : isSpace(value) ? value : 'all' }); }}
          options={[{ value: 'all', label: 'Tous les espaces' }, ...CONSOLE_SPACES.map((value) => ({ value, label: spaceLabel[value] }))]}
        />
      </div>
      {query.organization !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{`Organisation : ${organizationLabel ?? 'sélectionnée'}`}</Badge>
          <Button variant="ghost" size="sm" onClick={() => { onChange({ organization: null }); }}>
            <Icon icon={X} />
            Retirer le filtre d’organisation
          </Button>
        </div>
      ) : null}
    </div>
  );
}
