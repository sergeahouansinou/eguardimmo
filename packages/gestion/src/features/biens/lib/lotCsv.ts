import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';
import { LOT_TYPE_LABELS } from './labels';
import { parseAmountToMinor, parseDecimal, toMajorInput } from './amount';
import { toCsv, parseCsv } from './files';
import { fold } from './text';
import { LOT_TYPES } from '../schemas/lots';
import type { LotImportRow, LotRow } from '../schemas/lots';

export const LOT_CSV_HEADER = ['Nom', 'Immeuble', 'Type', 'Surface (m²)', 'Pièces', 'Loyer charges comprises'] as const;

export function lotsTemplateCsv(): string {
  return toCsv([LOT_CSV_HEADER, ['Apt E5', 'Les Tilleuls', 'Appartement', '48,5', '2', '800']]);
}

export function lotsToCsv(lots: readonly LotRow[], currency: Currency): string {
  const header = ['Nom', 'Immeuble', 'Type', 'Surface (m²)', 'Pièces', 'Locataire', 'Loyer charges comprises', 'Annonce', 'Archivé'];
  const rows = lots.map((lot) => [
    lot.name,
    lot.immeubleName,
    LOT_TYPE_LABELS[lot.type],
    String(lot.surface).replace('.', ','),
    lot.rooms,
    lot.tenant?.name ?? '',
    toMajorInput(lot.rent, currency),
    lot.listing === 'en_ligne' ? 'En ligne' : 'Hors ligne',
    lot.archived ? 'Oui' : 'Non',
  ]);
  return toCsv([header, ...rows]);
}

export interface ParsedLots {
  rows: LotImportRow[];
  errors: string[];
}

export function parseLotsCsv(content: string, currency: Currency): ParsedLots {
  const table = parseCsv(content);
  const [header, ...body] = table;
  if (!header || fold(header[0] ?? '') !== 'nom') {
    return { rows: [], errors: ['La première ligne doit contenir les en-têtes du modèle (Nom, Immeuble, Type…).'] };
  }
  const rows: LotImportRow[] = [];
  const errors: string[] = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    const [name = '', immeubleName = '', typeText = '', surfaceText = '', roomsText = '', rentText = ''] = cells.map((cell) => cell.trim());
    const type = LOT_TYPES.find((entry) => fold(LOT_TYPE_LABELS[entry]) === fold(typeText) || entry === fold(typeText));
    const surface = parseDecimal(surfaceText);
    const rooms = roomsText === '' ? null : /^\d{1,2}$/.test(roomsText) ? Number(roomsText) : undefined;
    const rent = rentText === '' ? null : parseAmountToMinor(rentText, currency);
    const problems = [
      name === '' ? 'nom manquant' : null,
      immeubleName === '' ? 'immeuble manquant' : null,
      type ? null : `type inconnu « ${typeText} »`,
      surface === null || surface <= 0 ? 'surface invalide' : null,
      rooms === undefined ? 'nombre de pièces invalide' : null,
      rent === null && rentText !== '' ? `loyer invalide (${String(minorDigits(currency))} décimale(s) au plus)` : null,
    ].filter((problem): problem is string => problem !== null);
    if (problems.length > 0 || !type || surface === null || rooms === undefined) {
      errors.push(`Ligne ${String(line)} : ${problems.join(', ')}.`);
      return;
    }
    rows.push({ name, immeubleName, type, surface, rooms, rent });
  });
  if (rows.length === 0 && errors.length === 0) errors.push('Le fichier ne contient aucune ligne à importer.');
  return { rows, errors };
}
