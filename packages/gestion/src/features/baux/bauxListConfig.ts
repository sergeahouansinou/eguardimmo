import { isRunningLease } from './leaseRules';
import type { Lease } from './schemas';
import type { ListTab } from '../locataires/kit/useListView';

export const tabs: ListTab<Lease>[] = [
  { id: 'actifs', label: 'Actifs', match: isRunningLease },
  { id: 'a_venir', label: 'À venir', match: (lease) => !lease.archived && lease.status === 'a_venir' },
  { id: 'termines', label: 'Terminés', match: (lease) => !lease.archived && lease.status === 'termine' },
  { id: 'brouillons', label: 'Brouillons', match: (lease) => !lease.archived && lease.status === 'brouillon' },
  { id: 'archives', label: 'Archivés', match: (lease) => lease.archived },
];

export const SORTS = [
  { value: 'fin', label: 'Tri : fin la plus proche' },
  { value: 'loyer', label: 'Tri : loyer décroissant' },
  { value: 'debut', label: 'Tri : début le plus récent' },
  { value: 'bien', label: 'Tri : bien (A à Z)' },
];
export const WINDOWS = [30, 60, 90] as const;
export const ALL = 'tous';
export const TYPES = [
  { value: ALL, label: 'Type : Tous' },
  { value: 'vide', label: 'Vide' },
  { value: 'meuble', label: 'Meublé' },
];
export const BALANCES = [
  { value: ALL, label: 'Solde : Tous' },
  { value: 'impayes', label: 'Impayés' },
  { value: 'a_jour', label: 'À jour' },
];
export const SOON_DAYS = 60;
