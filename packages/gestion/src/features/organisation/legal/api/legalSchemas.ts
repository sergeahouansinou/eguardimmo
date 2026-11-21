import { z } from 'zod';
import { isoCurrency } from '../../../orgapi/currency';
import { VAT_REGIMES } from '../model';

const money = z.object({ amount: z.number().int(), currency: z.string().length(3) });

export const apiLegalIdentitySchema = z.object({
  legal_name: z.string(),
  address: z.object({
    line1: z.string(),
    line2: z.string().nullish(),
    postal_code: z.string(),
    city: z.string(),
    country: z.string(),
  }),
  siren: z.string(),
  siret: z.string().nullable(),
  vat_number: z.string().nullable(),
  legal_form: z.string().nullable(),
  share_capital: money.nullable(),
  registry_city: z.string().nullable(),
  professional_card_number: z.string().nullable(),
  professional_card_issuer: z.string().nullable(),
  guarantee_provider: z.string().nullable(),
  guarantee_amount: money.nullable(),
  vat_regime: z.enum(VAT_REGIMES),
  vat_on_debits: z.boolean(),
  payment_terms_days: z.number().int().nullable(),
});

export const apiLegalIdentityResponse = z.object({ data: apiLegalIdentitySchema });
export const apiOrganizationResponse = z.object({ data: z.object({ country: z.string().regex(/^[A-Z]{2}$/), currency: isoCurrency }) });

export type ApiLegalIdentity = z.infer<typeof apiLegalIdentitySchema>;
