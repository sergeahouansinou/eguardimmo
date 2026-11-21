import type { ContactKind, ContactLanguage, ContactPointType, ContactStatus, DuplicateReason } from './model';

export const kindLabel: Record<ContactKind, string> = { person: 'Personne', company: 'Société' };
export const pointTypeLabel: Record<ContactPointType, string> = { email: 'E-mail', phone: 'Téléphone' };
export const languageLabel: Record<ContactLanguage, string> = { fr: 'Français', en: 'Anglais', nl: 'Néerlandais', de: 'Allemand' };
export const languageText = (code: string): string => new Map<string, string>(Object.entries(languageLabel)).get(code) ?? code;
export const statusLabel: Record<ContactStatus, string> = { active: 'Actifs', archived: 'Archivés', all: 'Tous' };
export const reasonLabel: Record<DuplicateReason, string> = {
  email: 'même e-mail',
  phone: 'même téléphone',
  identifier: 'même identifiant',
  name: 'même nom',
};

export const reasonsText = (reasons: readonly DuplicateReason[]): string => reasons.map((reason) => reasonLabel[reason]).join(', ');

export const COUNTRIES = [
  { value: 'FR', label: 'France' },
  { value: 'BE', label: 'Belgique' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'CA', label: 'Canada' },
  { value: 'CH', label: 'Suisse' },
  { value: 'BJ', label: 'Bénin' },
] as const;

export const NOTE_HINT = 'Faits objectifs uniquement : aucune donnée sensible (santé, opinions, situation personnelle).';
