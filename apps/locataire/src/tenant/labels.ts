import type { Tone } from '@eguardimmo/shell';

export type LeasePhase = 'upcoming' | 'running' | 'notice' | 'ended';

export const PHASE_VIEW: Record<LeasePhase, { label: string; tone: Tone }> = {
  upcoming: { label: 'À venir', tone: 'info' },
  running: { label: 'En cours', tone: 'success' },
  notice: { label: 'Congé donné', tone: 'warning' },
  ended: { label: 'Terminé', tone: 'neutral' },
};

const REGIMES: Readonly<Record<string, string>> = {
  'fr.residential.furnished': 'Logement meublé (loi du 6 juillet 1989)',
  'fr.residential.unfurnished': 'Logement vide (loi du 6 juillet 1989)',
  'fr.residential.mobility': 'Bail mobilité (loi du 6 juillet 1989)',
  'fr.common_law': 'Droit commun (parking ou garage seul)',
};

const UNIT_TYPES: Readonly<Record<string, string>> = {
  apartment: 'Appartement',
  studio: 'Studio',
  house: 'Maison',
  parking: 'Parking',
  garage: 'Garage',
  cellar: 'Cave',
  commercial_premises: 'Local commercial',
  office: 'Bureau',
  land: 'Terrain',
};

const PERIODICITIES: Readonly<Record<string, string>> = {
  monthly: 'mensuel',
  quarterly: 'trimestriel',
  semiannual: 'semestriel',
  annual: 'annuel',
};

const BILLING_TIMINGS: Readonly<Record<string, string>> = {
  advance: 'à échoir (payable d’avance)',
  arrears: 'à terme échu',
};

const PAYMENT_METHODS: Readonly<Record<string, string>> = {
  transfer: 'Virement',
  direct_debit: 'Prélèvement',
  card: 'Carte bancaire',
  cheque: 'Chèque',
  cash: 'Espèces',
};

const ROLES: Readonly<Record<string, string>> = {
  tenant: 'Locataire',
  guarantor: 'Garant',
  occupant: 'Occupant',
};

const NOTICE_AUTHORS: Readonly<Record<string, string>> = {
  tenant: 'le locataire',
  landlord: 'le bailleur',
};

export const regimeLabel = (key: string): string => REGIMES[key] ?? key;
export const unitTypeLabel = (key: string): string => UNIT_TYPES[key] ?? key;

export function unitDisplayName(unit: { type: string; reference: string }): string {
  const type = unitTypeLabel(unit.type);
  return unit.reference.toLowerCase().startsWith(type.toLowerCase()) ? unit.reference : `${type} ${unit.reference}`;
}
export const periodicityLabel = (key: string): string => PERIODICITIES[key] ?? key;
export const billingTimingLabel = (key: string): string => BILLING_TIMINGS[key] ?? key;
export const paymentMethodLabel = (key: string): string => PAYMENT_METHODS[key] ?? key;
export const roleLabel = (key: string): string => ROLES[key] ?? key;
export const noticeAuthorLabel = (key: string): string => NOTICE_AUTHORS[key] ?? key;
