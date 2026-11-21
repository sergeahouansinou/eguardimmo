import { describe, expect, it } from 'vitest';
import { explanationText } from './labels';
import { minorToInput, parseMinor } from './money';
import { accountFormSchema, accountFormToInput, defaultCsvDraft, draftToProfile, formatOfFile, importFileProblem, profileToDraft, reconciliationFormSchema, settleFormSchema, settleFormToInput } from './schemas';

describe('montants en unités mineures', () => {
  it.each([
    ['450000', 'XOF', 450000],
    ['450 000', 'XOF', 450000],
    ['850,50', 'EUR', 85050],
    ['850.5', 'EUR', 85050],
    ['850', 'EUR', 85000],
    ['0', 'EUR', 0],
  ] as const)('%s %s donne %s', (text, currency, expected) => {
    expect(parseMinor(text, currency)).toBe(expected);
  });

  it.each([
    ['', 'EUR'],
    ['abc', 'EUR'],
    ['12,345', 'EUR'],
    ['12,', 'EUR'],
    ['1,2,3', 'EUR'],
    ['-5', 'EUR'],
    ['450,5', 'XOF'],
    ['99999999999999999', 'EUR'],
  ] as const)('refuse %s en %s', (text, currency) => {
    expect(parseMinor(text, currency)).toBeNull();
  });

  it('accepte le signe seulement quand il est demandé', () => {
    expect(parseMinor('-1250,50', 'EUR', { signed: true })).toBe(-125050);
    expect(parseMinor('-1250,50', 'EUR')).toBeNull();
  });

  it('reformate sans passer par un flottant', () => {
    expect(minorToInput(85050, 'EUR')).toBe('850,50');
    expect(minorToInput(-5, 'EUR')).toBe('-0,05');
    expect(minorToInput(450000, 'XOF')).toBe('450000');
  });
});

describe('formulaire de compte', () => {
  const values = {
    ledgerRole: 'bank' as const,
    label: 'Compte courant',
    bankName: '',
    holderName: 'Agence Dupont',
    identifierKind: 'iban' as const,
    identifier: 'FR76 3000 6000 0112 3456 7890 189',
    country: 'fr',
    reconciliationFrom: '2026-01-01',
    openingBalance: '1250,50',
    currency: '' as const,
    csv: defaultCsvDraft(),
  };

  it('convertit le solde en unités mineures et passe le profil désactivé à null', () => {
    const parsed = accountFormSchema('EUR').parse(values);
    expect(accountFormToInput(parsed, 'EUR')).toMatchObject({ openingBankBalance: 125050, csvProfile: null });
  });

  it('refuse des décimales en franc CFA', () => {
    const result = accountFormSchema('XOF').safeParse({ ...values, openingBalance: '1250,50' });
    expect(result.success).toBe(false);
  });

  it('demande la devise quand l’organisation n’en a pas encore', () => {
    const result = accountFormSchema(null).safeParse(values);
    expect(result.success).toBe(false);
    expect(accountFormSchema(null).safeParse({ ...values, currency: 'XOF', openingBalance: '1250' }).success).toBe(true);
  });

  it('exige les colonnes date, libellé et montant du profil CSV activé', () => {
    const result = accountFormSchema('EUR').safeParse({ ...values, csv: { ...defaultCsvDraft(), enabled: true, columns: { ...defaultCsvDraft().columns, amount: '' } } });
    expect(result.success).toBe(false);
    const credit = accountFormSchema('EUR').safeParse({ ...values, csv: { ...defaultCsvDraft(), enabled: true, columns: { ...defaultCsvDraft().columns, amount: '', credit: '4', debit: '5' } } });
    expect(credit.success).toBe(true);
  });

  it('refuse un pays à une lettre', () => {
    expect(accountFormSchema('EUR').safeParse({ ...values, country: 'F' }).success).toBe(false);
  });

  it('fait l’aller-retour du profil CSV', () => {
    const draft = { ...defaultCsvDraft(), enabled: true, thousandsSeparator: '.' as const };
    const profile = draftToProfile(draft);
    expect(profile).toMatchObject({ delimiter: ';', thousandsSeparator: '.', columns: { booking_date: 1, label: 2, amount: 3 } });
    expect(profileToDraft(profile)).toMatchObject({ enabled: true, thousandsSeparator: '.', columns: { booking_date: '1' } });
    expect(draftToProfile(defaultCsvDraft())).toBeNull();
  });
});

describe('répartition d’un encaissement', () => {
  const schema = settleFormSchema(85000, 'EUR');
  const base = { mode: 'settle_lease' as const, invoiceId: '', invoiceAmount: '' };
  const lease = (id: string, amount: string) => ({ leaseId: id, amount });
  const A = '01934f6e-0000-7000-8000-0000000000f1';
  const B = '01934f6e-0000-7000-8000-0000000000f2';

  it('accepte une répartition qui totalise exactement la ligne', () => {
    const parsed = schema.parse({ ...base, allocations: [lease(A, '500'), lease(B, '350')] });
    expect(settleFormToInput(parsed, 'EUR')).toEqual({ action: 'settle_lease', allocations: [{ leaseId: A, amount: 50000 }, { leaseId: B, amount: 35000 }] });
  });

  it('refuse un total différent, un doublon de bail et un montant nul', () => {
    expect(schema.safeParse({ ...base, allocations: [lease(A, '500'), lease(B, '349,99')] }).success).toBe(false);
    expect(schema.safeParse({ ...base, allocations: [lease(A, '500'), lease(A, '350')] }).success).toBe(false);
    expect(schema.safeParse({ ...base, allocations: [lease(A, '850'), lease(B, '0')] }).success).toBe(false);
    expect(schema.safeParse({ ...base, allocations: [lease('', '850')] }).success).toBe(false);
  });

  it('borne le montant d’un règlement de facture à la ligne', () => {
    const invoice = { ...base, mode: 'settle_invoice' as const, allocations: [], invoiceId: A };
    expect(schema.safeParse({ ...invoice, invoiceAmount: '' }).success).toBe(true);
    expect(schema.safeParse({ ...invoice, invoiceAmount: '850,01' }).success).toBe(false);
    expect(schema.safeParse({ ...invoice, invoiceId: '' }).success).toBe(false);
  });

  it('n’exige rien de plus pour les frais bancaires', () => {
    const parsed = schema.parse({ ...base, mode: 'bank_charges', allocations: [] });
    expect(settleFormToInput(parsed, 'EUR')).toEqual({ action: 'bank_charges' });
  });
});

describe('état mensuel et fichiers', () => {
  const build = { accountId: 'x', month: '2026-03', enteredBalance: '', proof: null, currency: 'EUR' as const };

  it('exige la pièce dès qu’un solde est saisi', () => {
    expect(reconciliationFormSchema.safeParse(build).success).toBe(true);
    expect(reconciliationFormSchema.safeParse({ ...build, enteredBalance: '1480,50' }).success).toBe(false);
    expect(reconciliationFormSchema.safeParse({ ...build, enteredBalance: '1480,50', proof: new File(['x'], 'p.pdf') }).success).toBe(true);
  });

  it('refuse un mois invalide', () => {
    expect(reconciliationFormSchema.safeParse({ ...build, month: '2026-13' }).success).toBe(false);
  });

  it('contrôle l’extension, la taille et le vide d’un relevé', () => {
    expect(importFileProblem(new File(['x'], 'a.csv'))).toBeNull();
    expect(importFileProblem(new File(['x'], 'a.XML'))).toBeNull();
    expect(importFileProblem(new File(['x'], 'a.pdf'))).toMatch(/Format non pris en charge/);
    expect(importFileProblem(new File([], 'a.csv'))).toMatch(/vide/);
    expect(importFileProblem(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.csv'))).toMatch(/volumineux/);
    expect(formatOfFile(new File(['x'], 'a.xml'))).toBe('camt053');
    expect(formatOfFile(new File(['x'], 'a.csv'))).toBe('csv');
  });
});

describe('explication codée', () => {
  it('traduit les codes connus et ignore les inconnus', () => {
    expect(explanationText(['amount_equals_outstanding', 'code_inconnu'])).toBe('Montant égal au reste dû.');
    expect(explanationText(['code_inconnu'])).toBe('Correspondance proposée par le serveur.');
  });
});
