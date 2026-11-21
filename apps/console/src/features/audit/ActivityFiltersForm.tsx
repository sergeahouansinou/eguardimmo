'use client';

import { Button, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { EMPTY_ACTIVITY_FILTERS, validateActivityFilters } from '@/console/schemas';
import type { ActivityFilterField, ActivityFilters } from '@/console/schemas';
import { FilterBar } from '@/ui/FilterBar';

interface FieldSpec {
  field: ActivityFilterField;
  label: string;
  placeholder: string;
  type?: 'date';
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'action', label: 'Action (préfixe)', placeholder: 'Ex. lease.' },
  { field: 'organization', label: 'Organisation', placeholder: 'Ex. 01934f6e-0000-7000-8000-000000000001' },
  { field: 'actor', label: 'Auteur', placeholder: 'Ex. 01934f6e-0000-7000-8000-000000000002' },
  { field: 'requestId', label: 'Requête', placeholder: 'Ex. 01934f6e-0000-7000-8000-000000000003' },
  { field: 'subjectType', label: 'Type d’entité', placeholder: 'Ex. user, organization' },
  { field: 'subjectId', label: 'Identifiant d’entité', placeholder: 'Ex. 01934f6e-0000-7000-8000-000000000004' },
  { field: 'from', label: 'Du', placeholder: '2026-11-01', type: 'date' },
  { field: 'to', label: 'Au (inclus)', placeholder: '2026-11-13', type: 'date' },
];

export interface ActivityFiltersFormProps {
  initial: ActivityFilters;
  onApply: (filters: ActivityFilters) => void;
}

export function ActivityFiltersForm({ initial, onApply }: ActivityFiltersFormProps) {
  const [draft, setDraft] = useState<ActivityFilters>(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateActivityFilters(draft) : {};

  const apply = (next: ActivityFilters) => {
    setSubmitted(true);
    if (Object.keys(validateActivityFilters(next)).length === 0) onApply(next);
  };
  const reset = () => {
    setDraft(EMPTY_ACTIVITY_FILTERS);
    setSubmitted(false);
    onApply(EMPTY_ACTIVITY_FILTERS);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        apply(draft);
      }}
    >
      <FilterBar label="Filtrer le journal d’audit">
        {FIELDS.map(({ field, label, placeholder, type }) => (
          <div key={field} className="w-full sm:w-56">
            <TextField
              label={label}
              placeholder={placeholder}
              {...(type ? { type } : {})}
              value={draft[field]}
              error={errors[field]}
              onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }); }}
            />
          </div>
        ))}
        <Button type="submit">Filtrer</Button>
        <Button type="button" variant="secondary" onClick={reset}>
          Effacer les filtres
        </Button>
      </FilterBar>
    </form>
  );
}
