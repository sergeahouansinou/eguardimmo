'use client';

import { Button, Icon, IconButton, Select, TextField } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { amountHint } from './amounts';
import { taxCategoryLabel } from './labels';
import { TAX_CATEGORIES } from './model';
import type { DraftLineInput, TaxCategory } from './model';
import type { Currency } from '../../../format/money';

export interface EditableLine extends DraftLineInput {
  key: string;
}

const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: '€', XOF: 'FCFA', CAD: '$CA' };
const taxOptions = TAX_CATEGORIES.map((category) => ({ value: category, label: `${taxCategoryLabel[category]} (${category})` }));
const isTaxCategory = (value: string): value is TaxCategory => TAX_CATEGORIES.some((category) => category === value);
const MAX_LINES = 100;

let counter = 0;
export const newLine = (overrides: Partial<DraftLineInput> = {}): EditableLine => {
  counter += 1;
  return { key: `ligne-${String(counter)}`, itemTermId: '', description: '', quantity: '1', unitPrice: '', taxCategory: 'S', ...overrides };
};

export function InvoiceLinesEditor({
  lines,
  onChange,
  terms,
  currency,
  disabled,
}: {
  lines: readonly EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  terms: readonly { value: string; label: string }[];
  currency: Currency;
  disabled: boolean;
}) {
  const update = (key: string, patch: Partial<DraftLineInput>) => { onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line))); };
  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => {
        const position = String(index + 1);
        return (
          <fieldset key={line.key} className="flex flex-col gap-2 rounded-md border border-line p-3" disabled={disabled}>
            <legend className="px-1 text-caption text-fg-muted">{`Ligne ${position}`}</legend>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Select label={`Nature, ligne ${position} *`} placeholder="Choisir une nature" options={terms} value={line.itemTermId} onValueChange={(value) => { update(line.key, { itemTermId: value }); }} />
              <TextField label={`Libellé, ligne ${position} *`} placeholder="Ex. Honoraires de gestion, novembre 2026" maxLength={255} value={line.description} onChange={(event) => { update(line.key, { description: event.target.value }); }} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TextField label={`Quantité, ligne ${position} *`} placeholder="Ex. 1 ou 2,5" inputMode="decimal" value={line.quantity} onChange={(event) => { update(line.key, { quantity: event.target.value }); }} />
              <TextField label={`Prix unitaire HT (${CURRENCY_SYMBOL[currency]}), ligne ${position} *`} placeholder={amountHint(currency)} inputMode="decimal" value={line.unitPrice} onChange={(event) => { update(line.key, { unitPrice: event.target.value }); }} />
              <Select label={`Catégorie de taxe, ligne ${position} *`} placeholder="Catégorie" options={taxOptions} value={line.taxCategory} onValueChange={(value) => { if (isTaxCategory(value)) update(line.key, { taxCategory: value }); }} />
            </div>
            {lines.length > 1 ? (
              <div className="flex justify-end">
                <IconButton label={`Supprimer la ligne ${position}`} icon={Trash2} variant="ghost" onClick={() => { onChange(lines.filter((candidate) => candidate.key !== line.key)); }} />
              </div>
            ) : null}
          </fieldset>
        );
      })}
      <div>
        <Button variant="secondary" size="sm" disabled={disabled || lines.length >= MAX_LINES} onClick={() => { onChange([...lines, newLine()]); }}>
          <Icon icon={Plus} />
          Ajouter une ligne
        </Button>
      </div>
    </div>
  );
}
