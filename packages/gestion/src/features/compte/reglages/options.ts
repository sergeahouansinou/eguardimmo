import type { SelectOption } from '@eguardimmo/ui';

export const displayNameOptions: SelectOption[] = [
  { value: 'prenom-nom', label: 'Prénom Nom' },
  { value: 'nom-prenom', label: 'Nom Prénom' },
];
export const languageOptions: SelectOption[] = [{ value: 'fr', label: 'Français' }];
export const currencyOptions: SelectOption[] = [
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'XOF', label: 'Franc CFA (FCFA)' },
];
export const dateFormatOptions: SelectOption[] = [
  { value: 'jj/mm/aaaa', label: 'jj/mm/aaaa' },
  { value: 'mm/jj/aaaa', label: 'mm/jj/aaaa' },
  { value: 'aaaa-mm-jj', label: 'aaaa-mm-jj' },
];
export const timezoneOptions: SelectOption[] = [
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
  { value: 'Africa/Porto-Novo', label: 'Africa/Porto-Novo (UTC+1)' },
  { value: 'Africa/Dakar', label: 'Africa/Dakar (UTC+0)' },
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan (UTC+0)' },
];
export const areaUnitOptions: SelectOption[] = [
  { value: 'm2', label: 'Mètres carrés (m²)' },
  { value: 'ft2', label: 'Pieds carrés (ft²)' },
];
export const fiscalStartOptions: SelectOption[] = [
  { value: '01-01', label: '1er janvier' },
  { value: '04-01', label: '1er avril' },
  { value: '07-01', label: '1er juillet' },
  { value: '10-01', label: '1er octobre' },
];
export const taxRegimeOptions: SelectOption[] = [
  { value: 'foncier-reel', label: 'Revenus fonciers, réel' },
  { value: 'foncier-micro', label: 'Revenus fonciers, micro-foncier' },
  { value: 'lmnp-reel', label: 'Location meublée (LMNP), réel' },
  { value: 'lmnp-micro', label: 'Location meublée (LMNP), micro-BIC' },
];
export const avisScheduleOptions: SelectOption[] = [
  { value: '25-precedent', label: 'Le 25 du mois précédent' },
  { value: '20-precedent', label: 'Le 20 du mois précédent' },
  { value: '15-precedent', label: 'Le 15 du mois précédent' },
  { value: '01-mois', label: 'Le 1er du mois' },
];
export const homePageOptions: SelectOption[] = [
  { value: 'accueil', label: 'Accueil' },
  { value: 'biens', label: 'Biens' },
  { value: 'locataires', label: 'Locataires' },
  { value: 'finances', label: 'Finances' },
  { value: 'messages', label: 'Messages' },
];
export const tenantTabOptions: SelectOption[] = [
  { value: 'a-suivre', label: 'À suivre' },
  { value: 'tous', label: 'Tous' },
  { value: 'candidats', label: 'Candidats' },
];
export const financeTabOptions: SelectOption[] = [
  { value: 'a-encaisser', label: 'À encaisser' },
  { value: 'operations', label: 'Opérations' },
  { value: 'impayes', label: 'Impayés' },
];
export const digestOptions: SelectOption[] = [
  { value: 'lundi', label: 'Chaque lundi' },
  { value: 'quotidien', label: 'Chaque jour' },
  { value: 'jamais', label: 'Jamais' },
];
