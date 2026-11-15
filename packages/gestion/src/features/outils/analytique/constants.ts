export const EXPENSE_CATEGORIES = [
  { id: 'copropriete', label: 'Charges de copropriété' },
  { id: 'travaux', label: 'Travaux et réparations' },
  { id: 'interets', label: "Intérêts d'emprunt" },
  { id: 'taxe-fonciere', label: 'Taxe foncière' },
  { id: 'gestion', label: 'Frais de gestion' },
  { id: 'assurances', label: 'Assurances' },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

export const EXPENSE_CATEGORY_IDS = EXPENSE_CATEGORIES.map((category) => category.id) as [
  ExpenseCategoryId,
  ...ExpenseCategoryId[],
];

export const categoryLabel = (id: ExpenseCategoryId): string =>
  EXPENSE_CATEGORIES.find((category) => category.id === id)?.label ?? id;

export const LOT_TYPES = [
  { id: 'appartement', label: 'Appartement' },
  { id: 'studio', label: 'Studio' },
  { id: 'maison', label: 'Maison' },
  { id: 'stationnement', label: 'Parking et garage' },
  { id: 'cave', label: 'Cave' },
] as const;

export type LotTypeId = (typeof LOT_TYPES)[number]['id'];

export const LOT_TYPE_IDS = LOT_TYPES.map((type) => type.id) as [LotTypeId, ...LotTypeId[]];

export const OCCUPANCY_LABELS = {
  O: 'Loué',
  P: 'Préavis en cours',
  V: 'Vacant',
  T: 'Travaux',
} as const;

export type OccupancyStatus = keyof typeof OCCUPANCY_LABELS;

export const OCCUPANCY_STATUSES = ['O', 'P', 'V', 'T'] as const;

export const WINDOW_START = '2025-12';
export const WINDOW_END = '2026-11';
export const PREVIOUS_START = '2024-12';

export const DAYS_PER_MONTH = 30.4;

export const AGE_BUCKETS = [
  { id: 'd30', label: '0 à 30 jours', max: 30 },
  { id: 'd60', label: '31 à 60 jours', max: 60 },
  { id: 'd90', label: '61 à 90 jours', max: 90 },
  { id: 'd90p', label: 'Plus de 90 jours', max: Number.POSITIVE_INFINITY },
] as const;
