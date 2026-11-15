'use client';

import type { ReactNode } from 'react';
import { Button, Select } from '@eguardimmo/ui';
import { Segmented } from '../../kit';
import { LOT_TYPES, WINDOW_END, WINDOW_START } from '../constants';
import type { Filters, PeriodKey } from '../compute/aggregate';
import { monthLongLabel, monthRange } from '../months';
import type { Building } from '../schemas';

export function FilterBar({ children, onReset }: { children: ReactNode; onReset: () => void }) {
  return (
    <section aria-label="Filtres" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2">
      {children}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onReset}>
        Réinitialiser
      </Button>
    </section>
  );
}

export function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="text-caption font-semibold whitespace-nowrap text-fg-subtle">{children}</span>;
}

export function FilterSeparator() {
  return <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />;
}

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: '3m', label: '3 mois' },
  { value: '12m', label: '12 mois' },
  { value: 'year', label: 'Année 2026' },
  { value: 'custom', label: 'Personnalisée' },
];

export function PeriodFilter({ filters, onChange }: { filters: Filters; onChange: (patch: Partial<Filters>) => void }) {
  const months = monthRange(WINDOW_START, WINDOW_END).map((month) => ({ value: month, label: monthLongLabel(month) }));
  return (
    <>
      <FilterLabel>Période</FilterLabel>
      <Segmented label="Période" options={PERIOD_OPTIONS} value={filters.period} onValueChange={(period) => { onChange({ period }); }} />
      {filters.period === 'custom' ? (
        <>
          <Select
            label="Du"
            hideLabel
            placeholder="Mois de début"
            options={months}
            value={filters.from}
            onValueChange={(from) => { onChange({ from, to: filters.to < from ? from : filters.to }); }}
            className="w-full sm:w-40"
          />
          <Select
            label="Au"
            hideLabel
            placeholder="Mois de fin"
            options={months.filter((month) => month.value >= filters.from)}
            value={filters.to}
            onValueChange={(to) => { onChange({ to }); }}
            className="w-full sm:w-40"
          />
        </>
      ) : null}
    </>
  );
}

export function BuildingSelect({
  buildings,
  value,
  onValueChange,
}: {
  buildings: readonly Building[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      label="Immeuble"
      hideLabel
      placeholder="Immeuble : Tous"
      options={[
        { value: 'all', label: 'Immeuble : Tous' },
        ...buildings.map((building) => ({ value: building.id, label: `Immeuble : ${building.name}` })),
      ]}
      value={value}
      onValueChange={onValueChange}
      className="w-full sm:w-[190px]"
    />
  );
}

export function TypeSelect({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  return (
    <Select
      label="Type de bien"
      hideLabel
      placeholder="Type de bien : Tous"
      options={[
        { value: 'all', label: 'Type de bien : Tous' },
        ...LOT_TYPES.map((type) => ({ value: type.id, label: `Type de bien : ${type.label}` })),
      ]}
      value={value}
      onValueChange={onValueChange}
      className="w-full sm:w-[190px]"
    />
  );
}
