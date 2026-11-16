'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import type { ClientQuery } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ZodType } from 'zod';
import { BIENS_ROOT, OCCUPANCY_ROOTS } from '../queryRoots';
import { isStaleVersion } from './errors';
import { documentsSchema } from './schemas/common';
import type { DocumentsData, Owner } from './schemas/common';
import { equipementDetailSchema, equipementIntervSchema, equipementsSchema } from './schemas/equipements';
import type { EquipementDetail, EquipementIntervData, EquipementsData } from './schemas/equipements';
import {
  chargesSchema,
  coproSchema,
  immeubleDetailSchema,
  immeubleIntervSchema,
  immeublesSchema,
} from './schemas/immeubles';
import type { ChargesData, CoproData, ImmeubleDetail, ImmeubleIntervData, ImmeublesData } from './schemas/immeubles';
import {
  diagnosticsSchema,
  leaseSchema,
  lotDetailSchema,
  lotFinancesSchema,
  lotSuiviSchema,
  lotsSchema,
  occupationSchema,
} from './schemas/lots';
import type {
  DiagnosticsData,
  LeaseData,
  LotDetail,
  LotFinances,
  LotSuivi,
  LotsData,
  OccupationData,
} from './schemas/lots';
import { inventairesSchema, readingsSchema } from './schemas/releves';
import type { InventairesData, ReadingsData } from './schemas/releves';
import { useBiensSource } from './source';
import type { BiensSource } from './source';

export const biensKeys = {
  all: BIENS_ROOT,
  lots: ['biens', 'lots'] as const,
  lot: (id: string) => ['biens', 'lot', id] as const,
  lotPart: (part: string, id: string) => ['biens', 'lot', id, part] as const,
  immeubles: ['biens', 'immeubles'] as const,
  immeuble: (id: string) => ['biens', 'immeuble', id] as const,
  immeublePart: (part: string, id: string) => ['biens', 'immeuble', id, part] as const,
  equipements: ['biens', 'equipements'] as const,
  equipement: (id: string) => ['biens', 'equipement', id] as const,
  equipementPart: (part: string, id: string) => ['biens', 'equipement', id, part] as const,
  readings: ['biens', 'readings'] as const,
  inventaires: ['biens', 'inventaires'] as const,
  documents: (owner: Owner) => ['biens', 'documents', owner.kind, owner.id] as const,
};

export interface BiensQuery<T> extends ClientQuery<T> {
  refetch: () => void;
}

function useBiensQuery<T>(key: readonly unknown[], schema: ZodType<T>, load: () => Promise<unknown>): BiensQuery<T> {
  const query = useQuery({ queryKey: key, retry: false, queryFn: async () => schema.parse(await load()) });
  const state = useAfterHydration(query);
  return {
    ...state,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useLots(): BiensQuery<LotsData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lots, lotsSchema, () => source.lots());
}

export function useLot(id: string): BiensQuery<LotDetail | null> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lot(id), lotDetailSchema, () => source.lot(id));
}

export function useLotOccupation(id: string): BiensQuery<OccupationData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lotPart('occupation', id), occupationSchema, () => source.lotOccupation(id));
}

export function useLotLease(id: string): BiensQuery<LeaseData | null> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lotPart('lease', id), leaseSchema, () => source.lotLease(id));
}

export function useLotDiagnostics(id: string): BiensQuery<DiagnosticsData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lotPart('diagnostics', id), diagnosticsSchema, () => source.lotDiagnostics(id));
}

export function useLotSuivi(id: string): BiensQuery<LotSuivi> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lotPart('suivi', id), lotSuiviSchema, () => source.lotSuivi(id));
}

export function useLotFinances(id: string): BiensQuery<LotFinances> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.lotPart('finances', id), lotFinancesSchema, () => source.lotFinances(id));
}

export function useImmeubles(): BiensQuery<ImmeublesData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.immeubles, immeublesSchema, () => source.immeubles());
}

export function useImmeuble(id: string): BiensQuery<ImmeubleDetail | null> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.immeuble(id), immeubleDetailSchema, () => source.immeuble(id));
}

export function useImmeubleCharges(id: string): BiensQuery<ChargesData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.immeublePart('charges', id), chargesSchema, () => source.immeubleCharges(id));
}

export function useImmeubleCopro(id: string): BiensQuery<CoproData | null> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.immeublePart('copro', id), coproSchema.nullable(), () => source.immeubleCopro(id));
}

export function useImmeubleInterventions(id: string): BiensQuery<ImmeubleIntervData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.immeublePart('interventions', id), immeubleIntervSchema, () =>
    source.immeubleInterventions(id),
  );
}

export function useEquipements(): BiensQuery<EquipementsData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.equipements, equipementsSchema, () => source.equipements());
}

export function useEquipement(id: string): BiensQuery<EquipementDetail | null> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.equipement(id), equipementDetailSchema, () => source.equipement(id));
}

export function useEquipementInterventions(id: string): BiensQuery<EquipementIntervData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.equipementPart('interventions', id), equipementIntervSchema, () =>
    source.equipementInterventions(id),
  );
}

export function useReadings(): BiensQuery<ReadingsData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.readings, readingsSchema, () => source.readings());
}

export function useInventaires(): BiensQuery<InventairesData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.inventaires, inventairesSchema, () => source.inventaires());
}

export function useDocuments(owner: Owner): BiensQuery<DocumentsData> {
  const source = useBiensSource();
  return useBiensQuery(biensKeys.documents(owner), documentsSchema, () => source.documents(owner));
}

export function useBiensAction<Args, Result>(run: (source: BiensSource, args: Args) => Promise<Result>) {
  const source = useBiensSource();
  const client = useQueryClient();
  const refresh = () => Promise.all(OCCUPANCY_ROOTS.map((queryKey) => client.invalidateQueries({ queryKey })));
  return useMutation({
    mutationFn: (args: Args) => run(source, args),
    onSuccess: refresh,
    onError: (error) => (isStaleVersion(error) ? refresh() : undefined),
  });
}
