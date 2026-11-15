import { BiensError } from '../errors';
import type { BiensSource } from '../source';
import * as equipementsWrites from './mutations-equipements';
import * as immeublesWrites from './mutations-immeubles';
import * as lotsWrites from './mutations-lots';
import * as recordsWrites from './mutations-records';
import {
  buildDocuments,
  buildEquipementDetail,
  buildEquipementInterventions,
  buildEquipements,
  buildInventaires,
  buildReadings,
} from './read-equipements';
import {
  buildCharges,
  buildCopro,
  buildImmeubleDetail,
  buildImmeubleInterventions,
  buildImmeubles,
} from './read-immeubles';
import {
  buildDiagnostics,
  buildFinances,
  buildLease,
  buildLotDetail,
  buildLots,
  buildOccupation,
  buildSuivi,
} from './read-lots';
import { inventaireTemplates } from './seed-readings';
import { createDemoState } from './state';
import type { DemoState } from './state';

export interface DemoBiensOptions {
  latencyMs?: number;
  state?: DemoState;
}

const DEFAULT_LATENCY_MS = 150;

export function createDemoBiensSource(options: DemoBiensOptions = {}): BiensSource {
  const state = options.state ?? createDemoState();
  const latency = options.latencyMs ?? DEFAULT_LATENCY_MS;

  const settle = async <T,>(run: () => T): Promise<T> => {
    if (latency > 0) await new Promise<void>((resolve) => setTimeout(resolve, latency));
    return run();
  };

  const write = async <A extends unknown[]>(run: (target: DemoState, ...args: A) => void, ...args: A): Promise<void> => {
    if (latency > 0) await new Promise<void>((resolve) => setTimeout(resolve, latency));
    run(state, ...args);
  };

  const requireLot = (id: string) => {
    if (!state.lots.some((lot) => lot.row.id === id)) throw new BiensError('Bien introuvable.');
  };
  const requireImmeuble = (id: string) => {
    if (!state.immeubles.some((item) => item.row.id === id)) throw new BiensError('Immeuble introuvable.');
  };
  const requireEquipement = (id: string) => {
    if (!state.equipements.some((item) => item.row.id === id)) throw new BiensError('Équipement introuvable.');
  };

  return {
    lots: () => settle(() => buildLots(state)),
    lot: (id) => settle(() => buildLotDetail(state, id)),
    lotOccupation: (id) => settle(() => {
      requireLot(id);
      return buildOccupation(state, id);
    }),
    lotLease: (id) => settle(() => {
      requireLot(id);
      return buildLease(state, id);
    }),
    lotDiagnostics: (id) => settle(() => {
      requireLot(id);
      return buildDiagnostics(state, id);
    }),
    lotSuivi: (id) => settle(() => {
      requireLot(id);
      return buildSuivi(state, id);
    }),
    lotFinances: (id) => settle(() => {
      requireLot(id);
      return buildFinances(state, id);
    }),
    immeubles: () => settle(() => buildImmeubles(state)),
    immeuble: (id) => settle(() => buildImmeubleDetail(state, id)),
    immeubleCharges: (id) => settle(() => {
      requireImmeuble(id);
      return buildCharges(state, id);
    }),
    immeubleCopro: (id) => settle(() => {
      requireImmeuble(id);
      return buildCopro(state, id);
    }),
    immeubleInterventions: (id) => settle(() => {
      requireImmeuble(id);
      return buildImmeubleInterventions(state, id);
    }),
    equipements: () => settle(() => buildEquipements(state)),
    equipement: (id) => settle(() => buildEquipementDetail(state, id)),
    equipementInterventions: (id) => settle(() => {
      requireEquipement(id);
      return buildEquipementInterventions(state, id);
    }),
    readings: () => settle(() => buildReadings(state)),
    inventaires: () => settle(() => buildInventaires(state, inventaireTemplates)),
    documents: (owner) => settle(() => buildDocuments(state, owner)),

    createLot: (values) => settle(() => lotsWrites.createLot(state, values)),
    updateLot: (id, values) => write(lotsWrites.updateLot, id, values),
    setLotsArchived: (ids, archived) => write(lotsWrites.setLotsArchived, ids, archived),
    deleteLot: (id) => write(lotsWrites.deleteLot, id),
    duplicateLot: (id) => settle(() => lotsWrites.duplicateLot(state, id)),
    setLotListing: (id, listing) => write(lotsWrites.setLotListing, id, listing),
    importLots: (rows) => settle(() => lotsWrites.importLots(state, rows)),
    addDiagnostic: (lotId, input) => write(lotsWrites.addDiagnostic, lotId, input),
    orderDiagnostics: (lotId, ids) => write(lotsWrites.orderDiagnostics, lotId, ids),

    createImmeuble: (values) => settle(() => immeublesWrites.createImmeuble(state, values)),
    updateImmeuble: (id, values) => write(immeublesWrites.updateImmeuble, id, values),
    setImmeubleArchived: (id, archived) => write(immeublesWrites.setImmeubleArchived, id, archived),
    deleteImmeuble: (id) => write(immeublesWrites.deleteImmeuble, id),

    createEquipement: (values) => settle(() => equipementsWrites.createEquipement(state, values)),
    updateEquipement: (id, values) => write(equipementsWrites.updateEquipement, id, values),
    setEquipementArchived: (id, archived) => write(equipementsWrites.setEquipementArchived, id, archived),
    deleteEquipement: (id) => write(equipementsWrites.deleteEquipement, id),
    addLogEntry: (id, input) => write(equipementsWrites.addLogEntry, id, input),
    addOperation: (id, input) => write(equipementsWrites.addOperation, id, input),

    addDocument: (owner, input) => write(recordsWrites.addDocument, owner, input),
    setDocumentShared: (id, shared) => write(recordsWrites.setDocumentShared, id, shared),
    deleteDocument: (id) => write(recordsWrites.deleteDocument, id),

    createReading: (input) => write(recordsWrites.createReading, input),
    updateReading: (id, input) => write(recordsWrites.updateReading, id, input),
    attachReadingPhoto: (id) => write(recordsWrites.attachReadingPhoto, id),
    setReadingArchived: (id, archived) => write(recordsWrites.setReadingArchived, id, archived),
    deleteReading: (id) => write(recordsWrites.deleteReading, id),

    createInventaire: (input) => settle(() => recordsWrites.createInventaire(state, input)),
    updateInventaire: (id, input) => write(recordsWrites.updateInventaire, id, input),
    requestInventaireSignature: (id) => write(recordsWrites.requestInventaireSignature, id),
    duplicateInventaire: (id) => settle(() => recordsWrites.duplicateInventaire(state, id)),
    setInventaireArchived: (id, archived) => write(recordsWrites.setInventaireArchived, id, archived),
    deleteInventaire: (id) => write(recordsWrites.deleteInventaire, id),
  };
}
