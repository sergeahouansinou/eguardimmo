import type { CampaignAudienceKind } from './model';

export const MERGE_FIELDS: Readonly<Record<CampaignAudienceKind, readonly string[]>> = {
  tenants: ['Prénom', 'Bien', 'Mois', 'Échéance'],
  mandants: ['Prénom', 'Mandat', 'Mois'],
};

const SAMPLES: Readonly<Record<string, string>> = {
  Prénom: 'Awa',
  Bien: 'Apt A1',
  Mois: 'novembre 2026',
  Échéance: '1er décembre 2026',
  Mandat: 'M-2025-0142',
};

const TAG = /\{\{\s*([^{}]+?)\s*\}\}|\{\s*([^{}]+?)\s*\}/gu;

function nameOf(match: RegExpMatchArray): string {
  return (match[1] ?? match[2] ?? '').trim();
}

export function unknownMergeFields(text: string, audience: CampaignAudienceKind): string[] {
  const allowed = MERGE_FIELDS[audience];
  const unknown = new Set<string>();
  for (const match of text.matchAll(TAG)) {
    const name = nameOf(match);
    if (!allowed.includes(name)) unknown.add(name);
  }
  return [...unknown];
}

export function previewText(text: string, audience: CampaignAudienceKind): string {
  const allowed = MERGE_FIELDS[audience];
  return text.replace(TAG, (_match: string, double?: string, single?: string) => {
    const name = (double ?? single ?? '').trim();
    return allowed.includes(name) ? (SAMPLES[name] ?? '') : '';
  });
}

export function mergeToken(field: string): string {
  return `{{ ${field} }}`;
}
