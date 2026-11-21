'use client';

import { Button, Card, CardTitle, Select, TextField } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { currencyHint } from './labels';
import { feeKindLabel } from '../labels';
import { FEE_KINDS } from '../model';
import { FEE_BASES, FEE_TAX_MODES, MONTHS_MAX, MONTHS_MIN } from './model';
import type { FeeMandateOption } from './model';
import { BASE_LABEL, TAX_MODE_LABEL } from './labels';
import type { SimulationDraft, SimulationErrors } from './form';

const MONTH_OPTIONS: SelectOption[] = Array.from({ length: MONTHS_MAX - MONTHS_MIN + 1 }, (_, index) => {
  const value = String(index + MONTHS_MIN);
  return { value, label: `${value} mois` };
});
const KIND_OPTIONS: SelectOption[] = FEE_KINDS.map((value) => ({ value, label: feeKindLabel[value] }));
const BASE_OPTIONS: SelectOption[] = FEE_BASES.map((value) => ({ value, label: BASE_LABEL[value] }));
const TAX_OPTIONS: SelectOption[] = FEE_TAX_MODES.map((value) => ({ value, label: TAX_MODE_LABEL[value] }));

export function SimulationForm({
  mandates,
  selected,
  draft,
  errors,
  pending,
  onMandate,
  onChange,
  onSubmit,
}: {
  mandates: readonly FeeMandateOption[];
  selected: FeeMandateOption | undefined;
  draft: SimulationDraft;
  errors: SimulationErrors;
  pending: boolean;
  onMandate: (id: string) => void;
  onChange: (patch: Partial<SimulationDraft>) => void;
  onSubmit: () => void;
}) {
  const currency = selected?.currency ?? 'EUR';
  const options: SelectOption[] = mandates.map((mandate) => ({ value: mandate.id, label: `${mandate.reference} · ${mandate.mandantName}` }));
  return (
    <form
      noValidate
      aria-label="Barème à simuler"
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Card role="region" aria-label="Mandat concerné">
        <CardTitle as="h2">Mandat concerné</CardTitle>
        <Select
          label="Mandat *"
          placeholder="Choisir un mandat"
          searchable
          options={options}
          value={draft.mandateId}
          onValueChange={onMandate}
          error={errors.mandateId}
          hint={selected?.terms === null ? 'Ce mandat n’a pas de barème en vigueur : renseignez-le ci-dessous.' : 'Le barème en vigueur du mandat préremplit le formulaire.'}
        />
      </Card>
      <Card role="region" aria-label="Barème proposé">
        <CardTitle as="h2">Barème proposé</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Type d’honoraires *" placeholder="Choisir un type" options={KIND_OPTIONS} value={draft.kind} onValueChange={(value) => { onChange({ kind: value === 'flat' ? 'flat' : 'percentage' }); }} error={errors.kind} />
          {draft.kind === 'percentage' ? (
            <TextField label="Taux, % *" placeholder="Ex. 7,5" inputMode="decimal" autoComplete="off" value={draft.rate} error={errors.rate} onChange={(event) => { onChange({ rate: event.target.value }); }} />
          ) : (
            <TextField label="Forfait mensuel *" placeholder={currencyHint(currency)} inputMode="decimal" autoComplete="off" value={draft.flat} error={errors.flat} onChange={(event) => { onChange({ flat: event.target.value }); }} />
          )}
          <Select
            label="Base de calcul *"
            placeholder="Choisir une base"
            options={BASE_OPTIONS}
            value={draft.base}
            onValueChange={(value) => { onChange({ base: value === 'rent' || value === 'rent_and_charges' ? value : '' }); }}
            error={errors.base}
          />
          <TextField label="Minimum mensuel" placeholder={currencyHint(currency)} inputMode="decimal" autoComplete="off" value={draft.minimum} error={errors.minimum} hint="Laissez vide pour aucun minimum." onChange={(event) => { onChange({ minimum: event.target.value }); }} />
          <Select label="Mode de taxe *" placeholder="Choisir un mode" options={TAX_OPTIONS} value={draft.taxMode} onValueChange={(value) => { onChange({ taxMode: value === 'incl_tax' ? 'incl_tax' : 'excl_tax' }); }} error={errors.taxMode} />
          <Select label="Mois clos simulés *" placeholder="Choisir une durée" options={MONTH_OPTIONS} value={draft.months} onValueChange={(value) => { onChange({ months: value }); }} error={errors.months} />
        </div>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" loading={pending}>Simuler le barème</Button>
      </div>
    </form>
  );
}
