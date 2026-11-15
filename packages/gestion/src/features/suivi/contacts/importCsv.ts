import { BIENS } from '../shared/biens';
import { CSV_MAX_ROWS, parseDelimited } from '../shared/csv';
import { fold } from '../shared/text';
import { CATEGORIES, categoryLabels, contactInputSchema } from './schemas';
import type { ContactInput } from './schemas';

export const CONTACT_CSV_HEADER = ['Nom', 'Interlocuteur', 'Catégorie', 'Spécialité', 'Téléphone', 'E-mail', 'Biens', 'Partagé', 'Notes'] as const;

export const CONTACT_CSV_TEMPLATE = [
  CONTACT_CSV_HEADER.join(';'),
  'Plomberie Sanvi;Rodrigue Sanvi;Artisan;plombier;+33 6 12 40 18 77;contact@plomberie-sanvi.fr;Apt A1|Apt B3;oui;Intervient sous 48 h',
].join('\r\n');

export interface RejectedRow {
  line: number;
  reasons: string[];
}

export interface ContactImportReport {
  accepted: ContactInput[];
  rejected: RejectedRow[];
  fatal: string | null;
}

type ColumnKey = 'name' | 'subtitle' | 'category' | 'detail' | 'phone' | 'email' | 'biens' | 'shared' | 'notes';

const COLUMN_KEYS: Record<string, ColumnKey> = {
  nom: 'name',
  interlocuteur: 'subtitle',
  categorie: 'category',
  specialite: 'detail',
  telephone: 'phone',
  email: 'email',
  biens: 'biens',
  bien: 'biens',
  partage: 'shared',
  notes: 'notes',
};

const SHARED_TRUE = ['oui', 'o', 'true', '1', 'x', 'partage'];
const SHARED_FALSE = ['', 'non', 'n', 'false', '0', 'prive'];

function categoryOf(value: string): string | undefined {
  const needle = fold(value).replace(/s$/, '');
  return CATEGORIES.find((category) => category === needle || fold(categoryLabels[category]) === needle);
}

function bienOf(label: string): string | undefined {
  const needle = fold(label);
  return BIENS.find((bien) => bien.id === needle || fold(bien.short) === needle || fold(bien.label) === needle)?.id;
}

export function parseContactsCsv(text: string): ContactImportReport {
  const rows = parseDelimited(text);
  const [header, ...body] = rows;
  if (!header) return { accepted: [], rejected: [], fatal: 'Le fichier est vide.' };
  const columns = new Map<ColumnKey, number>();
  header.forEach((title, position) => {
    const key = COLUMN_KEYS[fold(title).replace(/[^a-z]/g, '')];
    if (key && !columns.has(key)) columns.set(key, position);
  });
  if (!columns.has('name') || !columns.has('category')) {
    return { accepted: [], rejected: [], fatal: 'Les colonnes « Nom » et « Catégorie » sont obligatoires en première ligne.' };
  }
  if (body.length === 0) return { accepted: [], rejected: [], fatal: 'Le fichier ne contient aucun contact.' };
  if (body.length > CSV_MAX_ROWS) return { accepted: [], rejected: [], fatal: `Le fichier dépasse ${String(CSV_MAX_ROWS)} lignes.` };

  const accepted: ContactInput[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  body.forEach((cells, offset) => {
    const line = offset + 2;
    const cell = (key: ColumnKey): string => {
      const position = columns.get(key);
      return position === undefined ? '' : (cells[position] ?? '');
    };
    const reasons: string[] = [];
    const category = categoryOf(cell('category'));
    if (!category) reasons.push(`Catégorie inconnue : « ${cell('category')} ».`);
    const bienIds: string[] = [];
    for (const label of cell('biens').split(/[|/]/).map((item) => item.trim()).filter((item) => item !== '')) {
      const id = bienOf(label);
      if (id) bienIds.push(id);
      else reasons.push(`Bien inconnu : « ${label} ».`);
    }
    const sharedText = fold(cell('shared'));
    const shared = SHARED_TRUE.includes(sharedText);
    if (!shared && !SHARED_FALSE.includes(sharedText)) reasons.push(`Partage non reconnu : « ${cell('shared')} », attendu oui ou non.`);
    const parsed = contactInputSchema.safeParse({
      name: cell('name'),
      subtitle: cell('subtitle'),
      category,
      detail: cell('detail'),
      phone: cell('phone'),
      email: cell('email'),
      bienIds,
      shared,
      notes: cell('notes'),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) if (!(category === undefined && issue.path[0] === 'category')) reasons.push(issue.message);
    }
    const key = fold(cell('name'));
    if (parsed.success && seen.has(key)) reasons.push('Contact en double dans le fichier.');
    if (reasons.length > 0 || !parsed.success) {
      rejected.push({ line, reasons: [...new Set(reasons)] });
      return;
    }
    seen.add(key);
    accepted.push(parsed.data);
  });
  return { accepted, rejected, fatal: null };
}
