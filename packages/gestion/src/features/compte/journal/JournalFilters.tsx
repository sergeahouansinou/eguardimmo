'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Button, Icon, Popover, PopoverClose, PopoverContent, PopoverTrigger, Select, TextField } from '@eguardimmo/ui';
import { FilterChip } from '../../outils/kit';
import { formatDay } from '../shared/dates';
import { EVENT_TYPES, EVENT_TYPE_LABELS } from './schemas';
import type { EventType } from './schemas';
import type { JournalFilters } from './filters';

export interface MemberOption {
  id: string;
  name: string;
}

function PeriodPicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const invalid = draftFrom === '' || draftTo === '' || draftFrom > draftTo;
  const error = draftFrom !== '' && draftTo !== '' && draftFrom > draftTo ? 'La date de fin précède la date de début.' : undefined;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraftFrom(from);
          setDraftTo(to);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Période : ${formatDay(from)} → ${formatDay(to)}`}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-sm border border-line-control bg-surface px-2.5 text-left text-body text-fg focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus sm:w-[236px]"
        >
          <span className="truncate">{`${formatDay(from)} → ${formatDay(to)}`}</span>
          <Icon icon={CalendarDays} className="text-fg-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Choisir la période" align="start" className="w-72 gap-3 p-3">
        <TextField label="Du" type="date" placeholder="jj/mm/aaaa" value={draftFrom} onChange={(event) => { setDraftFrom(event.target.value); }} />
        <TextField label="Au" type="date" placeholder="jj/mm/aaaa" value={draftTo} error={error} onChange={(event) => { setDraftTo(event.target.value); }} />
        <div className="flex flex-wrap justify-end gap-2">
          <PopoverClose asChild>
            <Button variant="secondary">Annuler</Button>
          </PopoverClose>
          <Button
            disabled={invalid}
            onClick={() => {
              onChange(draftFrom, draftTo);
              setOpen(false);
            }}
          >
            Appliquer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface JournalFiltersBarProps {
  filters: JournalFilters;
  members: readonly MemberOption[];
  onChange: (patch: Partial<JournalFilters>) => void;
}

export function JournalFiltersBar({ filters, members, onChange }: JournalFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <TextField
        label="Rechercher dans le journal"
        hideLabel
        type="search"
        placeholder="Action, bien, locataire"
        className="sm:w-60"
        value={filters.search}
        onChange={(event) => { onChange({ search: event.target.value }); }}
      />
      <PeriodPicker from={filters.from} to={filters.to} onChange={(from, to) => { onChange({ from, to }); }} />
      <Select
        label="Membre"
        hideLabel
        placeholder="Membre : Tous"
        className="w-full sm:w-[180px]"
        value={filters.member}
        options={[{ value: 'all', label: 'Membre : Tous' }, ...members.map((member) => ({ value: member.id, label: `Membre : ${member.name}` }))]}
        onValueChange={(member) => { onChange({ member }); }}
      />
      <Select
        label="Type"
        hideLabel
        placeholder="Type : Tous"
        className="w-full sm:w-[180px]"
        value={filters.type}
        options={[{ value: 'all', label: 'Type : Tous' }, ...EVENT_TYPES.map((type) => ({ value: type, label: `Type : ${EVENT_TYPE_LABELS[type]}` }))]}
        onValueChange={(value) => {
          const type = EVENT_TYPES.find((candidate): candidate is EventType => candidate === value);
          onChange({ type: type ?? 'all' });
        }}
      />
      <FilterChip pressed={filters.type === 'securite'} onPressedChange={(pressed) => { onChange({ type: pressed ? 'securite' : 'all' }); }}>
        Sécurité uniquement
      </FilterChip>
    </div>
  );
}
