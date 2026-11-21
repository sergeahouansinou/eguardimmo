import type { z } from 'zod';
import { invalidInput } from './chargesErrors';
import { exerciseBodySchema, expenseBodySchema, idempotencyKeySchema, itemBodySchema, keyBodySchema, planBodySchema, reasonSchema } from './payloadSchemas';
import type { ExerciseInput, ExpenseInput, ItemInput, KeyInput, PlanInput } from '../model';

const MAX_SOURCES_PER_REQUEST = 500;

function check<S extends z.ZodType>(schema: S, value: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidInput(message);
  return parsed.data;
}

const orUndefined = (text: string): string | undefined => (text.trim() === '' ? undefined : text.trim());

export const assertKey = (key: string): string => check(idempotencyKeySchema, key, 'La clé de saisie est invalide : rechargez la page.');
export const reasonOf = (reason: string): string => check(reasonSchema, reason, 'Le motif doit contenir entre 3 et 255 caractères.');

export function expensePayload(input: ExpenseInput): FormData {
  const body = check(
    expenseBodySchema,
    {
      property_id: input.propertyId,
      unit_id: orUndefined(input.unitId),
      kind: input.kind,
      category_term_id: input.categoryTermId,
      payee_label: orUndefined(input.payeeLabel),
      reference: orUndefined(input.reference),
      document_on: input.documentOn,
      service_from: input.serviceFrom,
      service_to: input.serviceTo,
      total_gross: input.totalGross,
      tax_amount: input.taxAmount,
      recoverable_amount: input.recoverableAmount,
      recoverable_rubric: input.recoverableAmount > 0 ? orUndefined(input.recoverableRubric) : undefined,
      settlement: input.settlement,
      paid_on: orUndefined(input.paidOn),
    },
    'La dépense est invalide : relisez les montants, les dates et la catégorie.',
  );
  const form = new FormData();
  const append = (name: string, value: string | number | undefined): void => {
    if (value !== undefined) form.set(name, String(value));
  };
  for (const [name, value] of Object.entries(body)) append(name, value);
  if (input.document !== null) form.set('document', input.document);
  return form;
}

function itemBody(item: ItemInput): z.infer<typeof itemBodySchema> {
  return check(
    itemBodySchema,
    {
      label: item.label,
      rubric: item.rubric,
      key_id: item.keyId ?? undefined,
      unit_id: item.unitId ?? undefined,
      sources: item.sources.map((source) => ({ kind: source.kind, id: source.id, amount: source.amount ?? undefined })),
      consumptions: item.consumptions.map((consumption) => ({ unit_id: consumption.unitId, quantity_milli: consumption.quantityMilli })),
    },
    `Le poste « ${item.label} » est invalide : relisez son libellé, sa rubrique et ses sources.`,
  );
}

export function itemsPayload(items: readonly ItemInput[]): z.infer<typeof itemBodySchema>[] {
  const total = items.reduce((sum, item) => sum + item.sources.length, 0);
  if (total > MAX_SOURCES_PER_REQUEST) throw invalidInput(`Une requête porte au plus ${String(MAX_SOURCES_PER_REQUEST)} sources au total (${String(total)} reçues) : scindez les postes.`);
  return items.map(itemBody);
}

export function exercisePayload(input: ExerciseInput): z.infer<typeof exerciseBodySchema> {
  return check(
    exerciseBodySchema,
    { property_id: input.propertyId, period_start: input.periodStart, period_end: input.periodEnd, items: itemsPayload(input.items) },
    'L’exercice est invalide : relisez le bien et la période.',
  );
}

export function exerciseUpdatePayload(lockVersion: number, items: readonly ItemInput[]): { lock_version: number; items: z.infer<typeof itemBodySchema>[] } {
  return { lock_version: lockVersion, items: itemsPayload(items) };
}

export function keyPayload(input: KeyInput): z.infer<typeof keyBodySchema> {
  return check(
    keyBodySchema,
    { label: input.label, kind: input.kind, valid_from: input.validFrom, shares: input.shares.map((share) => ({ unit_id: share.unitId, weight: share.weight })) },
    'La clé est invalide : relisez le libellé, la date d’effet et les poids.',
  );
}

export function versionPayload(validFrom: string, shares: KeyInput['shares']): Pick<z.infer<typeof keyBodySchema>, 'valid_from' | 'shares'> {
  const body = keyPayload({ label: 'Version', kind: 'custom', validFrom, shares });
  return { valid_from: body.valid_from, shares: body.shares };
}

export function planPayload(input: PlanInput): z.infer<typeof planBodySchema> {
  return check(planBodySchema, input, 'Le motif doit contenir entre 3 et 255 caractères.');
}
