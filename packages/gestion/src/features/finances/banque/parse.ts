import { parseCsv } from '../csv';
import { isIsoDate, parseFrenchDate } from '../dates';
import { parseMoneyInput } from '../money';

export interface BankInputLine {
  date: string;
  libelle: string;
  montant: number;
}

export interface ParsedBank {
  lignes: BankInputLine[];
  errors: string[];
}

export const MAX_BANK_LINES = 500;
const MAX_LABEL = 120;

const toDate = (text: string): string | null => (isIsoDate(text) ? text : parseFrenchDate(text));

export function parseSignedAmount(text: string): number | null {
  const trimmed = text.trim();
  const negative = /^[-−]/.test(trimmed);
  const value = parseMoneyInput(trimmed.replace(/^[-−+]/, ''));
  if (value === null || value === 0) return null;
  return negative ? -value : value;
}

export function parseBankLines(text: string): ParsedBank {
  const lignes: BankInputLine[] = [];
  const errors: string[] = [];
  const rows = parseCsv(text);
  rows.forEach((cells, index) => {
    const date = toDate(cells[0] ?? '');
    if (date === null && index === 0) return;
    const libelle = (cells[1] ?? '').trim();
    const montant = parseSignedAmount(cells[2] ?? '');
    if (date === null || libelle === '' || montant === null) {
      errors.push(`Ligne ${String(index + 1)} : attendu « date ; libellé ; montant » (montant négatif pour un débit).`);
      return;
    }
    if (libelle.length > MAX_LABEL) {
      errors.push(`Ligne ${String(index + 1)} : libellé de plus de ${String(MAX_LABEL)} caractères.`);
      return;
    }
    lignes.push({ date, libelle, montant });
  });
  if (lignes.length > MAX_BANK_LINES) errors.push(`Import limité à ${String(MAX_BANK_LINES)} opérations à la fois.`);
  if (lignes.length === 0 && errors.length === 0) errors.push('Aucune opération reconnue.');
  return { lignes, errors };
}
