import type { Currency } from '../../../format/money';
import type { ChargeKey, ExerciseItem, ItemInput, UnitChoice } from './model';
import { minorToInput } from './schemas';
import type { ItemsFormOutput, ItemsFormValues } from './schemas';

const KEY_PREFIX = 'key:';
const UNIT_PREFIX = 'unit:';

export const keyTarget = (id: string): string => `${KEY_PREFIX}${id}`;
export const unitTarget = (id: string): string => `${UNIT_PREFIX}${id}`;

function milliToInput(milli: number): string {
  const whole = Math.trunc(milli / 1000);
  const decimals = String(milli % 1000).padStart(3, '0').replace(/0+$/, '');
  return decimals === '' ? String(whole) : `${String(whole)},${decimals}`;
}

export function hasForeignSources(items: readonly ExerciseItem[]): boolean {
  return items.some((item) => item.sources.some((source) => source.kind !== 'expense'));
}

export function toFormItems(items: readonly ExerciseItem[], currency: Currency, units: readonly UnitChoice[]): ItemsFormValues['items'] {
  return items.map((item) => ({
    label: item.label,
    rubric: item.rubric,
    target: item.keyId === null ? unitTarget(item.unitId ?? '') : keyTarget(item.keyId),
    sources: item.sources.map((source) => ({ id: source.id, amount: minorToInput(source.amount.amount, currency) })),
    consumptions: units.map((unit) => {
      const known = item.consumptions.find((consumption) => consumption.unitId === unit.id);
      return { unitId: unit.id, quantity: known === undefined ? '' : milliToInput(known.quantityMilli) };
    }),
  }));
}

export function emptyItem(units: readonly UnitChoice[]): ItemsFormValues['items'][number] {
  return { label: '', rubric: '', target: '', sources: [{ id: '', amount: '' }], consumptions: units.map((unit) => ({ unitId: unit.id, quantity: '' })) };
}

export function toItemInputs(output: ItemsFormOutput, keys: readonly ChargeKey[]): ItemInput[] {
  return output.items.map((item) => {
    const keyId = item.target.startsWith(KEY_PREFIX) ? item.target.slice(KEY_PREFIX.length) : null;
    const unitId = item.target.startsWith(UNIT_PREFIX) ? item.target.slice(UNIT_PREFIX.length) : null;
    const consumption = keyId !== null && keys.find((key) => key.id === keyId)?.kind === 'consumption';
    return {
      label: item.label,
      rubric: item.rubric,
      keyId,
      unitId,
      sources: item.sources.map((source) => ({ kind: 'expense' as const, id: source.id, amount: source.amount })),
      consumptions: consumption
        ? item.consumptions.flatMap((row) => (row.quantity === null ? [] : [{ unitId: row.unitId, quantityMilli: row.quantity }]))
        : [],
    };
  });
}
