'use client';

import { Button, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { ORGANISATION_KINDS, ORGANISATION_STATES, SEARCH_MIN_LENGTH } from '@/platform/organisations/organisations';
import type { OrganisationKind, OrganisationQuery, OrganisationState } from '@/platform/organisations/organisations';
import { SUBSCRIPTION_STATUSES } from '@/platform/plans/subscriptions';
import { FilterBar } from '@/ui/FilterBar';
import { ALL, KIND_LABELS, STATE_LABELS, SUBSCRIPTION_LABELS } from './labels';

export interface OrganisationFilterValues {
  search: string;
  kind: string;
  state: string;
  plan: string;
  subscriptionStatus: string;
}

export const EMPTY_FILTERS: OrganisationFilterValues = { search: '', kind: ALL, state: ALL, plan: '', subscriptionStatus: ALL };

const PLAN_PATTERN = /^[a-z0-9_-]*$/;

export function filterErrors(values: OrganisationFilterValues): Partial<Record<'search' | 'plan', string>> {
  const errors: Partial<Record<'search' | 'plan', string>> = {};
  const search = values.search.trim();
  if (search !== '' && search.length < SEARCH_MIN_LENGTH) errors.search = `Saisissez au moins ${String(SEARCH_MIN_LENGTH)} caractères.`;
  if (!PLAN_PATTERN.test(values.plan.trim()) || values.plan.trim().length > 32) errors.plan = 'Code de plan : minuscules, chiffres, tiret ou tiret bas.';
  return errors;
}

export function toOrganisationQuery(values: OrganisationFilterValues): OrganisationQuery {
  const pick = <T extends string>(value: string, allowed: readonly T[]): T | undefined => allowed.find((item) => item === value);
  return {
    search: values.search.trim() === '' ? undefined : values.search.trim(),
    kind: pick<OrganisationKind>(values.kind, ORGANISATION_KINDS),
    state: pick<OrganisationState>(values.state, ORGANISATION_STATES),
    plan: values.plan.trim() === '' ? undefined : values.plan.trim(),
    subscriptionStatus: values.subscriptionStatus === ALL ? undefined : values.subscriptionStatus,
  };
}

const option = (labels: Record<string, string>, keys: readonly string[]) => [{ value: ALL, label: 'Tous' }, ...keys.map((key) => ({ value: key, label: labels[key] ?? key }))];

export function OrganisationFilters({ onApply }: { onApply: (values: OrganisationFilterValues) => void }) {
  const [draft, setDraft] = useState<OrganisationFilterValues>(EMPTY_FILTERS);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? filterErrors(draft) : {};

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(filterErrors(draft)).length === 0) onApply(draft);
      }}
    >
      <FilterBar label="Filtrer les organisations">
        <div className="w-full sm:w-56">
          <TextField
            label="Nom (début)"
            placeholder="Ex. Agence du"
            value={draft.search}
            error={errors.search}
            onChange={(event) => { setDraft({ ...draft, search: event.target.value }); }}
          />
        </div>
        <div className="w-full sm:w-40">
          <Select label="Type" placeholder="Tous" options={option(KIND_LABELS, ORGANISATION_KINDS)} value={draft.kind} onValueChange={(kind) => { setDraft({ ...draft, kind }); }} />
        </div>
        <div className="w-full sm:w-40">
          <Select label="État" placeholder="Tous" options={option(STATE_LABELS, ORGANISATION_STATES)} value={draft.state} onValueChange={(state) => { setDraft({ ...draft, state }); }} />
        </div>
        <div className="w-full sm:w-40">
          <TextField label="Plan (code)" placeholder="Ex. silver" value={draft.plan} error={errors.plan} onChange={(event) => { setDraft({ ...draft, plan: event.target.value }); }} />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="Abonnement"
            placeholder="Tous"
            options={option(SUBSCRIPTION_LABELS, SUBSCRIPTION_STATUSES)}
            value={draft.subscriptionStatus}
            onValueChange={(subscriptionStatus) => { setDraft({ ...draft, subscriptionStatus }); }}
          />
        </div>
        <Button type="submit">Filtrer</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            setSubmitted(false);
            onApply(EMPTY_FILTERS);
          }}
        >
          Effacer les filtres
        </Button>
      </FilterBar>
    </form>
  );
}
