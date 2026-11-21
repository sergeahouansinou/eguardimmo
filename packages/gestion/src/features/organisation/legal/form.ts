import { z } from 'zod';
import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';
import { parseMinorUnits } from '../../finances/rent/api/rentPayloads';
import { VAT_REGIMES } from './model';
import type { LegalIdentity, LegalIdentityInput, VatRegime } from './model';

export interface LegalDraft extends Record<string, unknown> {
  legalName: string;
  legalForm: string;
  siren: string;
  siret: string;
  vatNumber: string;
  registryCity: string;
  shareCapital: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  professionalCardNumber: string;
  professionalCardIssuer: string;
  guaranteeProvider: string;
  guaranteeAmount: string;
  vatRegime: VatRegime;
  vatOnDebits: boolean;
  paymentTermsDays: string;
}

export type LegalTextField =
  | 'legalName'
  | 'legalForm'
  | 'siren'
  | 'siret'
  | 'vatNumber'
  | 'registryCity'
  | 'shareCapital'
  | 'line1'
  | 'line2'
  | 'postalCode'
  | 'city'
  | 'country'
  | 'professionalCardNumber'
  | 'professionalCardIssuer'
  | 'guaranteeProvider'
  | 'guaranteeAmount'
  | 'paymentTermsDays';

const MAX_MINOR = 100_000_000_000_000;

export const parseCurrency = (code: string | null): Currency => (code === 'XOF' ? 'XOF' : 'EUR');

export function minorText(minor: number, currency: string | null): string {
  const digits = minorDigits(parseCurrency(currency));
  if (digits === 0) return String(minor);
  const factor = 10 ** digits;
  const cents = minor % factor;
  return cents === 0 ? String(Math.trunc(minor / factor)) : `${String(Math.trunc(minor / factor))},${String(cents).padStart(digits, '0')}`;
}

export const emptyDraft = (country: string): LegalDraft => ({
  legalName: '',
  legalForm: '',
  siren: '',
  siret: '',
  vatNumber: '',
  registryCity: '',
  shareCapital: '',
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  country,
  professionalCardNumber: '',
  professionalCardIssuer: '',
  guaranteeProvider: '',
  guaranteeAmount: '',
  vatRegime: 'normal',
  vatOnDebits: false,
  paymentTermsDays: '',
});

export function toDraft(identity: LegalIdentity): LegalDraft {
  return {
    legalName: identity.legalName,
    legalForm: identity.legalForm ?? '',
    siren: identity.siren,
    siret: identity.siret ?? '',
    vatNumber: identity.vatNumber ?? '',
    registryCity: identity.registryCity ?? '',
    shareCapital: identity.shareCapital ? minorText(identity.shareCapital.amount, identity.shareCapital.currency) : '',
    line1: identity.address.line1,
    line2: identity.address.line2 ?? '',
    postalCode: identity.address.postalCode,
    city: identity.address.city,
    country: identity.address.country,
    professionalCardNumber: identity.professionalCardNumber ?? '',
    professionalCardIssuer: identity.professionalCardIssuer ?? '',
    guaranteeProvider: identity.guaranteeProvider ?? '',
    guaranteeAmount: identity.guaranteeAmount ? minorText(identity.guaranteeAmount.amount, identity.guaranteeAmount.currency) : '',
    vatRegime: identity.vatRegime,
    vatOnDebits: identity.vatOnDebits,
    paymentTermsDays: identity.paymentTermsDays === null ? '' : String(identity.paymentTermsDays),
  };
}

const required = (message: string, max: number) => z.string().trim().min(1, message).max(max, `${String(max)} caractères au plus.`);
const optional = (max: number) => z.string().trim().max(max, `${String(max)} caractères au plus.`).transform((value) => (value === '' ? null : value));
const compact = (value: string): string => value.replace(/\s+/g, '');

const digits = (count: number, message: string) => z.string().transform(compact).pipe(z.string().regex(new RegExp(`^\\d{${String(count)}}$`), message));

function amount(currency: Currency, label: string) {
  return z
    .string()
    .trim()
    .transform((value, context): number | null => {
      if (value === '') return null;
      const minor = parseMinorUnits(value, currency);
      if (minor === null || minor > MAX_MINOR) {
        context.addIssue({ code: 'custom', message: `${label} : saisissez un montant valide${minorDigits(currency) === 0 ? ' (nombre entier)' : ', par exemple 20000 ou 20000,50'}.` });
        return z.NEVER;
      }
      return minor;
    });
}

export function legalFormSchema(currency: string | null): z.ZodType<LegalIdentityInput, LegalDraft> {
  const money = parseCurrency(currency);
  return z
    .object({
      legalName: required('La raison sociale est obligatoire.', 200),
      legalForm: optional(80),
      siren: z.string().transform(compact).pipe(z.string().min(1, 'Le SIREN est obligatoire.').regex(/^\d{9}$/, 'Le SIREN comporte 9 chiffres.')),
      siret: z.string().transform(compact).pipe(z.union([z.literal('').transform(() => null), digits(14, 'Le SIRET comporte 14 chiffres.')])),
      vatNumber: z.string().transform((value) => compact(value).toUpperCase()).pipe(z.union([z.literal('').transform(() => null), z.string().regex(/^[A-Z]{2}[A-Z0-9]{2,12}$/, 'Deux lettres de pays puis 2 à 12 caractères, par exemple FR12345678901.')])),
      registryCity: optional(120),
      shareCapital: amount(money, 'Capital social'),
      line1: required('L’adresse est obligatoire.', 200),
      line2: optional(200),
      postalCode: required('Le code postal est obligatoire.', 12),
      city: required('La ville est obligatoire.', 120),
      country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Deux lettres majuscules, par exemple FR.'),
      professionalCardNumber: optional(60),
      professionalCardIssuer: optional(120),
      guaranteeProvider: optional(160),
      guaranteeAmount: amount(money, 'Garantie'),
      vatRegime: z.enum(VAT_REGIMES, { error: 'Choisissez le régime de TVA.' }),
      vatOnDebits: z.boolean(),
      paymentTermsDays: z
        .string()
        .trim()
        .transform((value) => (value === '' ? null : Number(value)))
        .pipe(z.number({ error: 'Nombre de jours entier.' }).int('Nombre de jours entier.').min(0, 'Entre 0 et 120 jours.').max(120, 'Entre 0 et 120 jours.').nullable()),
    })
    .transform(({ line1, line2, postalCode, city, country, ...rest }) => ({ ...rest, address: { line1, line2, postalCode, city, country } }));
}
