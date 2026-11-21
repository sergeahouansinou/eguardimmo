import { describe, expect, it } from 'vitest';
import type { PaymentInput } from '../model';
import { RentApiError } from './rentErrors';
import { parseMinorUnits, paymentPayload, reasonPayload } from './rentPayloads';

const input = (overrides: Partial<PaymentInput> = {}): PaymentInput => ({
  leaseId: '01a1e544-3c7b-7316-ad15-a82486eff490',
  amount: '300',
  currency: 'EUR',
  method: 'transfer',
  receivedOn: '2026-11-16',
  reference: '',
  note: '',
  idempotencyKey: 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff',
  ...overrides,
});

describe('parseMinorUnits', () => {
  it.each([
    ['300', 'EUR', 30000],
    ['850,50', 'EUR', 85050],
    ['850.5', 'EUR', 85050],
    ['0,01', 'EUR', 1],
    [' 12 ', 'EUR', 1200],
    ['450000', 'XOF', 450000],
  ] as const)('lit %s %s comme %i unités mineures, sans flottant', (text, currency, expected) => {
    expect(parseMinorUnits(text, currency)).toBe(expected);
  });

  it.each([
    ['', 'EUR'],
    ['12,345', 'EUR'],
    ['1e3', 'EUR'],
    ['-5', 'EUR'],
    ['abc', 'EUR'],
    ['100,5', 'XOF'],
    ['100.00', 'XOF'],
    ['99999999999999999999', 'EUR'],
  ] as const)('refuse %s en %s', (text, currency) => {
    expect(parseMinorUnits(text, currency)).toBeNull();
  });
});

describe('paymentPayload', () => {
  it('envoie un montant entier en unités mineures, sans devise', () => {
    expect(paymentPayload(input({ amount: '300,50' }), '2026-11-16')).toEqual({
      lease_id: '01a1e544-3c7b-7316-ad15-a82486eff490',
      amount: 30050,
      method: 'transfer',
      received_on: '2026-11-16',
      reference: null,
      note: null,
      idempotency_key: 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff',
    });
  });

  it('retire les espaces de la référence et de la note', () => {
    expect(paymentPayload(input({ reference: ' VIR-123 ', note: '  Virement partiel ' }), '2026-11-16')).toMatchObject({ reference: 'VIR-123', note: 'Virement partiel' });
  });

  it('envoie un montant XOF sans décimale', () => {
    expect(paymentPayload(input({ amount: '450000', currency: 'XOF' }), '2026-11-16')).toMatchObject({ amount: 450000 });
  });

  it.each([
    ['sans bail', { leaseId: '' }, 'Choisissez le bail concerné par ce paiement.'],
    ['montant nul', { amount: '0' }, 'Indiquez un montant strictement positif. Ex. 850 ou 850,50.'],
    ['montant décimal en XOF', { amount: '10,5', currency: 'XOF' as const }, 'Indiquez un montant strictement positif. Ex. 450000.'],
    ['montant au-delà du plafond', { amount: '1000000000,01' }, 'Indiquez un montant strictement positif. Ex. 850 ou 850,50.'],
    ['date dans le futur', { receivedOn: '2026-11-17' }, 'La date de réception ne peut pas être dans le futur.'],
    ['date illisible', { receivedOn: '16/11/2026' }, 'Indiquez la date de réception du paiement.'],
    ['clé trop courte', { idempotencyKey: 'abc' }, 'La clé de saisie est invalide : rechargez le formulaire.'],
    ['référence trop longue', { reference: 'x'.repeat(121) }, 'La référence ne peut pas dépasser 120 caractères.'],
  ])('refuse %s avant tout appel', (_name, overrides, message) => {
    expect(() => paymentPayload(input(overrides), '2026-11-16')).toThrow(RentApiError);
    expect(() => paymentPayload(input(overrides), '2026-11-16')).toThrow(message);
  });
});

describe('reasonPayload', () => {
  it('retire les espaces autour du motif', () => {
    expect(reasonPayload('  Chèque rejeté ')).toEqual({ reason: 'Chèque rejeté' });
  });

  it.each(['', ' a ', 'x'.repeat(256)])('refuse le motif « %s » hors de 2 à 255 caractères', (reason) => {
    expect(() => reasonPayload(reason)).toThrow('Le motif doit contenir entre 2 et 255 caractères.');
  });
});
