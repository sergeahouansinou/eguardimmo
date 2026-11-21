export const ORG = '01a1e544-3c72-70ab-999c-456ddcfeddf3';

const problem = (status: number, code: string, title: string, detail: string) => ({ type: `https://api.eguardimmo.test/problems/${code}`, title, status, detail, code, request_id: '01a1e544-3e7f-7232-9752-e4e20f308fdd' });

export const organization = { data: { id: ORG, kind: 'agency', name: 'Agence du Port', country: 'FR', currency: 'EUR', two_factor_required: false } };
export const organizationCanada = { data: { ...organization.data, country: 'CA', currency: 'CAD' } };

export const identity = {
  data: {
    legal_name: 'Agence du Port SARL',
    address: { line1: '12 rue du Port', line2: null, postal_code: '13002', city: 'Marseille', country: 'FR' },
    siren: '123456782',
    siret: '12345678200019',
    vat_number: 'FR12345678201',
    legal_form: 'SARL',
    share_capital: { amount: 2000000, currency: 'EUR' },
    registry_city: 'Marseille',
    professional_card_number: 'CPI 1301 2026 000 000 001',
    professional_card_issuer: 'CCI Marseille-Provence',
    guarantee_provider: 'Galian',
    guarantee_amount: { amount: 11000000, currency: 'EUR' },
    vat_regime: 'normal',
    vat_on_debits: false,
    payment_terms_days: 30,
  },
};

export const identityMinimal = {
  data: {
    ...identity.data,
    siret: null,
    vat_number: null,
    legal_form: null,
    share_capital: null,
    registry_city: null,
    professional_card_number: null,
    professional_card_issuer: null,
    guarantee_provider: null,
    guarantee_amount: null,
    vat_regime: 'franchise',
    payment_terms_days: null,
  },
};

export const problemNotFound = problem(404, 'legal_identity_not_found', 'Identité légale non renseignée', 'Le siège de cette organisation n\'a pas encore renseigné son identité légale.');
export const problemForbidden = problem(403, 'role_forbidden', 'Action réservée', 'Votre rôle ne permet pas cette action.');
export const problemInvalidSiren = { ...problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.'), errors: { siren: ['validation.regex'] } };
export const problemInvalidLine1 = { ...problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.'), errors: { 'address.line1': ['validation.required'] } };
