import { z } from 'zod';
import type { Currency } from '../../format/money';
import { minorToInput, parseMinor } from '../finances/banking/money';
import type { AssumptionsInput, ForecastAssumptions } from './model';

const RATE = /^\d{1,2}([.,]\d{1,3})?$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ITEMS_MAX = 24;

const normalizeRate = (value: string): string => value.trim().replace(',', '.');
const rate = (label: string) => z.string().refine((value) => RATE.test(value.trim()) && Number(normalizeRate(value)) <= 10, `${label} : de 0 à 10 %, trois décimales au plus.`);

export const assumptionsSchema = (currency: Currency) =>
  z.object({
    indexationRate: rate('Indexation des loyers'),
    expenseGrowthRate: rate('Hausse des dépenses'),
    vacancies: z
      .array(
        z
          .object({ unitId: z.string().min(1, 'Choisissez un lot.'), from: z.string().regex(DATE, 'Date de début invalide.'), to: z.string().regex(DATE, 'Date de fin invalide.') })
          .refine((value) => value.to >= value.from, { message: 'La fin doit suivre le début.', path: ['to'] }),
      )
      .max(ITEMS_MAX, `${String(ITEMS_MAX)} périodes au plus.`),
    oneOffExpenses: z
      .array(
        z.object({
          month: z.string().regex(MONTH, 'Mois invalide (AAAA-MM).'),
          label: z.string().trim().min(1, 'Saisissez un libellé.').max(80, '80 caractères au plus.'),
          amount: z.string().refine((value) => (parseMinor(value, currency) ?? 0) > 0, 'Saisissez un montant supérieur à zéro.'),
        }),
      )
      .max(ITEMS_MAX, `${String(ITEMS_MAX)} dépenses au plus.`),
  });
export type AssumptionsFormValues = z.input<ReturnType<typeof assumptionsSchema>>;

export const assumptionsDefaults = (assumptions: ForecastAssumptions, currency: Currency): AssumptionsFormValues => ({
  indexationRate: assumptions.indexationRate.replace('.', ','),
  expenseGrowthRate: assumptions.expenseGrowthRate.replace('.', ','),
  vacancies: assumptions.vacancies.map((vacancy) => ({ unitId: vacancy.unitId, from: vacancy.from, to: vacancy.to })),
  oneOffExpenses: assumptions.oneOffExpenses.map((expense) => ({ month: expense.month, label: expense.label, amount: minorToInput(expense.amount.amount, currency) })),
});

export const assumptionsToInput = (values: AssumptionsFormValues, currency: Currency, lockVersion: number): AssumptionsInput => ({
  indexationRate: normalizeRate(values.indexationRate),
  expenseGrowthRate: normalizeRate(values.expenseGrowthRate),
  vacancies: values.vacancies,
  oneOffExpenses: values.oneOffExpenses.map((expense) => ({ month: expense.month, label: expense.label.trim(), amount: parseMinor(expense.amount, currency) ?? 0 })),
  lockVersion,
});
