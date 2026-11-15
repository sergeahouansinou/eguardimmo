import type { DocumentRecord } from '../schemas/common';
import type { Inventaire, Meter, Reading } from '../schemas/releves';
import type { EquipementRecord, ImmeubleExtras, ImmeubleRecord, LotExtras, LotRecord } from './records';
import { seedDocuments } from './seed-documents';
import { climatiseurRich } from './seed-equipements-rich';
import { seedEquipements } from './seed-equipements';
import { tilleulsExtras } from './seed-immeubles';
import { aptA1Extras, aptA1Rich, studioB3Extras, studioB3Rich } from './seed-lot-details';
import { seedImmeubles, seedLots } from './seed-lots';
import { meterSeeds, seedInventaires, seedReadings } from './seed-readings';

export interface DemoState {
  immeubles: ImmeubleRecord[];
  lots: LotRecord[];
  lotExtras: Record<string, LotExtras>;
  immeubleExtras: Record<string, ImmeubleExtras>;
  equipements: EquipementRecord[];
  documents: DocumentRecord[];
  meters: Meter[];
  readings: Reading[];
  inventaires: Inventaire[];
}

export function emptyLotExtras(): LotExtras {
  return { occupation: null, lease: null, diagnostics: null, finances: null, suivi: null };
}

export function emptyImmeubleExtras(): ImmeubleExtras {
  return { charges: null, copro: null, interventions: null, badges: [], keys: [], coproSummary: [] };
}

export function createDemoState(): DemoState {
  const lots = structuredClone(seedLots()).map((lot) => {
    if (lot.row.id === 'apt-a1') return { ...lot, rich: aptA1Rich };
    if (lot.row.id === 'studio-b3') return { ...lot, rich: studioB3Rich };
    return lot;
  });
  return {
    immeubles: structuredClone(seedImmeubles),
    lots,
    lotExtras: structuredClone({
      'apt-a1': aptA1Extras,
      'studio-b3': { ...emptyLotExtras(), ...studioB3Extras },
    }),
    immeubleExtras: structuredClone({ 'les-tilleuls': tilleulsExtras }),
    equipements: structuredClone(seedEquipements).map((record) => ({
      ...record,
      rich: record.row.id === 'climatiseur-reversible' ? structuredClone(climatiseurRich) : record.rich,
      photoNames: [],
    })),
    documents: seedDocuments(),
    meters: structuredClone(meterSeeds),
    readings: seedReadings(),
    inventaires: seedInventaires(),
  };
}
