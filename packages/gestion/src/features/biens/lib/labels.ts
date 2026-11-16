import type { Tone } from '@eguardimmo/shell';
import type { ChargedTo, Family } from '../schemas/equipements';
import type { Repartition, SiteType } from '../schemas/immeubles';
import type { DiagnosticStatus, Heating, Listing, LotStatus, LotType } from '../schemas/lots';
import type { MeterKind, Reason } from '../schemas/releves';

export const LOT_TYPE_LABELS: Record<LotType, string> = {
  appartement: 'Appartement',
  studio: 'Studio',
  maison: 'Maison',
  parking: 'Parking',
  bureau: 'Bureau',
  garage: 'Garage ou cave',
  cave: 'Cave',
  local: 'Local commercial',
  terrain: 'Terrain',
  autre: 'Autre',
};

export const LOT_STATUS_LABELS: Record<LotStatus, { label: string; tone: Tone }> = {
  retard: { label: 'Loyer en retard', tone: 'danger' },
  a_jour: { label: 'À jour', tone: 'success' },
  preavis: { label: 'Préavis', tone: 'warning' },
  a_louer: { label: 'À louer', tone: 'neutral' },
  travaux: { label: 'En travaux', tone: 'info' },
};

export const LISTING_LABELS: Record<Listing, string> = { en_ligne: 'En ligne', hors_ligne: 'Hors ligne' };

export const SITE_TYPE_LABELS: Record<SiteType, string> = { building: 'Immeuble', house: 'Maison', complex: 'Ensemble immobilier' };

export function lotStatusBadge(lot: { status: LotStatus | null; tenant: unknown }): { label: string; tone: Tone } {
  if (lot.status !== null) return LOT_STATUS_LABELS[lot.status];
  return lot.tenant ? { label: 'Loué', tone: 'success' } : { label: 'Libre', tone: 'neutral' };
}

export const HEATING_LABELS: Record<Heating, string> = {
  electrique: 'Électrique',
  gaz: 'Gaz',
  pompe_a_chaleur: 'Pompe à chaleur',
};

export const REPARTITION_LABELS: Record<Repartition, string> = {
  tantiemes: 'Tantièmes',
  surface: 'Surface',
};

export const FAMILY_LABELS: Record<Family, string> = {
  climatisation: 'Climatisation',
  chauffage: 'Chauffage et eau chaude',
  electromenager: 'Électroménager',
  cuisine: 'Cuisine',
  ventilation: 'Ventilation',
  securite: 'Sécurité',
  acces: 'Accès',
  plomberie: 'Plomberie',
};

export const CHARGED_LABELS: Record<ChargedTo, string> = {
  bailleur: 'Bailleur',
  locataire: 'Locataire',
  copropriete: 'Copropriété',
};

export const METER_LABELS: Record<MeterKind, string> = {
  electricite: 'Électricité',
  eau_froide: 'Eau froide',
  eau_chaude: 'Eau chaude',
  gaz: 'Gaz',
};

export const REASON_LABELS: Record<Reason, string> = {
  en_cours_de_bail: 'En cours de bail',
  entree: 'Entrée',
  sortie: 'Sortie',
};

export const DIAGNOSTIC_LABELS: Record<DiagnosticStatus, { label: string; tone: Tone }> = {
  valide: { label: 'Valide', tone: 'success' },
  a_refaire: { label: 'À refaire', tone: 'warning' },
  expire: { label: 'Expiré', tone: 'danger' },
  sans_objet: { label: 'Sans objet', tone: 'neutral' },
};
