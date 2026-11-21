import { describe, expect, it } from 'vitest';
import { OwnerFundsApiError } from '../api/ownerFundsErrors';
import { MAX_AMOUNT_MINOR } from './model';
import type { FeeProposal } from './model';
import { simulationPayload } from './payloads';
import { SIM_IDS } from './fixtures';

const percentage: FeeProposal = { mandateId: SIM_IDS.mandateA, kind: 'percentage', basisPoints: 750, flatAmount: null, base: 'rent', minimumAmount: 5000, taxMode: 'excl_tax', months: 3 };
const flat: FeeProposal = { ...percentage, kind: 'flat', basisPoints: null, flatAmount: 50000, base: 'rent_and_charges', taxMode: 'incl_tax' };

describe('corps de la simulation', () => {
  it('envoie un taux en points de base sans forfait', () => {
    expect(simulationPayload(percentage)).toEqual({
      mandate_id: SIM_IDS.mandateA,
      fee_kind: 'percentage',
      fee_basis_points: 750,
      fee_base: 'rent',
      fee_minimum_amount: 5000,
      fee_tax_mode: 'excl_tax',
      months: 3,
    });
  });

  it('envoie un forfait en unités mineures sans taux (le serveur refuse les deux ensemble)', () => {
    const body = simulationPayload(flat);
    expect(body).toMatchObject({ fee_kind: 'flat', fee_flat_amount: 50000, fee_base: 'rent_and_charges', fee_tax_mode: 'incl_tax' });
    expect(body).not.toHaveProperty('fee_basis_points');
    expect(simulationPayload(percentage)).not.toHaveProperty('fee_flat_amount');
  });

  it('n’envoie jamais de devise ni d’organisation', () => {
    expect(Object.keys(simulationPayload(percentage)).sort()).toEqual(['fee_base', 'fee_basis_points', 'fee_kind', 'fee_minimum_amount', 'fee_tax_mode', 'mandate_id', 'months']);
  });

  it.each([
    ['mandat absent', { mandateId: '' }],
    ['mois à 0', { months: 0 }],
    ['mois à 13', { months: 13 }],
    ['mois fractionnaire', { months: 2.5 }],
    ['taux supérieur à 100 %', { basisPoints: 10_001 }],
    ['taux fractionnaire', { basisPoints: 7.5 }],
    ['taux absent', { basisPoints: null }],
    ['minimum négatif', { minimumAmount: -1 }],
    ['minimum au-delà du plafond', { minimumAmount: MAX_AMOUNT_MINOR + 1 }],
  ] as const)('refuse %s avant tout appel', (_label, patch) => {
    expect(() => simulationPayload({ ...percentage, ...patch })).toThrow(OwnerFundsApiError);
  });

  it('refuse un forfait absent ou au-delà du plafond', () => {
    expect(() => simulationPayload({ ...flat, flatAmount: null })).toThrow(OwnerFundsApiError);
    expect(() => simulationPayload({ ...flat, flatAmount: MAX_AMOUNT_MINOR + 1 })).toThrow(OwnerFundsApiError);
    expect(simulationPayload({ ...flat, flatAmount: MAX_AMOUNT_MINOR })).toMatchObject({ fee_flat_amount: MAX_AMOUNT_MINOR });
  });
});
