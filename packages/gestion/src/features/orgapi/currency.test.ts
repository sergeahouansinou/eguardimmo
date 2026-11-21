import { describe, expect, it } from 'vitest';
import { isoCurrency } from './currency';
import { apiOrganization } from './schemas';

const ORGANISATION = { id: '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10', kind: 'agency', name: 'Agence du Port', country: 'FR', currency: 'EUR', timezone: 'Europe/Paris', two_factor_required: false };

describe('devise de l’organisation', () => {
  it.each(['EUR', 'CAD', 'XOF'])('accepte le code ISO %s', (code) => {
    expect(isoCurrency.safeParse(code).success).toBe(true);
  });

  it.each(['eur', 'EU', 'EURO', '', '€'])('refuse « %s »', (code) => {
    expect(isoCurrency.safeParse(code).success).toBe(false);
  });

  it('exige la devise dans la réponse de l’organisation, sans repli par pays', () => {
    expect(apiOrganization.safeParse({ data: ORGANISATION }).success).toBe(true);
    const sansDevise = Object.fromEntries(Object.entries(ORGANISATION).filter(([key]) => key !== 'currency'));
    expect(apiOrganization.safeParse({ data: sansDevise }).success).toBe(false);
  });
});
