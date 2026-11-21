import { formatAmountInput, formatMoney } from '../../../../format/money';
import type { Currency } from '../../../../format/money';
import { OwnerFundsApiError } from '../api/ownerFundsErrors';
import type { FeeKind } from '../model';
import { parseMinorUnits } from '../../rent/api/rentPayloads';
import { MAX_AMOUNT_MINOR, MAX_BASIS_POINTS, MONTHS_DEFAULT, MONTHS_MAX, MONTHS_MIN } from './model';
import type { FeeBase, FeeMandateOption, FeeProposal, FeeTaxMode } from './model';

export interface SimulationDraft {
  mandateId: string;
  kind: FeeKind;
  rate: string;
  flat: string;
  base: FeeBase | '';
  minimum: string;
  taxMode: FeeTaxMode;
  months: string;
}

export type SimulationField = 'mandateId' | 'kind' | 'rate' | 'flat' | 'base' | 'minimum' | 'taxMode' | 'months';
export type SimulationErrors = Partial<Record<SimulationField, string>>;

export const EMPTY_DRAFT: SimulationDraft = { mandateId: '', kind: 'percentage', rate: '', flat: '', base: '', minimum: '', taxMode: 'excl_tax', months: String(MONTHS_DEFAULT) };

export function rateInput(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${String(whole)},${fraction}`;
}

export function draftFromMandate(option: FeeMandateOption, months: string): SimulationDraft {
  const terms = option.terms;
  if (terms === null) return { ...EMPTY_DRAFT, mandateId: option.id, months };
  return {
    mandateId: option.id,
    kind: terms.kind,
    rate: terms.basisPoints === null ? '' : rateInput(terms.basisPoints),
    flat: terms.flatAmount === null ? '' : formatAmountInput(terms.flatAmount, option.currency),
    base: terms.base ?? '',
    minimum: terms.minimumAmount === 0 ? '' : formatAmountInput(terms.minimumAmount, option.currency),
    taxMode: terms.taxMode,
    months,
  };
}

const RATE_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/;

export function parseBasisPoints(text: string): number | null {
  const value = text.replace(/[\s  %]/g, '');
  if (!RATE_PATTERN.test(value)) return null;
  const [whole = '0', fraction = ''] = value.replace(',', '.').split('.');
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return basisPoints <= MAX_BASIS_POINTS ? basisPoints : null;
}

const ceilingMessage = (currency: Currency): string => `Le montant ne peut pas dépasser ${formatMoney(MAX_AMOUNT_MINOR, currency)}.`;

function amountOf(text: string, currency: Currency, label: string): { value: number } | { error: string } {
  const minor = parseMinorUnits(text.replace(/[\s\u00a0\u202f]/g, ''), currency);
  if (minor === null) return { error: `${label} invalide : saisissez un nombre positif${currency === 'XOF' ? ' entier' : ', avec au plus deux décimales'}.` };
  if (minor > MAX_AMOUNT_MINOR) return { error: ceilingMessage(currency) };
  return { value: minor };
}

export function toProposal(draft: SimulationDraft, currency: Currency): { proposal: FeeProposal } | { errors: SimulationErrors } {
  const errors: SimulationErrors = {};
  if (draft.mandateId === '') errors.mandateId = 'Choisissez un mandat.';
  const months = /^\d+$/.test(draft.months) ? Number(draft.months) : Number.NaN;
  if (!Number.isInteger(months) || months < MONTHS_MIN || months > MONTHS_MAX) errors.months = 'Choisissez entre 1 et 12 mois.';

  let basisPoints: number | null = null;
  let flatAmount: number | null = null;
  if (draft.kind === 'percentage') {
    basisPoints = parseBasisPoints(draft.rate);
    if (basisPoints === null) errors.rate = 'Saisissez un taux entre 0 et 100, avec au plus deux décimales. Exemple : 7,5.';
  } else {
    const flat = amountOf(draft.flat, currency, 'Le forfait');
    if ('error' in flat) errors.flat = flat.error;
    else flatAmount = flat.value;
  }

  if (draft.base === '') errors.base = 'Choisissez la base de calcul des honoraires.';

  let minimumAmount = 0;
  if (draft.minimum.trim() !== '') {
    const minimum = amountOf(draft.minimum, currency, 'Le minimum');
    if ('error' in minimum) errors.minimum = minimum.error;
    else minimumAmount = minimum.value;
  }

  if (Object.keys(errors).length > 0 || draft.base === '') return { errors };
  return { proposal: { mandateId: draft.mandateId, kind: draft.kind, basisPoints, flatAmount, base: draft.base, minimumAmount, taxMode: draft.taxMode, months } };
}

const FIELD_OF: Readonly<Record<string, SimulationField>> = {
  mandate_id: 'mandateId',
  fee_kind: 'kind',
  fee_basis_points: 'rate',
  fee_flat_amount: 'flat',
  fee_base: 'base',
  fee_minimum_amount: 'minimum',
  fee_tax_mode: 'taxMode',
  months: 'months',
};

const FIELD_MESSAGES: Readonly<Record<SimulationField, string>> = {
  mandateId: 'Ce mandat est invalide : choisissez-en un dans la liste.',
  kind: 'Le type d’honoraires est invalide.',
  rate: 'Le taux est invalide : indiquez un pourcentage entre 0 et 100.',
  flat: 'Le forfait est invalide.',
  base: 'La base de calcul est invalide.',
  minimum: 'Le minimum mensuel est invalide.',
  taxMode: 'Le mode de taxe est invalide.',
  months: 'Le nombre de mois doit être compris entre 1 et 12.',
};

export function fieldErrorsOf(error: unknown, currency: Currency): SimulationErrors {
  if (!(error instanceof OwnerFundsApiError)) return {};
  if (error.code === 'fee_base_missing') return { base: 'Choisissez la base de calcul des honoraires.' };
  const errors: SimulationErrors = {};
  for (const key of Object.keys(error.fieldErrors)) {
    const field = FIELD_OF[key];
    if (field === undefined) continue;
    errors[field] = field === 'flat' || field === 'minimum' ? ceilingOrInvalid(field, currency) : FIELD_MESSAGES[field];
  }
  return errors;
}

const ceilingOrInvalid = (field: 'flat' | 'minimum', currency: Currency): string => `${FIELD_MESSAGES[field]} ${ceilingMessage(currency)}`;
