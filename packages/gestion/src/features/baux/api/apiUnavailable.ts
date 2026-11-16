import type { BauxSource } from '../source';
import { unsupported } from './apiErrors';

type UnconnectedMethod =
  | 'installments'
  | 'extras'
  | 'importLeases'
  | 'setExitStep'
  | 'markReturned'
  | 'edlTemplates'
  | 'edls'
  | 'createEdl'
  | 'updateEdl'
  | 'setEdlStatus'
  | 'setEdlArchived'
  | 'deleteEdl'
  | 'saveEdlSurvey'
  | 'prepareExitEdl'
  | 'reservations'
  | 'confirmReservation'
  | 'cancelReservation'
  | 'duplicateReservation'
  | 'createReservation'
  | 'updateReservation'
  | 'importReservations'
  | 'sendReservationConfirmation'
  | 'remindReservation'
  | 'attestations';

const noRoute = (what: string) => (): Promise<never> => Promise.reject(unsupported(`${what} : cette fonction n’est pas encore reliée au serveur.`));

export const unconnectedOperations: Pick<BauxSource, UnconnectedMethod> = {
  installments: noRoute('Échéancier'),
  extras: noRoute('Documents, historique et actions du bail'),
  importLeases: noRoute('Import de baux'),
  setExitStep: noRoute('Suivi de sortie'),
  markReturned: noRoute('Restitution du dépôt de garantie'),
  edlTemplates: noRoute('Modèles d’état des lieux'),
  edls: noRoute('États des lieux'),
  createEdl: noRoute('États des lieux'),
  updateEdl: noRoute('États des lieux'),
  setEdlStatus: noRoute('États des lieux'),
  setEdlArchived: noRoute('États des lieux'),
  deleteEdl: noRoute('États des lieux'),
  saveEdlSurvey: noRoute('États des lieux'),
  prepareExitEdl: noRoute('État des lieux de sortie'),
  reservations: noRoute('Réservations'),
  confirmReservation: noRoute('Réservations'),
  cancelReservation: noRoute('Réservations'),
  duplicateReservation: noRoute('Réservations'),
  createReservation: noRoute('Réservations'),
  updateReservation: noRoute('Réservations'),
  importReservations: noRoute('Réservations'),
  sendReservationConfirmation: noRoute('Réservations'),
  remindReservation: noRoute('Réservations'),
  attestations: noRoute('Attestations de restitution'),
};
