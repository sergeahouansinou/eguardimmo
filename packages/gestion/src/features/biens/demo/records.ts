import type { Badge } from '../schemas/common';
import type { EquipementDetail, EquipementRow } from '../schemas/equipements';
import type { ChargesData, CoproData, ImmeubleIntervData, ImmeubleRow } from '../schemas/immeubles';
import type {
  DiagnosticsData,
  Heating,
  LeaseData,
  LotDetail,
  LotFinances,
  LotRow,
  LotSuivi,
  OccupationData,
} from '../schemas/lots';

export const AS_OF = '2026-11-13';
export const CURRENCY = 'EUR' as const;

export interface ImmeubleRecord {
  row: Omit<ImmeubleRow, 'lots' | 'totalArea'>;
  tantiemesTotal: number;
  builtYear: number | null;
  levels: string | null;
  heating: string | null;
  syndic: string | null;
  registration: string | null;
  totalLots: number | null;
  photoNames: string[];
  photoLabels: string[];
  photoCount: number;
}

export interface LotRichDetail {
  subtitle: string;
  badges: Badge[];
  brief: LotDetail['brief'];
  caracteristiques: LotDetail['caracteristiques'];
  amenityGroups: LotDetail['amenityGroups'];
  photoLabels: string[];
  photoCount: number;
}

export interface LotRecord {
  row: Omit<LotRow, 'immeubleName'>;
  street: string;
  complement: string;
  postalCode: string;
  city: string;
  elevator: boolean;
  heating: Heating;
  amenities: string[];
  rentExcl: number;
  charges: number;
  photoNames: string[];
  rich: Partial<LotRichDetail> | null;
}

export interface LotExtras {
  occupation: Omit<OccupationData, 'currency'> | null;
  lease: Omit<NonNullable<LeaseData>, 'currency'> | null;
  diagnostics: DiagnosticsData | null;
  finances: Omit<LotFinances, 'currency'> | null;
  suivi: LotSuivi | null;
}

export interface ImmeubleExtras {
  charges: Omit<ChargesData, 'currency'> | null;
  copro: Omit<CoproData, 'currency'> | null;
  interventions: Omit<ImmeubleIntervData, 'currency'> | null;
  badges: Badge[];
  keys: { id: string; label: string; detail: string; pill: Badge | null }[];
  coproSummary: { label: string; value: string }[];
}

export interface EquipementRecord {
  row: EquipementRow;
  rich: Omit<EquipementDetail, 'currency' | 'asOf' | 'equipement' | 'values' | 'plan' | 'log'> | null;
  plan: EquipementDetail['plan'];
  log: EquipementDetail['log'];
  photoNames: string[];
}

export type EquipementSeed = Omit<EquipementRecord, 'photoNames'>;
