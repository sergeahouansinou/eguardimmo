import { Button, Select } from '@eguardimmo/ui';
import { ALL } from './engine/engine';
import type { ReportsData } from './engine/data';
import type { ReportDefinition, ReportFilters } from './engine/types';

export interface ReportFiltersProps {
  definition: ReportDefinition;
  data: ReportsData;
  filters: ReportFilters;
  onChange: (next: Partial<ReportFilters>) => void;
  onReset: () => void;
}

export function ReportFiltersBar({ definition, data, filters, onChange, onReset }: ReportFiltersProps) {
  const tenants = [...new Map(data.leases.map((lease) => [lease.tenantId, lease.tenantName])).entries()];
  const lots = data.lots.filter((lot) => definition.filters.tenant || data.assets.some((asset) => asset.lotId === lot.id) || data.leases.some((lease) => lease.lotId === lot.id));
  return (
    <section aria-label="Filtres" className="flex flex-wrap items-center gap-2">
      {definition.periods ? (
        <Select
          label="Période"
          hideLabel
          placeholder="Période"
          options={definition.periods.map((period) => ({ value: period.key, label: `${period.label} : ${period.start} → ${period.end}` }))}
          value={filters.period}
          onValueChange={(period) => { onChange({ period }); }}
          className="w-full sm:w-[320px]"
        />
      ) : null}
      {definition.filters.lot ? (
        <Select
          label="Bien"
          hideLabel
          placeholder="Bien : Tous"
          options={[{ value: ALL, label: 'Bien : Tous' }, ...lots.map((lot) => ({ value: lot.id, label: `Bien : ${lot.name}` }))]}
          value={filters.lotId}
          onValueChange={(lotId) => { onChange({ lotId }); }}
          className="w-full sm:w-[190px]"
        />
      ) : null}
      {definition.filters.tenant ? (
        <Select
          label="Locataire"
          hideLabel
          placeholder="Locataire : Tous"
          options={[{ value: ALL, label: 'Locataire : Tous' }, ...tenants.map(([id, name]) => ({ value: id, label: `Locataire : ${name}` }))]}
          value={filters.tenantId}
          onValueChange={(tenantId) => { onChange({ tenantId }); }}
          className="w-full sm:w-[230px]"
        />
      ) : null}
      {definition.groups.length > 1 ? (
        <Select
          label="Regroupement"
          hideLabel
          placeholder="Regrouper par"
          options={definition.groups.map((group) => ({ value: group.value, label: group.label }))}
          value={filters.group}
          onValueChange={(group) => { onChange({ group }); }}
          className="w-full sm:w-[240px]"
        />
      ) : null}
      <Button variant="ghost" size="sm" onClick={onReset}>
        Réinitialiser
      </Button>
    </section>
  );
}
