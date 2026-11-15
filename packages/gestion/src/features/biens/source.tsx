'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { Owner } from './schemas/common';
import type { EquipementValues } from './schemas/equipements';
import type { ImmeubleValues } from './schemas/immeubles';
import type { Listing, LotImportRow, LotValues } from './schemas/lots';
import type { InventaireInput, ReadingInput } from './schemas/releves';

export { BiensError } from './errors';

export interface DocumentInput {
  name: string;
  category: string;
  shared: boolean;
  sizeBytes: number;
}

export interface DiagnosticInput {
  label: string;
  doneOn: string;
  validity: string;
  result: string;
}

export interface LogEntryInput {
  title: string;
  date: string;
  detail: string;
  cost: number | null;
}

export interface OperationInput {
  label: string;
  doneBy: string;
  periodicityMonths: number;
  lastOn: string | null;
}

export interface BiensSource {
  lots: () => Promise<unknown>;
  lot: (id: string) => Promise<unknown>;
  lotOccupation: (id: string) => Promise<unknown>;
  lotLease: (id: string) => Promise<unknown>;
  lotDiagnostics: (id: string) => Promise<unknown>;
  lotSuivi: (id: string) => Promise<unknown>;
  lotFinances: (id: string) => Promise<unknown>;
  immeubles: () => Promise<unknown>;
  immeuble: (id: string) => Promise<unknown>;
  immeubleCharges: (id: string) => Promise<unknown>;
  immeubleCopro: (id: string) => Promise<unknown>;
  immeubleInterventions: (id: string) => Promise<unknown>;
  equipements: () => Promise<unknown>;
  equipement: (id: string) => Promise<unknown>;
  equipementInterventions: (id: string) => Promise<unknown>;
  readings: () => Promise<unknown>;
  inventaires: () => Promise<unknown>;
  documents: (owner: Owner) => Promise<unknown>;

  createLot: (values: LotValues) => Promise<{ id: string }>;
  updateLot: (id: string, values: LotValues) => Promise<void>;
  setLotsArchived: (ids: string[], archived: boolean) => Promise<void>;
  deleteLot: (id: string) => Promise<void>;
  duplicateLot: (id: string) => Promise<{ id: string }>;
  setLotListing: (id: string, listing: Listing) => Promise<void>;
  importLots: (rows: LotImportRow[]) => Promise<{ created: number }>;
  addDiagnostic: (lotId: string, input: DiagnosticInput) => Promise<void>;
  orderDiagnostics: (lotId: string, ids: string[]) => Promise<void>;

  createImmeuble: (values: ImmeubleValues) => Promise<{ id: string }>;
  updateImmeuble: (id: string, values: ImmeubleValues) => Promise<void>;
  setImmeubleArchived: (id: string, archived: boolean) => Promise<void>;
  deleteImmeuble: (id: string) => Promise<void>;

  createEquipement: (values: EquipementValues) => Promise<{ id: string }>;
  updateEquipement: (id: string, values: EquipementValues) => Promise<void>;
  setEquipementArchived: (id: string, archived: boolean) => Promise<void>;
  deleteEquipement: (id: string) => Promise<void>;
  addLogEntry: (equipementId: string, input: LogEntryInput) => Promise<void>;
  addOperation: (equipementId: string, input: OperationInput) => Promise<void>;

  addDocument: (owner: Owner, input: DocumentInput) => Promise<void>;
  setDocumentShared: (id: string, shared: boolean) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  createReading: (input: ReadingInput) => Promise<void>;
  updateReading: (id: string, input: ReadingInput) => Promise<void>;
  attachReadingPhoto: (id: string) => Promise<void>;
  setReadingArchived: (id: string, archived: boolean) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;

  createInventaire: (input: InventaireInput) => Promise<{ id: string }>;
  updateInventaire: (id: string, input: InventaireInput) => Promise<void>;
  requestInventaireSignature: (id: string) => Promise<void>;
  duplicateInventaire: (id: string) => Promise<{ id: string }>;
  setInventaireArchived: (id: string, archived: boolean) => Promise<void>;
  deleteInventaire: (id: string) => Promise<void>;
}

const SourceContext = createContext<BiensSource | null>(null);

export function BiensSourceProvider({ source, children }: { source: BiensSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

export function useBiensSource(): BiensSource {
  const source = use(SourceContext);
  if (!source) throw new Error('BiensProviders manquant autour des écrans de biens.');
  return source;
}
