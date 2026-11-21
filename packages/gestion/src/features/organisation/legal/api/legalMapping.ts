import type { LegalIdentity, LegalIdentityInput } from '../model';
import type { ApiLegalIdentity } from './legalSchemas';

export const toLegalIdentity = (api: ApiLegalIdentity): LegalIdentity => ({
  legalName: api.legal_name,
  address: { line1: api.address.line1, line2: api.address.line2 ?? null, postalCode: api.address.postal_code, city: api.address.city, country: api.address.country },
  siren: api.siren,
  siret: api.siret,
  vatNumber: api.vat_number,
  legalForm: api.legal_form,
  shareCapital: api.share_capital,
  registryCity: api.registry_city,
  professionalCardNumber: api.professional_card_number,
  professionalCardIssuer: api.professional_card_issuer,
  guaranteeProvider: api.guarantee_provider,
  guaranteeAmount: api.guarantee_amount,
  vatRegime: api.vat_regime,
  vatOnDebits: api.vat_on_debits,
  paymentTermsDays: api.payment_terms_days,
});

export const toLegalPayload = (input: LegalIdentityInput): Record<string, unknown> => ({
  legal_name: input.legalName,
  address: { line1: input.address.line1, line2: input.address.line2, postal_code: input.address.postalCode, city: input.address.city, country: input.address.country },
  siren: input.siren,
  siret: input.siret,
  vat_number: input.vatNumber,
  legal_form: input.legalForm,
  share_capital: input.shareCapital,
  registry_city: input.registryCity,
  professional_card_number: input.professionalCardNumber,
  professional_card_issuer: input.professionalCardIssuer,
  guarantee_provider: input.guaranteeProvider,
  guarantee_amount: input.guaranteeAmount,
  vat_regime: input.vatRegime,
  vat_on_debits: input.vatOnDebits,
  payment_terms_days: input.paymentTermsDays,
});
