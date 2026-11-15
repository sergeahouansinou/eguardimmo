import { DEMO_NOW, DEMO_TODAY, euros } from '../kit';
import type { HistoryEntry, LoyerLot, LoyersData, Overview, Schedule } from './schemas';

const MONTHS_2026 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((month) => `2026-${month}`);

function lot(
  id: string,
  name: string,
  building: [string, string],
  tenant: [string, string],
  rent: number,
  startMonth: string,
  amountOf: (month: string, rent: number) => number,
): LoyerLot {
  const cents = euros(rent);
  return {
    id,
    name,
    buildingId: building[0],
    buildingName: building[1],
    tenantId: tenant[0],
    tenantName: tenant[1],
    rent: cents,
    startMonth,
    payments: MONTHS_2026.filter((month) => month >= startMonth).map((month) => ({ month, amount: amountOf(month, cents) })),
  };
}

const LOTS: LoyerLot[] = [
  lot('apt-a1', 'Apt A1', ['les-tilleuls', 'Les Tilleuls'], ['koffi-adjovi', 'Koffi Adjovi'], 850, '2026-01', (month, rent) => (month === '2026-11' ? 0 : rent)),
  lot('apt-a2', 'Apt A2', ['les-tilleuls', 'Les Tilleuls'], ['nadege-sossou', 'Nadège Sossou'], 990, '2026-01', (_month, rent) => rent),
  lot('apt-b1', 'Apt B1', ['les-tilleuls', 'Les Tilleuls'], ['clarisse-hounkpatin', 'Clarisse Hounkpatin'], 1020, '2026-01', (month, rent) => (month === '2026-11' ? rent - euros(210) : rent)),
  lot('studio-2e', 'Studio 2e', ['residence-du-parc', 'Résidence du Parc'], ['ibrahim-yao', 'Ibrahim Yao'], 780, '2026-01', (month, rent) => (month === '2026-11' ? rent - euros(60) : rent)),
  lot('villa-rdc', 'Villa RDC', ['maison-riviere', 'Maison Rivière'], ['marc-dossou', 'Marc Dossou'], 2050, '2026-06', (month, rent) => (month === '2026-11' ? rent + euros(50) : rent)),
];

export const DEMO_AGENCY = {
  name: 'Gestion Les Tilleuls',
  initials: 'GT',
  address: '12 rue des Lilas, 75011 Paris',
  email: 'gestion@les-tilleuls.example',
};

const HISTORY: HistoryEntry[] = [
  { id: 'h-1', slug: 'loyers-encaisses', label: 'Loyers encaissés', period: '01/01/2026 au 31/12/2026', scope: 'Tous les biens', generatedAt: DEMO_NOW, format: 'PDF' },
  { id: 'h-2', slug: 'export-comptable', label: 'Export comptable', period: 'Octobre 2026', scope: 'Tous les biens', generatedAt: '2026-11-05T16:40:00+01:00', format: 'CSV' },
  { id: 'h-3', slug: 'loyers-impayes', label: 'Loyers impayés', period: 'Novembre 2026', scope: 'Les Tilleuls', generatedAt: '2026-11-02T08:15:00+01:00', format: 'Excel' },
];

const SCHEDULES: Schedule[] = [
  { id: 's-1', slug: 'loyers-impayes', label: 'Loyers impayés', recipient: 'gestion@les-tilleuls.example', frequency: 'weekly', nextRun: '2026-11-16' },
  { id: 's-2', slug: 'export-comptable', label: 'Export comptable', recipient: 'compta@cabinet-durand.example', frequency: 'monthly', nextRun: '2026-12-01' },
];

export function createDemoOverview(): Overview {
  return { favorites: ['loyers-encaisses'], history: structuredClone(HISTORY), schedules: structuredClone(SCHEDULES) };
}

export function createDemoLoyers(): LoyersData {
  return { generatedAt: DEMO_NOW, today: DEMO_TODAY, lots: structuredClone(LOTS) };
}
