'use client';

import { UserRoundCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Button, Icon, Select } from '@eguardimmo/ui';
import { consoleStatusLabel, priorityLabel } from '../copy';
import { CONSOLE_PRIORITIES, CONSOLE_STATUSES } from '../model';
import type { ConsolePriority, ConsoleTicketDetail, ConsoleTicketPatch } from '../model';
import { useConsoleStaff, useOperatorId } from '../queries';
import type { SupportTicketStatus } from '../../model';

const NONE = 'none';

function isStatus(value: string): value is SupportTicketStatus {
  return (CONSOLE_STATUSES as readonly string[]).includes(value);
}

function isPriority(value: string): value is ConsolePriority {
  return (CONSOLE_PRIORITIES as readonly string[]).includes(value);
}

export interface TicketControlsProps {
  ticket: ConsoleTicketDetail;
  busy: boolean;
  onPatch: (patch: ConsoleTicketPatch) => void;
}

export function TicketControls({ ticket, busy, onPatch }: TicketControlsProps) {
  const staff = useConsoleStaff();
  const operatorId = useOperatorId();
  const options = useMemo(() => {
    const known = staff.data ?? [];
    const list = known.map((person) => ({ value: person.id, label: person.id === operatorId ? `${person.name} (moi)` : person.name }));
    if (ticket.assignee !== null && !known.some((person) => person.id === ticket.assignee?.id)) {
      list.push({ value: ticket.assignee.id, label: ticket.assignee.name });
    }
    return [{ value: NONE, label: 'Non assignée' }, ...list];
  }, [staff.data, ticket.assignee, operatorId]);
  const mine = operatorId !== undefined && ticket.assignee?.id === operatorId;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
      <Select
        label="Statut"
        placeholder="Statut"
        value={ticket.status}
        disabled={busy}
        onValueChange={(value) => { if (isStatus(value) && value !== ticket.status) onPatch({ status: value }); }}
        options={CONSOLE_STATUSES.map((value) => ({ value, label: consoleStatusLabel[value] }))}
      />
      <Select
        label="Priorité"
        placeholder="Priorité"
        value={ticket.priority}
        disabled={busy}
        onValueChange={(value) => { if (isPriority(value) && value !== ticket.priority) onPatch({ priority: value }); }}
        options={CONSOLE_PRIORITIES.map((value) => ({ value, label: priorityLabel[value] }))}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Select
          label="Assignée à"
          placeholder="Non assignée"
          value={ticket.assignee?.id ?? NONE}
          disabled={busy || staff.isPending}
          onValueChange={(value) => { onPatch({ assigneeId: value === NONE ? null : value }); }}
          options={options}
          {...(staff.isError ? { hint: 'La liste de l’équipe n’a pas pu être chargée.' } : {})}
        />
        {!mine && operatorId !== undefined ? (
          <div>
            <Button variant="link" size="sm" disabled={busy} onClick={() => { onPatch({ assigneeId: operatorId }); }}>
              <Icon icon={UserRoundCheck} />
              M’assigner la demande
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
