import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, formatDate, formatMonthYear, formatWeekdayDate, monthOf, plural } from './dates';
import { buildDemoPdf } from './demoPdf';
import { ATTESTATION_RULES, AVATAR_RULES, PHOTO_RULES, checkFile } from './files';
import { ibanLast4, isValidIban, maskIban, normalizeIban } from './iban';
import { formatAmount, formatFileSize, formatMoney } from './money';

describe('dates', () => {
  it('formate en jj/mm/aaaa', () => {
    expect(formatDate('2026-11-03')).toBe('03/11/2026');
  });

  it('ajoute des mois en plafonnant au dernier jour du mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-13', 2)).toBe('2027-01-13');
  });

  it('ajoute des jours en passant le mois', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-13')).toBe(12);
    expect(daysBetween('2026-11-13', '2026-11-01')).toBe(-12);
  });

  it('nomme les mois et les jours en français', () => {
    expect(formatMonthYear('2026-11')).toBe('Novembre 2026');
    expect(formatWeekdayDate('2026-11-17')).toBe('Mardi 17/11/2026');
    expect(monthOf('2026-10')).toBe("d'octobre");
    expect(monthOf('2026-11')).toBe('de novembre');
  });

  it('accorde le pluriel', () => {
    expect(plural(1, 'jour', 'jours')).toBe('1 jour');
    expect(plural(3, 'jour', 'jours')).toBe('3 jours');
  });
});

describe('money', () => {
  it('formate les centimes en euros', () => {
    expect(formatMoney(85000)).toBe('850\u00a0€');
    expect(formatMoney(85000, { fixed: true })).toBe('850,00\u00a0€');
    expect(formatMoney(76250)).toBe('762,50\u00a0€');
  });

  it('refuse un montant non entier', () => {
    expect(() => formatMoney(10.5)).toThrow(RangeError);
    expect(() => formatAmount(0.2)).toThrow(RangeError);
  });

  it('formate un montant sans symbole et une taille de fichier', () => {
    expect(formatAmount(77000)).toBe('770,00');
    expect(formatFileSize(3_800_000)).toBe('3,8\u00a0Mo');
    expect(formatFileSize(100_000)).toBe('100\u00a0Ko');
  });
});

describe('iban', () => {
  it('accepte un IBAN français valide avec ou sans espaces', () => {
    expect(isValidIban('FR7630006000011234567890189')).toBe(true);
    expect(isValidIban('fr76 3000 6000 0112 3456 7890 189')).toBe(true);
  });

  it('refuse une clé de contrôle fausse', () => {
    expect(isValidIban('FR7730006000011234567890189')).toBe(false);
  });

  it('refuse une longueur incorrecte pour le pays', () => {
    expect(isValidIban('FR76300060000112345678901')).toBe(false);
  });

  it('refuse une saisie qui n’est pas un IBAN', () => {
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('1234')).toBe(false);
  });

  it('masque tout sauf les 4 derniers caractères', () => {
    expect(normalizeIban('fr76 3000')).toBe('FR763000');
    expect(ibanLast4('FR76 3000 6000 0112 3456 7890 189')).toBe('0189');
    expect(maskIban('0189')).toBe('•••• 0189');
  });
});

describe('files', () => {
  const photo = { name: 'fuite.jpg', size: 1_000, type: 'image/jpeg' };

  it('accepte un fichier conforme', () => {
    expect(checkFile(photo, PHOTO_RULES)).toEqual({ ok: true });
    expect(checkFile({ name: 'attestation.pdf', size: 2_000, type: 'application/pdf' }, ATTESTATION_RULES).ok).toBe(true);
  });

  it('refuse un fichier vide', () => {
    expect(checkFile({ ...photo, size: 0 }, PHOTO_RULES).ok).toBe(false);
  });

  it('refuse un fichier trop lourd', () => {
    const check = checkFile({ ...photo, size: 5 * 1024 * 1024 + 1 }, AVATAR_RULES);
    expect(check.ok).toBe(false);
    expect(check.error).toContain('5 Mo');
  });

  it('refuse un type ou une extension non acceptés', () => {
    expect(checkFile({ name: 'script.exe', size: 10, type: 'application/x-msdownload' }, ATTESTATION_RULES).ok).toBe(false);
    expect(checkFile({ name: 'faux.pdf', size: 10, type: 'image/jpeg' }, ATTESTATION_RULES).ok).toBe(true);
    expect(checkFile({ name: 'doc.pdf', size: 10, type: 'application/pdf' }, PHOTO_RULES).ok).toBe(false);
  });
});

describe('demoPdf', () => {
  it('produit un PDF structuré avec le titre', () => {
    const pdf = buildDemoPdf('Quittance de loyer', ['Octobre 2026']);
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('Quittance de loyer');
  });
});
