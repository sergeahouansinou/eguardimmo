import type { Inventaire, Meter, MeterKind, Reading, Reason } from '../schemas/releves';

const euros = (value: number) => value * 100;

type MeterSeed = Omit<Meter, 'details'> & { details: Meter['details'] };

export const unitPrice: Record<MeterKind, number> = { electricite: 25.16, eau_froide: 415, eau_chaude: 960, gaz: 11 };
export const kindUnit: Record<MeterKind, 'kWh' | 'm³'> = { electricite: 'kWh', eau_froide: 'm³', eau_chaude: 'm³', gaz: 'kWh' };

export const meterSeeds: MeterSeed[] = [
  {
    id: 'apt-a1-electricite', lotId: 'apt-a1', kind: 'electricite', ref: 'PDL 1452 0098 7731', unit: 'kWh',
    details: [
      { label: 'Type', value: 'Linky, télérelève' },
      { label: 'Point de livraison', value: '•••• •••• 7731' },
      { label: 'Emplacement', value: 'Palier, gaine technique' },
      { label: 'Contrat', value: 'Au nom du locataire' },
    ],
    series: [560, 710, 620, 540, 430, 330, 280, 300, 330, 380, 450, 440].map((value, index) => ({
      month: index === 0 ? '2025-12' : `2026-${String(index).padStart(2, '0')}`,
      value,
    })),
  },
  {
    id: 'apt-a1-eau-froide', lotId: 'apt-a1', kind: 'eau_froide', ref: 'n° 08-41-221', unit: 'm³',
    details: [
      { label: 'Type', value: 'Divisionnaire' },
      { label: 'Numéro', value: '08-41-221' },
      { label: 'Emplacement', value: 'Placard de la cuisine' },
      { label: 'Facturation', value: 'Charges, régularisation' },
    ],
    series: [4.1, 4.5, 4, 4.3, 4, 3.9, 3.7, 4.4, 4.6, 4.5, 4.4, 4.4].map((value, index) => ({
      month: index === 0 ? '2025-12' : `2026-${String(index).padStart(2, '0')}`,
      value,
    })),
  },
  {
    id: 'studio-2e-eau-chaude', lotId: 'studio-2e', kind: 'eau_chaude', ref: 'n° 12-07-554', unit: 'm³',
    details: [{ label: 'Type', value: 'Divisionnaire' }, { label: 'Emplacement', value: 'Salle d’eau' }],
    series: [],
  },
  {
    id: 'villa-rdc-gaz', lotId: 'villa-rdc', kind: 'gaz', ref: 'PCE 1907 2245 8810', unit: 'kWh',
    details: [{ label: 'Type', value: 'Gazpar, télérelève' }, { label: 'Emplacement', value: 'Extérieur, coffret de façade' }],
    series: [],
  },
  {
    id: 'apt-d4-electricite', lotId: 'apt-d4', kind: 'electricite', ref: 'PDL 1452 0098 6102', unit: 'kWh',
    details: [{ label: 'Type', value: 'Linky, télérelève' }, { label: 'Emplacement', value: 'Gaine technique' }],
    series: [],
  },
  {
    id: 'apt-a2-electricite', lotId: 'apt-a2', kind: 'electricite', ref: 'PDL 1452 0098 7740', unit: 'kWh',
    details: [{ label: 'Type', value: 'Linky, télérelève' }, { label: 'Emplacement', value: 'Gaine technique' }],
    series: [],
  },
];

const lotNames: Record<string, string> = {
  'apt-a1': 'Apt A1',
  'apt-a2': 'Apt A2',
  'studio-2e': 'Studio 2e',
  'villa-rdc': 'Villa RDC',
  'apt-d4': 'Apt D4',
};

const meterById = new Map(meterSeeds.map((meter) => [meter.id, meter]));

function reading(
  meterId: string,
  date: string,
  index: number,
  delta: number | null,
  reason: Reason,
  origin: string,
  enteredBy: string,
  tenant: string | null,
  hasPhoto = false,
): Reading {
  const meter = meterById.get(meterId);
  if (!meter) throw new Error(`Compteur inconnu : ${meterId}`);
  return {
    id: `${meterId}-${date}`,
    meterId,
    lotId: meter.lotId,
    lotName: lotNames[meter.lotId] ?? meter.lotId,
    kind: meter.kind,
    meterRef: meter.ref,
    unit: kindUnit[meter.kind],
    tenant,
    reason,
    date,
    index,
    delta,
    cost: delta === null ? null : Math.round(delta * unitPrice[meter.kind]),
    origin,
    enteredBy,
    hasPhoto,
    archived: false,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function quarterDates(): string[] {
  const dates: string[] = [];
  for (let year = 2023; year <= 2026; year += 1) {
    for (const month of ['01', '04', '07', '10']) {
      const date = `${String(year)}-${month}-01`;
      if (date > '2023-04-01' && date <= '2026-07-01') dates.push(date);
    }
  }
  return dates;
}

function chain(meterId: string, first: number, deltas: number[], tenant: string, enteredBy: string, decimals: boolean): Reading[] {
  const dates = quarterDates();
  let index = first;
  const items: Reading[] = [];
  deltas.forEach((delta, position) => {
    index = decimals ? round1(index + delta) : index + delta;
    const date = dates[position];
    if (date) items.push(reading(meterId, date, index, delta, 'en_cours_de_bail', 'Relevé du locataire', enteredBy, tenant));
  });
  return items;
}

const electricityDeltas = [430, 380, 520, 450, 450, 390, 430, 500, 500, 420, 380, 480, 436];

export function seedReadings(): Reading[] {
  const electricity = chain('apt-a1-electricite', 2114, electricityDeltas, 'Koffi Adjovi', 'Koffi Adjovi', false);
  const water = chain('apt-a1-eau-froide', 1062.8, [12.8, 13.1, 13.5, 12.6, 13.2, 12.9, 13.4, 13, 12.7, 13.3, 13.1, 13, 12.4], 'Koffi Adjovi', 'Koffi Adjovi', true);
  const lastElectricity = electricity.at(-1)?.index ?? 0;
  const lastWater = water.at(-1)?.index ?? 0;
  return [
    reading('apt-a1-electricite', '2023-04-01', 2114, null, 'entree', 'État des lieux d’entrée', 'Marc Chevalier', 'Koffi Adjovi'),
    reading('apt-a1-eau-froide', '2023-04-01', 1062.8, null, 'entree', 'État des lieux d’entrée', 'Marc Chevalier', 'Koffi Adjovi'),
    ...electricity,
    ...water,
    reading('apt-a1-electricite', '2026-09-01', lastElectricity + 580, 580, 'en_cours_de_bail', 'Télérelève Linky', 'Automatique', 'Koffi Adjovi'),
    reading('apt-a1-eau-froide', '2026-09-01', round1(lastWater + 6.9), 6.9, 'en_cours_de_bail', 'Relevé du gardien', 'Syndic', 'Koffi Adjovi'),
    reading('apt-a1-electricite', '2026-11-01', lastElectricity + 580 + 1070, 1070, 'en_cours_de_bail', 'Relevé du locataire, photo', 'Koffi Adjovi', 'Koffi Adjovi', true),
    reading('apt-a1-eau-froide', '2026-11-01', round1(lastWater + 6.9 + 9.3), 9.3, 'en_cours_de_bail', 'Relevé du locataire, photo', 'Koffi Adjovi', 'Koffi Adjovi', true),
    reading('studio-2e-eau-chaude', '2026-10-31', 412, 3, 'en_cours_de_bail', 'Relevé du locataire', 'Ibrahim Yao', 'Ibrahim Yao'),
    reading('villa-rdc-gaz', '2026-10-28', 18204, 640, 'en_cours_de_bail', 'Relevé du locataire', 'Marc Dossou', 'Marc Dossou'),
    reading('apt-d4-electricite', '2026-10-15', 4102, null, 'sortie', 'État des lieux de sortie', 'Marc Chevalier', null),
    reading('apt-a2-electricite', '2026-11-02', 6240, 410, 'en_cours_de_bail', 'Télérelève Linky', 'Automatique', 'Nadège Sossou'),
  ];
}

export const inventaireTemplates = ['Meublé, standard', 'Meublé, studio', 'Meublé, bureau', 'Meublé, maison', 'Vide, standard'];

export function seedInventaires(): Inventaire[] {
  const base = (
    id: string,
    ref: string,
    lotId: string,
    lotName: string,
    immeubleName: string,
    tenant: string | null,
    value: number,
    createdOn: string,
    template: string,
    archived = false,
  ): Inventaire => ({ id, ref, lotId, lotName, immeubleName, tenant, value, createdOn, template, signatureSentOn: null, archived });
  return [
    base('inv-2026-0006', 'INV-2026-0006', 'studio-b3', 'Studio B3', 'Les Tilleuls', 'Yann Le Gall', euros(4820), '2026-11-10', 'Meublé, standard'),
    base('inv-2026-0005', 'INV-2026-0005', 'apt-c2', 'Apt C2', 'Résidence du Parc', null, euros(2350), '2026-10-27', 'Meublé, studio'),
    base('inv-2026-0004', 'INV-2026-0004', 'apt-a1', 'Apt A1', 'Les Tilleuls', 'Koffi Adjovi', euros(1180), '2026-09-14', 'Vide, standard'),
    base('inv-2026-0003', 'INV-2026-0003', 'bureau-b1', 'Bureau B1', 'Les Tilleuls', null, euros(640), '2026-08-02', 'Meublé, bureau'),
    base('inv-2026-0002', 'INV-2026-0002', 'apt-a2', 'Apt A2', 'Les Tilleuls', 'Nadège Sossou', euros(1450), '2026-06-20', 'Vide, standard'),
    base('inv-2026-0001', 'INV-2026-0001', 'villa-rdc', 'Villa RDC', 'Maison Rivière', 'Marc Dossou', euros(3960), '2026-03-05', 'Meublé, maison'),
    base('inv-2025-0012', 'INV-2025-0012', 'apt-a2', 'Apt A2', 'Les Tilleuls', 'Nadège Sossou', euros(1390), '2025-07-02', 'Vide, standard', true),
    base('inv-2025-0011', 'INV-2025-0011', 'studio-b3', 'Studio B3', 'Les Tilleuls', 'Lucas Moreau', euros(4650), '2024-10-28', 'Meublé, standard', true),
  ];
}
