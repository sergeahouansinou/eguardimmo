const SAMPLES = new Map([
  ['Prénom', 'Koffi'],
  ['Bien', 'Apt A1'],
  ['Loyer', '770 €'],
  ['Échéance', '1er décembre 2026'],
  ['Mandat', 'M-2025-0142'],
  ['Mois', 'novembre 2026'],
]);

const TAG = /\{\{\s*([^{}]+?)\s*\}\}|\{\s*([^{}]+?)\s*\}/g;

export function fillMergeTags(text: string): string {
  return text.replace(TAG, (match, double: string | undefined, single: string | undefined) => {
    const name = double ?? single ?? '';
    return SAMPLES.get(name) ?? match;
  });
}
