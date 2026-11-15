import { euros } from '../kit/demoClock';
import { monthRange } from './months';
import type { OccupancyStatus } from './constants';
import { PREVIOUS_START, WINDOW_END, WINDOW_START } from './constants';
import type { Arrears, Building, LeaseEnd, Lot, OccupancyCell } from './schemas';

export const BUILDINGS: Building[] = [
  { id: 'les-tilleuls', name: 'Les Tilleuls' },
  { id: 'maison-riviere', name: 'Maison Rivière' },
  { id: 'residence-du-parc', name: 'Résidence du Parc' },
];

interface LotSeed {
  id: string;
  name: string;
  buildingId: string;
  type: Lot['type'];
  rent: number;
  charges: number;
  cost: number;
  loan: number;
  candidates: number;
  previous: { rent: number; charges: number; cost: number };
  current: string;
  before: string;
}

const FULL = 'OOOOOOOOOOOO';

const SEEDS: LotSeed[] = [
  { id: 'apt-a1', name: 'Apt A1', buildingId: 'les-tilleuls', type: 'appartement', rent: 770, charges: 2480, cost: 152000, loan: 560, candidates: 0, previous: { rent: 679, charges: 1950, cost: 145000 }, current: FULL, before: FULL },
  { id: 'apt-a2', name: 'Apt A2', buildingId: 'les-tilleuls', type: 'appartement', rent: 880, charges: 2610, cost: 171000, loan: 600, candidates: 0, previous: { rent: 776, charges: 2060, cost: 163000 }, current: FULL, before: FULL },
  { id: 'apt-b1', name: 'Apt B1', buildingId: 'les-tilleuls', type: 'appartement', rent: 720, charges: 2230, cost: 139000, loan: 480, candidates: 0, previous: { rent: 635, charges: 1760, cost: 133000 }, current: FULL, before: FULL },
  { id: 'studio-b3', name: 'Studio B3', buildingId: 'les-tilleuls', type: 'appartement', rent: 390, charges: 1040, cost: 68000, loan: 0, candidates: 0, previous: { rent: 344, charges: 820, cost: 65000 }, current: 'OOOOOOOOOOPP', before: FULL },
  { id: 'parking-p4', name: 'Parking P4', buildingId: 'les-tilleuls', type: 'stationnement', rent: 60, charges: 120, cost: 11000, loan: 0, candidates: 0, previous: { rent: 53, charges: 90, cost: 11000 }, current: FULL, before: FULL },
  { id: 'studio-2e', name: 'Studio 2e', buildingId: 'residence-du-parc', type: 'studio', rent: 640, charges: 2940, cost: 118000, loan: 280, candidates: 0, previous: { rent: 564, charges: 2310, cost: 113000 }, current: FULL, before: FULL },
  { id: 'studio-1er', name: 'Studio 1er', buildingId: 'residence-du-parc', type: 'studio', rent: 610, charges: 1870, cost: 112000, loan: 0, candidates: 3, previous: { rent: 538, charges: 1470, cost: 107000 }, current: 'VTTOOOOOOPVV', before: FULL },
  { id: 'cave-c2', name: 'Cave C2', buildingId: 'residence-du-parc', type: 'cave', rent: 35, charges: 40, cost: 5000, loan: 0, candidates: 0, previous: { rent: 31, charges: 31, cost: 5000 }, current: FULL, before: 'OVVVOOOOOOOO' },
  { id: 'villa-rdc', name: 'Villa RDC', buildingId: 'maison-riviere', type: 'maison', rent: 1040, charges: 3120, cost: 176000, loan: 700, candidates: 0, previous: { rent: 917, charges: 2460, cost: 168000 }, current: FULL, before: FULL },
  { id: 'villa-etage', name: 'Villa étage', buildingId: 'maison-riviere', type: 'maison', rent: 820, charges: 2380, cost: 149000, loan: 560, candidates: 0, previous: { rent: 723, charges: 1870, cost: 142000 }, current: FULL, before: FULL },
  { id: 'garage-g1', name: 'Garage G1', buildingId: 'maison-riviere', type: 'stationnement', rent: 75, charges: 90, cost: 12000, loan: 0, candidates: 0, previous: { rent: 66, charges: 71, cost: 11000 }, current: FULL, before: FULL },
];

export const CURRENT_MONTHS = monthRange(WINDOW_START, WINDOW_END);
export const PREVIOUS_MONTHS = monthRange(PREVIOUS_START, '2025-11');

export const LOTS: Lot[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  buildingId: seed.buildingId,
  type: seed.type,
  monthlyRent: euros(seed.rent),
  annualCharges: euros(seed.charges),
  costPrice: euros(seed.cost),
  annualLoanInterest: euros(seed.loan),
  candidates: seed.candidates,
  previous: {
    monthlyRent: euros(seed.previous.rent),
    annualCharges: euros(seed.previous.charges),
    costPrice: euros(seed.previous.cost),
  },
}));

function cells(grid: string, months: readonly string[], lotId: string): OccupancyCell[] {
  return months.map((month, index) => ({ lotId, month, status: (grid[index] ?? 'O') as OccupancyStatus }));
}

export const OCCUPANCY: OccupancyCell[] = SEEDS.flatMap((seed) => [
  ...cells(seed.before, PREVIOUS_MONTHS, seed.id),
  ...cells(seed.current, CURRENT_MONTHS, seed.id),
]);

export const ARREARS: Arrears[] = [
  { lotId: 'apt-a1', tenant: 'Koffi Adjovi', amount: euros(850), dueSince: '2026-11-01' },
  { lotId: 'apt-b1', tenant: 'Clarisse Hounkpatin', amount: euros(210), dueSince: '2026-11-01' },
  { lotId: 'studio-2e', tenant: 'Ibrahim Yao', amount: euros(60), dueSince: '2026-11-01' },
];

export const PREVIOUS_SHORTFALL = { lotId: 'apt-a1', month: '2025-06', amount: euros(1090) };

export const LEASE_ENDS: LeaseEnd[] = [
  { lotId: 'studio-2e', date: '2026-12-31', kind: 'preavis' },
  { lotId: 'studio-b3', date: '2027-01-31', kind: 'preavis' },
  { lotId: 'apt-b1', date: '2027-08-31', kind: 'reconduction' },
  { lotId: 'villa-etage', date: '2027-06-14', kind: 'reconduction' },
];
