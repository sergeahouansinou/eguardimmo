'use client';

import { Checkbox, Select } from '@eguardimmo/ui';
import { CERTIFICATE_STATES } from './model';
import type { CertificateState, CertificateType } from './model';
import { stateFilterLabel } from './labels';

export const ALL = 'tous';

export interface CertificateFilterState {
  state: string;
  typeId: string;
  includeReplaced: boolean;
}

export const NO_FILTER: CertificateFilterState = { state: ALL, typeId: ALL, includeReplaced: false };

export const isState = (value: string): value is CertificateState => CERTIFICATE_STATES.some((state) => state === value);

export const isFiltered = (filters: CertificateFilterState): boolean => filters.state !== ALL || filters.typeId !== ALL || filters.includeReplaced;

const stateOptions = [{ value: ALL, label: 'Tous les états' }, ...CERTIFICATE_STATES.map((state) => ({ value: state, label: stateFilterLabel[state] }))];

export function CertificateFilters({ filters, types, onChange }: { filters: CertificateFilterState; types: readonly CertificateType[]; onChange: (next: CertificateFilterState) => void }) {
  return (
    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Select label="État" hideLabel placeholder="État" value={filters.state} onValueChange={(state) => { onChange({ ...filters, state }); }} options={stateOptions} />
      <Select
        label="Type de pièce"
        hideLabel
        placeholder="Type de pièce"
        value={filters.typeId}
        onValueChange={(typeId) => { onChange({ ...filters, typeId }); }}
        searchable
        searchPlaceholder="Rechercher un type"
        options={[{ value: ALL, label: 'Tous les types' }, ...types.map((type) => ({ value: type.id, label: type.label }))]}
      />
      <Checkbox label="Inclure les pièces remplacées" checked={filters.includeReplaced} onChange={(event) => { onChange({ ...filters, includeReplaced: event.target.checked }); }} />
    </div>
  );
}
