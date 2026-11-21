import { describe, expect, it } from 'vitest';
import { at, norm } from '../../../../../test/lots';
import { OwnerFundsApiError } from '../api/ownerFundsErrors';
import { EMPTY_DRAFT, draftFromMandate, fieldErrorsOf, parseBasisPoints, rateInput, toProposal } from './form';
import type { SimulationDraft } from './form';
import { toFeeMandate } from './mapping';
import { apiFeeMandatePage } from './schemas';
import { SIM_IDS, mandatesPage } from './fixtures';

const options = apiFeeMandatePage.parse(mandatesPage()).data.map(toFeeMandate);
const mandateA = at(options, 0);
const mandateB = at(options, 1);
const mandateC = at(options, 2);

const draft = (patch: Partial<SimulationDraft>): SimulationDraft => ({ ...EMPTY_DRAFT, mandateId: SIM_IDS.mandateA, rate: '7,5', base: 'rent', ...patch });

describe('taux en points de base', () => {
  it.each([
    ['7,5', 750],
    ['7.50', 750],
    ['0,29', 29],
    ['100', 10_000],
    ['6,55 %', 655],
    ['0', 0],
  ])('lit %s sans erreur de flottant', (text, expected) => {
    expect(parseBasisPoints(text)).toBe(expected);
  });

  it.each(['100,01', '101', '7,555', 'abc', '', '-1', '7,,5'])('refuse %s', (text) => {
    expect(parseBasisPoints(text)).toBeNull();
  });

  it('reformate un taux sans zéro inutile', () => {
    expect(rateInput(750)).toBe('7,5');
    expect(rateInput(800)).toBe('8');
    expect(rateInput(29)).toBe('0,29');
  });
});

describe('préremplissage depuis le barème du mandat', () => {
  it('reprend un pourcentage en euros', () => {
    expect(draftFromMandate(mandateA, '6')).toEqual({ mandateId: SIM_IDS.mandateA, kind: 'percentage', rate: '8', flat: '', base: 'rent', minimum: '', taxMode: 'excl_tax', months: '6' });
  });

  it('reprend un forfait en francs CFA sans décimale', () => {
    expect(draftFromMandate(mandateB, '3')).toMatchObject({ kind: 'flat', flat: '50000', minimum: '25000', base: 'rent_and_charges', taxMode: 'incl_tax' });
  });

  it('laisse la base vide quand le mandat n’a pas de barème', () => {
    expect(draftFromMandate(mandateC, '3')).toEqual({ ...EMPTY_DRAFT, mandateId: SIM_IDS.mandateC });
  });
});

describe('proposition issue du formulaire', () => {
  it('convertit en entiers selon l’exposant de la devise', () => {
    const outcome = toProposal(draft({ minimum: '50,5' }), 'EUR');
    expect(outcome).toEqual({ proposal: { mandateId: SIM_IDS.mandateA, kind: 'percentage', basisPoints: 750, flatAmount: null, base: 'rent', minimumAmount: 5050, taxMode: 'excl_tax', months: 3 } });
    expect(toProposal(draft({ kind: 'flat', flat: '50 000', minimum: '' }), 'XOF')).toMatchObject({ proposal: { flatAmount: 50_000, minimumAmount: 0 } });
  });

  it('refuse des décimales en francs CFA', () => {
    expect(toProposal(draft({ kind: 'flat', flat: '500,5' }), 'XOF')).toMatchObject({ errors: { flat: expect.stringContaining('entier') as string } });
  });

  it('signale le plafond de montant par champ', () => {
    const outcome = toProposal(draft({ kind: 'flat', flat: '1000000000,01', minimum: '1000000000,01' }), 'EUR');
    expect(outcome).toMatchObject({ errors: { flat: expect.stringContaining('ne peut pas dépasser') as string } });
  });

  it('exige mandat, base et taux', () => {
    const outcome = toProposal({ ...EMPTY_DRAFT }, 'EUR');
    expect(outcome).toMatchObject({ errors: { mandateId: expect.any(String) as string, rate: expect.any(String) as string, base: expect.any(String) as string } });
  });

  it('refuse un nombre de mois hors 1 à 12', () => {
    expect(toProposal(draft({ months: '13' }), 'EUR')).toMatchObject({ errors: { months: expect.any(String) as string } });
    expect(toProposal(draft({ months: '0' }), 'EUR')).toMatchObject({ errors: { months: expect.any(String) as string } });
  });
});

describe('erreurs serveur par champ', () => {
  const invalid = (fieldErrors: Record<string, string[]>) => new OwnerFundsApiError('invalid', 'x', { status: 422, code: 'validation_failed', fieldErrors });

  it('rattache chaque champ du corps au champ du formulaire', () => {
    const errors = fieldErrorsOf(invalid({ fee_basis_points: ['x'], fee_flat_amount: ['x'], fee_minimum_amount: ['x'], months: ['x'], fee_base: ['x'] }), 'EUR');
    expect(Object.keys(errors).sort()).toEqual(['base', 'flat', 'minimum', 'months', 'rate']);
    expect(norm(errors.flat)).toContain('1 000 000 000 €');
  });

  it('exprime le plafond dans la devise du mandat', () => {
    expect(norm(fieldErrorsOf(invalid({ fee_minimum_amount: ['x'] }), 'XOF').minimum)).toContain('100 000 000 000 F CFA');
  });

  it('fee_base_missing devient une erreur du champ base', () => {
    const error = new OwnerFundsApiError('invalid', 'x', { status: 422, code: 'fee_base_missing' });
    expect(fieldErrorsOf(error, 'EUR')).toEqual({ base: expect.any(String) as string });
  });

  it('ignore un champ inconnu et une erreur sans champ', () => {
    expect(fieldErrorsOf(invalid({ inconnu: ['x'] }), 'EUR')).toEqual({});
    expect(fieldErrorsOf(new Error('boom'), 'EUR')).toEqual({});
  });
});
