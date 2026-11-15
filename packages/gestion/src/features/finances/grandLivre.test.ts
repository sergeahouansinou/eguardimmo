import { describe, expect, it } from 'vitest';
import { createDemoFinances } from './demo';
import { grandLivreOf } from './grandLivre';

describe('grandLivreOf', () => {
  it('cumule débits et crédits du locataire dans l’ordre chronologique', () => {
    const book = grandLivreOf(createDemoFinances(), 'koffi-adjovi');
    expect(book?.locataire).toBe('Koffi Adjovi');
    const dates = book?.lignes.map((ligne) => ligne.date) ?? [];
    expect([...dates].sort()).toEqual(dates);
    expect(book?.totalDebit).toBeGreaterThan(0);
    expect(book?.solde).toBe((book?.totalDebit ?? 0) - (book?.totalCredit ?? 0));
    expect(book?.lignes.at(-1)?.solde).toBe(book?.solde);
  });

  it('reprend l’appel impayé, les frais payés et les frais en attente', () => {
    const book = grandLivreOf(createDemoFinances(), 'koffi-adjovi');
    const appel = book?.lignes.find((ligne) => ligne.id === 'ech-2026-11-koffi-adjovi');
    expect(appel).toMatchObject({ kind: 'echeance', debit: 85000, credit: 0 });
    expect(book?.lignes.find((ligne) => ligne.id === 'fa-2026-0025')).toMatchObject({ kind: 'facture', debit: 13070 });
    expect(book?.lignes.find((ligne) => ligne.id === 'fa-2026-0023-reglement')).toMatchObject({ kind: 'paiement', credit: 1500 });
  });

  it('un règlement apparaît en crédit et réduit le solde', () => {
    const book = grandLivreOf(createDemoFinances(), 'clarisse-hounkpatin');
    const reglement = book?.lignes.find((ligne) => ligne.kind === 'paiement' && ligne.credit === 81000);
    expect(reglement).toBeDefined();
    const appel = book?.lignes.find((ligne) => ligne.id === 'ech-2026-11-clarisse-hounkpatin');
    expect(appel?.debit).toBe(102000);
  });

  it('un avoir est un crédit', () => {
    const data = createDemoFinances();
    const avoir = data.factures.find((facture) => facture.type === 'avoir');
    const book = grandLivreOf(data, avoir?.locataireId ?? '');
    const line = book?.lignes.find((ligne) => ligne.id === avoir?.id);
    expect(line?.kind).toBe('avoir');
    expect(line?.credit).toBe(-(avoir?.montantTtc ?? 0));
  });

  it('filtre par bail et ignore un locataire inconnu', () => {
    const data = createDemoFinances();
    const filtered = grandLivreOf(data, 'koffi-adjovi', 'bl-2021-0001');
    expect(filtered?.lignes.every((ligne) => ligne.bien.startsWith('Studio C2') || ligne.bien === '')).toBe(true);
    expect(filtered?.baux).toHaveLength(2);
    expect(grandLivreOf(data, 'inconnu')).toBeUndefined();
  });

  it('exclut les échéances annulées', () => {
    const data = createDemoFinances();
    const echeance = data.echeances.find((item) => item.id === 'ech-2026-11-koffi-adjovi');
    if (!echeance) throw new Error('échéance absente');
    echeance.statut = 'annulee';
    expect(grandLivreOf(data, 'koffi-adjovi')?.lignes.some((ligne) => ligne.id === echeance.id)).toBe(false);
  });
});
