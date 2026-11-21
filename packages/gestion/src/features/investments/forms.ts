import { z } from 'zod';
import type { Currency } from '../../format/money';
import { parseMinor } from '../finances/banking/money';
import { DEFERRAL_KINDS, FEE_KINDS, INSURANCE_MODES, LOAN_PURPOSES, PREPAYMENT_OPTIONS } from './model';
import type { AcquisitionInput, AcquisitionUpdate, AttestationInput, FeeInput, LoanInput, PrepaymentInput } from './model';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png';
const FILE_TYPES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];

export function validateFile(file: File): string | null {
  if (!FILE_TYPES.includes(file.type)) return 'Choisissez un fichier PDF, JPG ou PNG.';
  if (file.size > MAX_FILE_BYTES) return 'Le fichier ne peut pas dépasser 10 Mo.';
  return null;
}

const REQUIRED = 'Ce champ est obligatoire.';
const MAX_MINOR = 100_000_000_000;
const isoDate = (min: string, max: string) =>
  z
    .string()
    .min(1, REQUIRED)
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)), 'Saisissez une date valide.')
    .refine((value) => value >= min && value < max, `La date doit être comprise entre ${min.slice(0, 4)} et ${max.slice(0, 4)}.`);

export const normalizeRate = (text: string): string => text.trim().replace(',', '.');
const RATE_PATTERN = /^\d{1,2}(\.\d{1,5})?$/;

const amount = (currency: Currency, options: { positive: boolean }) =>
  z
    .string()
    .trim()
    .min(1, REQUIRED)
    .refine((value) => parseMinor(value, currency) !== null, 'Saisissez un montant valide.')
    .refine((value) => !options.positive || (parseMinor(value, currency) ?? 0) > 0, 'Le montant doit être supérieur à zéro.')
    .refine((value) => (parseMinor(value, currency) ?? 0) <= MAX_MINOR, 'Le montant est trop élevé.');

const optionalAmount = (currency: Currency) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || parseMinor(value, currency) !== null, 'Saisissez un montant valide.')
    .refine((value) => value === '' || (parseMinor(value, currency) ?? 0) <= MAX_MINOR, 'Le montant est trop élevé.');

export const minorOf = (text: string, currency: Currency): number => parseMinor(text, currency) ?? 0;

export const loanFormSchema = (currency: Currency) =>
  z
    .object({
      propertyId: z.string().min(1, 'Choisissez un bien.'),
      unitId: z.string(),
      lenderLabel: z.string().trim().min(2, 'Saisissez le prêteur (2 caractères au moins).').max(120, 'Le prêteur ne peut pas dépasser 120 caractères.'),
      contractReference: z.string().trim().max(64, 'La référence ne peut pas dépasser 64 caractères.').regex(/^[A-Za-z0-9 ._/-]*$/, 'Lettres, chiffres, espaces et . _ / - seulement.'),
      purpose: z.enum(LOAN_PURPOSES),
      principal: amount(currency, { positive: true }),
      nominalRate: z.string().refine((value) => RATE_PATTERN.test(normalizeRate(value)) && Number(normalizeRate(value)) <= 30, 'Taux nominal annuel en %, de 0 à 30, cinq décimales au plus.'),
      firstDueOn: isoDate('1990-01-01', '2100-01-01'),
      termMonths: z.string().refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 600, 'Durée en mois, de 1 à 600.'),
      deferralKind: z.enum(DEFERRAL_KINDS),
      deferralMonths: z.string(),
      insuranceMode: z.enum(INSURANCE_MODES),
      insuranceRate: z.string(),
      insuranceAmount: optionalAmount(currency),
      replacesLoanId: z.string(),
    })
    .superRefine((values, context) => {
      const term = Number(values.termMonths);
      if (values.deferralKind !== 'none' && !(/^\d+$/.test(values.deferralMonths) && Number(values.deferralMonths) >= 1 && Number(values.deferralMonths) < term)) {
        context.addIssue({ code: 'custom', path: ['deferralMonths'], message: 'Durée du différé en mois, inférieure à la durée du prêt.' });
      }
      const rated = values.insuranceMode === 'initial_capital' || values.insuranceMode === 'outstanding_capital';
      if (rated && !(RATE_PATTERN.test(normalizeRate(values.insuranceRate)) && Number(normalizeRate(values.insuranceRate)) <= 10)) {
        context.addIssue({ code: 'custom', path: ['insuranceRate'], message: 'Taux d’assurance annuel en %, de 0 à 10.' });
      }
      if (values.insuranceMode === 'fixed' && values.insuranceAmount === '') {
        context.addIssue({ code: 'custom', path: ['insuranceAmount'], message: REQUIRED });
      }
    });
export type LoanFormValues = z.input<ReturnType<typeof loanFormSchema>>;

export function loanFormToInput(values: LoanFormValues, currency: Currency, document: File | null): LoanInput {
  const rated = values.insuranceMode === 'initial_capital' || values.insuranceMode === 'outstanding_capital';
  return {
    propertyId: values.propertyId,
    unitId: values.unitId === '' ? null : values.unitId,
    lenderLabel: values.lenderLabel.trim(),
    contractReference: values.contractReference.trim() === '' ? null : values.contractReference.trim(),
    purpose: values.purpose,
    principal: minorOf(values.principal, currency),
    nominalRate: normalizeRate(values.nominalRate),
    firstDueOn: values.firstDueOn,
    termMonths: Number(values.termMonths),
    deferralKind: values.deferralKind,
    deferralMonths: values.deferralKind === 'none' ? 0 : Number(values.deferralMonths),
    insuranceMode: values.insuranceMode,
    insuranceRate: rated ? normalizeRate(values.insuranceRate) : null,
    insuranceAmount: values.insuranceMode === 'fixed' ? minorOf(values.insuranceAmount, currency) : null,
    replacesLoanId: values.replacesLoanId === '' ? null : values.replacesLoanId,
    document,
  };
}

export const prepaymentFormSchema = (currency: Currency) =>
  z.object({
    date: z.string().min(1, 'Choisissez une échéance.'),
    amount: amount(currency, { positive: true }),
    option: z.enum(PREPAYMENT_OPTIONS),
    penalty: optionalAmount(currency),
  });
export type PrepaymentFormValues = z.input<ReturnType<typeof prepaymentFormSchema>>;

export const prepaymentToInput = (values: PrepaymentFormValues, currency: Currency, lockVersion: number): PrepaymentInput => ({
  date: values.date,
  amount: minorOf(values.amount, currency),
  option: values.option,
  penalty: minorOf(values.penalty, currency),
  lockVersion,
});

export const feeFormSchema = (currency: Currency) =>
  z.object({ kind: z.enum(FEE_KINDS), paidOn: isoDate('1990-01-01', '2100-01-01'), amount: amount(currency, { positive: true }) });
export type FeeFormValues = z.input<ReturnType<typeof feeFormSchema>>;

export const feeToInput = (values: FeeFormValues, currency: Currency, document: File | null): FeeInput => ({ kind: values.kind, paidOn: values.paidOn, amount: minorOf(values.amount, currency), document });

export const attestationFormSchema = (currency: Currency) =>
  z.object({
    incomeYear: z.string().refine((value) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100, 'Année de revenus, de 2000 à 2100.'),
    interest: amount(currency, { positive: false }),
    insurance: optionalAmount(currency),
    fees: optionalAmount(currency),
  });
export type AttestationFormValues = z.input<ReturnType<typeof attestationFormSchema>>;

export const attestationToInput = (values: AttestationFormValues, currency: Currency, document: File): AttestationInput => ({
  incomeYear: Number(values.incomeYear),
  interest: minorOf(values.interest, currency),
  insurance: minorOf(values.insurance, currency),
  fees: minorOf(values.fees, currency),
  document,
});

export const acquisitionFormSchema = (currency: Currency) =>
  z.object({
    propertyId: z.string().min(1, 'Choisissez un bien.'),
    unitId: z.string(),
    acquiredOn: isoDate('1900-01-01', '2100-01-01'),
    price: amount(currency, { positive: true }),
    acquisitionCosts: optionalAmount(currency),
    agencyFees: optionalAmount(currency),
    initialWorks: optionalAmount(currency),
  });
export type AcquisitionFormValues = z.input<ReturnType<typeof acquisitionFormSchema>>;

export const acquisitionToInput = (values: AcquisitionFormValues, currency: Currency, document: File | null): AcquisitionInput => ({
  propertyId: values.propertyId,
  unitId: values.unitId === '' ? null : values.unitId,
  acquiredOn: values.acquiredOn,
  price: minorOf(values.price, currency),
  acquisitionCosts: minorOf(values.acquisitionCosts, currency),
  agencyFees: minorOf(values.agencyFees, currency),
  initialWorks: minorOf(values.initialWorks, currency),
  document,
});

export const acquisitionToUpdate = (values: AcquisitionFormValues, currency: Currency, lockVersion: number): AcquisitionUpdate => ({
  acquiredOn: values.acquiredOn,
  price: minorOf(values.price, currency),
  acquisitionCosts: minorOf(values.acquisitionCosts, currency),
  agencyFees: minorOf(values.agencyFees, currency),
  initialWorks: minorOf(values.initialWorks, currency),
  lockVersion,
});

export const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Le motif doit contenir au moins 3 caractères.').max(255, 'Le motif ne peut pas dépasser 255 caractères.') });
export type ReasonValues = z.input<typeof reasonSchema>;
