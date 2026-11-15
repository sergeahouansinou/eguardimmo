import type { Badge } from '../schemas/common';
import type { LotRichDetail, LotExtras } from './records';
import type { Period } from '../schemas/lots';

const euros = (value: number) => value * 100;

const ok = (label: string, value: string, extra: { secret?: boolean; badge?: Badge } = {}) => ({ label, value, ...extra });

export const aptA1Rich: LotRichDetail = {
  subtitle: '12 rue des Lilas, 75011 Paris · Bâtiment A, 2e étage, porte 21 · Lot de copropriété n° 12',
  badges: [
    { label: 'Loué', tone: 'success' },
    { label: '1 loyer impayé', tone: 'danger' },
  ],
  photoLabels: ['Séjour', 'Cuisine', 'Chambre 1', 'Salle d’eau', 'Balcon'],
  photoCount: 12,
  brief: {
    habitableArea: 64.2,
    carrezArea: 66.4,
    rooms: 'T3, 2 chambres',
    floor: '2e sur 5, ascenseur',
    builtYear: 1972,
    rental: 'Vide, loi de 1989',
    dpe: { energy: 'C', ghg: 'B' },
    rentCc: euros(850),
  },
  caracteristiques: [
    {
      id: 'identification',
      title: 'Identification',
      editable: true,
      subSections: [],
      rows: [
        ok('Type', 'Appartement T3'),
        ok('Usage', 'Habitation principale'),
        ok('Immeuble', 'Les Tilleuls'),
        ok('Bâtiment, escalier', 'A, escalier 2'),
        ok('Étage, porte', '2e sur 5, porte 21'),
        ok('Lot de copropriété', 'n° 12, 128 / 1 000'),
        ok('Construction', '1972'),
        ok('Régime juridique', 'Copropriété'),
      ],
    },
    {
      id: 'surfaces',
      title: 'Surfaces et pièces',
      editable: true,
      subSections: [],
      rows: [
        ok('Surface habitable', '64,2 m² (loi Boutin)'),
        ok('Surface Carrez', '66,4 m²'),
        ok('Pièces principales', '3'),
        ok('Chambres', '2'),
        ok('Salle d’eau', '1, avec douche'),
        ok('WC', '1, séparé'),
        ok('Hauteur sous plafond', '2,50 m'),
        ok('Exposition', 'Sud-ouest, traversant'),
      ],
    },
    {
      id: 'annexes',
      title: 'Annexes privatives',
      editable: true,
      rows: [
        ok('Balcon', '4,5 m², exposé sud'),
        ok('Cave', 'n° 7, sous-sol'),
        ok('Stationnement', 'Place n° 14, sous-sol'),
        ok('Jardin', 'Non'),
      ],
      subSections: [
        {
          title: 'Accès',
          rows: [ok('Digicode', '4C27B', { secret: true }), ok('Clés', '3 jeux, 1 badge Vigik'), ok('Interphone', 'Oui, vidéophone')],
        },
      ],
    },
    {
      id: 'energie',
      title: 'Énergie et chauffage',
      editable: false,
      subSections: [],
      rows: [
        ok('Chauffage', 'Individuel, électrique'),
        ok('Eau chaude', 'Ballon électrique 150 L'),
        ok('Vitrage', 'Double vitrage PVC'),
        ok('Ventilation', 'VMC simple flux'),
        ok('Coût annuel estimé', '830 à 1 160 €'),
      ],
    },
    {
      id: 'cadre-location',
      title: 'Cadre de location',
      editable: true,
      subSections: [],
      rows: [
        ok('Location', 'Vide, loi de 1989'),
        ok('Zone', 'Tendue, loyers encadrés'),
        ok('Loyer plafond', '1 740 € hors charges'),
        ok('Loyer actuel', '770 €', { badge: { label: 'Conforme', tone: 'success' } }),
        ok('Permis de louer', 'Non requis'),
        ok('Animaux', 'Autorisés'),
        ok('Fumeurs', 'Non'),
      ],
    },
    {
      id: 'cadastre',
      title: 'Cadastre et fiscalité',
      editable: true,
      subSections: [],
      rows: [
        ok('Cadastre', 'Section AB, n° 0123'),
        ok('Acquisition', '15/06/2016'),
        ok('Prix d’achat', '152 000 €'),
        ok('Frais d’achat', '11 400 €'),
        ok('Régime fiscal', 'Foncier, régime réel'),
        ok('Taxe foncière', '940 € en 2026'),
        ok('Valeur locative', '3 120 €'),
      ],
    },
  ],
  amenityGroups: [
    {
      title: 'Logement',
      items: [
        'Cuisine équipée',
        'Plaque induction',
        'Hotte',
        'Climatisation réversible',
        'Volets roulants',
        'Double vitrage',
        'Détecteur de fumée',
        'Fibre optique',
        'Placards intégrés',
      ],
    },
    {
      title: 'Immeuble',
      items: ['Ascenseur', 'Digicode', 'Vidéophone', 'Local à vélos', 'Local poubelles', 'Antenne collective', 'Cour arborée'],
    },
  ],
};

export const lotB3Rich: Partial<LotRichDetail> = {
  subtitle: '12 rue des Lilas, 75011 Paris · Bâtiment B, 5e étage · Studio meublé, 28 m²',
  badges: [
    { label: 'Loué', tone: 'success' },
    { label: 'Préavis, départ le 31/01/2027', tone: 'warning' },
  ],
  photoLabels: ['Pièce principale', 'Coin cuisine', 'Salle d’eau'],
  photoCount: 6,
  brief: {
    habitableArea: 28,
    carrezArea: 29.1,
    rooms: 'Studio, 1 pièce',
    floor: '5e sur 5, ascenseur',
    builtYear: 1972,
    rental: 'Meublé, loi de 1989',
    dpe: { energy: 'D', ghg: 'C' },
    rentCc: euros(450),
  },
};

function period(
  id: string,
  kind: Period['kind'],
  startDate: string,
  endDate: string | null,
  extra: Partial<Period> = {},
): Period {
  return {
    id,
    kind,
    startDate,
    endDate,
    occupant: null,
    leaseType: null,
    note: null,
    status: null,
    noticeEndsOn: null,
    entryRent: null,
    lastRent: null,
    deposit: null,
    exitNote: null,
    ...extra,
  };
}

const tenant = (id: string, name: string) => ({ id, name });

const aptA1Periods: Period[] = [
  period('vacance-2016', 'vacance', '2016-06-15', '2016-08-31', { note: 'Travaux après achat' }),
  period('bail-julien-petit', 'bail', '2016-09-01', '2019-12-31', {
    occupant: tenant('julien-petit', 'Julien Petit'), leaseType: 'Vide, 3 ans', status: 'termine',
    entryRent: euros(690), lastRent: euros(712), deposit: euros(690), exitNote: '2 retenues, 140 €',
  }),
  period('vacance-2020', 'vacance', '2020-01-01', '2020-01-14', { note: 'Relocation' }),
  period('bail-sarah-mensah', 'bail', '2020-01-15', '2023-03-15', {
    occupant: tenant('sarah-mensah', 'Sarah Mensah'), leaseType: 'Vide, 3 ans', status: 'termine',
    entryRent: euros(720), lastRent: euros(731), deposit: euros(720), exitNote: 'Conforme, aucune retenue',
  }),
  period('vacance-2023', 'vacance', '2023-03-16', '2023-03-31', { note: 'Peinture du séjour' }),
  period('bail-koffi-adjovi', 'bail', '2023-04-01', null, {
    occupant: tenant('koffi-adjovi', 'Koffi Adjovi'), leaseType: 'Vide, 6 ans', status: 'en_cours',
    entryRent: euros(745), lastRent: euros(770), deposit: euros(745),
  }),
];

const lotB3Periods: Period[] = [
  period('v-2016', 'vacance', '2016-06-01', '2016-08-31', { note: 'Achat et remise en état' }),
  period('b-lea-martin', 'bail', '2016-09-01', '2017-06-30', { occupant: tenant('lea-martin', 'Léa Martin'), leaseType: 'Meublé étudiant', status: 'termine', entryRent: euros(360), lastRent: euros(360), deposit: euros(720) }),
  period('v-2017', 'vacance', '2017-07-01', '2017-08-31', { note: 'Été' }),
  period('b-thomas-girard', 'bail', '2017-09-01', '2018-08-31', { occupant: tenant('thomas-girard', 'Thomas Girard'), leaseType: 'Meublé, 1 an', status: 'termine', entryRent: euros(365), lastRent: euros(365), deposit: euros(730) }),
  period('b-ines-bakari', 'bail', '2018-09-01', '2019-06-30', { occupant: tenant('ines-bakari', 'Inès Bakari'), leaseType: 'Meublé étudiant', status: 'termine', entryRent: euros(370), lastRent: euros(370), deposit: euros(740) }),
  period('v-2019', 'vacance', '2019-07-01', '2019-09-30', { note: 'Été et relocation' }),
  period('b-paul-renaud', 'bail', '2019-10-01', '2020-09-30', { occupant: tenant('paul-renaud', 'Paul Renaud'), leaseType: 'Meublé, 1 an', status: 'termine', entryRent: euros(380), lastRent: euros(380), deposit: euros(760) }),
  period('v-2020', 'vacance', '2020-10-01', '2020-12-31', { note: 'Relocation' }),
  period('b-chloe-petit', 'bail', '2021-01-01', '2021-12-31', { occupant: tenant('chloe-petit', 'Chloé Petit'), leaseType: 'Meublé, 1 an', status: 'termine', entryRent: euros(385), lastRent: euros(385), deposit: euros(770) }),
  period('b-mehdi-saidi', 'bail', '2022-01-01', '2022-08-31', { occupant: tenant('mehdi-saidi', 'Mehdi Saïdi'), leaseType: 'Bail mobilité', status: 'termine', entryRent: euros(390), lastRent: euros(390), deposit: 0 }),
  period('v-2022', 'vacance', '2022-09-01', '2022-09-30', { note: 'Relocation' }),
  period('b-aicha-kone', 'bail', '2022-10-01', '2023-09-30', { occupant: tenant('aicha-kone', 'Aïcha Koné'), leaseType: 'Meublé, 1 an', status: 'termine', entryRent: euros(395), lastRent: euros(395), deposit: euros(790) }),
  period('b-lucas-moreau', 'bail', '2023-10-01', '2024-09-30', { occupant: tenant('lucas-moreau', 'Lucas Moreau'), leaseType: 'Meublé, 1 an', status: 'termine', entryRent: euros(400), lastRent: euros(400), deposit: euros(800) }),
  period('v-2024', 'vacance', '2024-10-01', '2024-10-31', { note: 'Relocation' }),
  period('b-yann-le-gall', 'bail', '2024-11-01', null, { occupant: tenant('yann-le-gall', 'Yann Le Gall'), leaseType: 'Meublé, 1 an renouvelé', status: 'preavis', noticeEndsOn: '2027-01-31', entryRent: euros(410), lastRent: euros(410), deposit: euros(820) }),
];

const months: readonly (readonly [string, number, string | null])[] = [
  ['2025-12', 31500, null],
  ['2026-01', 18000, null],
  ['2026-02', 0, null],
  ['2026-03', 35000, null],
  ['2026-04', 0, null],
  ['2026-05', 9500, 'dont entretien du climatiseur 95 €'],
  ['2026-06', 0, null],
  ['2026-07', 22000, null],
  ['2026-08', 0, null],
  ['2026-09', 100000, 'dont taxe foncière 940 €'],
  ['2026-10', 0, null],
  ['2026-11', 32000, 'dont acompte plombier 320 €'],
];

const aptA1Operations = [
  ['op-1', '2026-11-12', 'Loyer de novembre', 'Loyer', null, { label: 'Impayé', tone: 'danger' }],
  ['op-2', '2026-11-03', 'Fuite sous évier, acompte plombier', 'Travaux', null, { label: 'À venir', tone: 'warning' }],
  ['op-3', '2026-10-01', 'Loyer d’octobre', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-4', '2026-09-15', 'Taxe foncière 2026', 'Impôt', -euros(940), { label: 'Payé', tone: 'neutral' }],
  ['op-5', '2026-09-01', 'Loyer de septembre', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-6', '2026-08-01', 'Loyer d’août', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-7', '2026-07-01', 'Loyer de juillet', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-8', '2026-06-01', 'Loyer de juin', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-9', '2026-05-20', 'Entretien annuel du climatiseur', 'Travaux', -euros(95), { label: 'Payé', tone: 'neutral' }],
  ['op-10', '2026-05-01', 'Loyer de mai', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-11', '2026-04-01', 'Loyer d’avril', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
  ['op-12', '2026-03-01', 'Loyer de mars', 'Loyer', euros(770), { label: 'Encaissé', tone: 'success' }],
] as const;

export const aptA1Extras: LotExtras = {
  occupation: {
    asOf: '2026-11-13',
    acquisitionDate: '2016-06-15',
    periods: aptA1Periods,
    rentSteps: [
      { year: 2017, rent: euros(690), event: null },
      { year: 2018, rent: euros(698), event: null },
      { year: 2019, rent: euros(712), event: 'Révision IRL' },
      { year: 2020, rent: euros(720), event: 'Relocation' },
      { year: 2021, rent: euros(722), event: null },
      { year: 2022, rent: euros(727), event: null },
      { year: 2023, rent: euros(731), event: null },
      { year: 2024, rent: euros(745), event: 'Relocation' },
      { year: 2025, rent: euros(756), event: 'Révision IRL' },
      { year: 2026, rent: euros(770), event: 'Révision IRL' },
    ],
    inspections: [
      { id: 'edl-entree-koffi', title: 'Entrée, Koffi Adjovi', date: '2023-04-01', detail: 'signé par les deux parties', signed: true, current: true },
      { id: 'edl-sortie-sarah', title: 'Sortie, Sarah Mensah', date: '2023-03-15', detail: 'conforme à l’entrée', signed: true, current: false },
      { id: 'edl-entree-sarah', title: 'Entrée, Sarah Mensah', date: '2020-01-15', detail: '42 photos', signed: true, current: false },
      { id: 'edl-sortie-julien', title: 'Sortie, Julien Petit', date: '2019-12-31', detail: '2 retenues, 140 €', signed: true, current: false },
      { id: 'edl-entree-julien', title: 'Entrée, Julien Petit', date: '2016-09-01', detail: '18 photos', signed: true, current: false },
    ],
  },
  lease: {
    tenant: tenant('koffi-adjovi', 'Koffi Adjovi'),
    leaseHref: '/baux',
    kind: 'Bail vide, résidence principale',
    startDate: '2023-04-01',
    endDate: '2029-03-31',
    rentExcl: euros(770),
    provisions: euros(80),
    deposit: euros(770),
    nextRevision: '2027-04-01',
    balance: -euros(850),
  },
  diagnostics: {
    asOf: '2026-11-13',
    dpe: {
      date: '2024-03-12',
      energy: { letter: 'C', value: 142, unit: 'kWh/m²/an' },
      ghg: { letter: 'B', value: 8, unit: 'kg CO₂/m²/an' },
    },
    items: [
      { id: 'dpe', label: 'Performance énergétique (DPE)', doneOn: '2024-03-12', validity: '10 ans', expiresOn: '2034-03-11', expiresNote: null, result: 'Classe C, GES B', ratings: { energy: 'C', ghg: 'B' }, status: 'valide', hasFile: true, orderedOn: null },
      { id: 'erp', label: 'État des risques (ERP)', doneOn: '2023-04-02', validity: '6 mois', expiresOn: null, expiresNote: 'Prochain bail', result: 'Zone sismique 1, radon 1', ratings: null, status: 'a_refaire', hasFile: true, orderedOn: null },
      { id: 'electricite', label: 'Installation électrique', doneOn: '2020-02-10', validity: '6 ans', expiresOn: '2026-02-10', expiresNote: null, result: '2 anomalies mineures', ratings: null, status: 'expire', hasFile: true, orderedOn: null },
      { id: 'amiante', label: 'Amiante (DAPP)', doneOn: '2016-05-28', validity: 'Illimitée', expiresOn: null, expiresNote: null, result: 'Absence d’amiante', ratings: null, status: 'valide', hasFile: true, orderedOn: null },
      { id: 'surface', label: 'Surface habitable', doneOn: '2016-05-28', validity: 'Illimitée', expiresOn: null, expiresNote: null, result: '64,2 m²', ratings: null, status: 'valide', hasFile: true, orderedOn: null },
      { id: 'gaz', label: 'Installation gaz', doneOn: null, validity: '6 ans', expiresOn: null, expiresNote: null, result: 'Pas d’installation', ratings: null, status: 'sans_objet', hasFile: false, orderedOn: null },
      { id: 'plomb', label: 'Plomb (CREP)', doneOn: null, validity: '6 ans', expiresOn: null, expiresNote: null, result: 'Construit après 1949', ratings: null, status: 'sans_objet', hasFile: false, orderedOn: null },
      { id: 'bruit', label: 'Bruit (aérodrome)', doneOn: null, validity: '—', expiresOn: null, expiresNote: null, result: 'Hors zone', ratings: null, status: 'sans_objet', hasFile: false, orderedOn: null },
    ],
  },
  finances: {
    purchasePrice: euros(152000),
    purchaseYear: 2016,
    fees: euros(11400),
    estimatedValue: euros(189000),
    estimatedYear: 2026,
    remainingCapital: euros(58900),
    loanPayment: '640 €, fin 06/2031',
    balanceDue: euros(850),
    balanceNote: 'Loyer et charges de novembre',
    months: months.map(([month, expenses, expenseNote]) => ({
      month,
      called: euros(770),
      collected: month === '2026-11' ? 0 : euros(770),
      expenses,
      expenseNote,
    })),
    operations: aptA1Operations.map(([id, date, label, category, amount, status]) => ({ id, date, label, category, amount, status })),
  },
  suivi: {
    interventions: [{ id: 'fuite-sous-evier', title: 'Fuite sous évier', detail: 'Plombier prévu le 16/11/2026', status: { label: 'En cours', tone: 'warning' } }],
  },
};

export const lotB3Extras: Partial<LotExtras> = {
  occupation: {
    asOf: '2026-11-13',
    acquisitionDate: '2016-06-01',
    periods: lotB3Periods,
    rentSteps: [],
    inspections: [],
  },
  lease: {
    tenant: tenant('yann-le-gall', 'Yann Le Gall'),
    leaseHref: '/baux',
    kind: 'Bail meublé, 1 an renouvelé',
    startDate: '2024-11-01',
    endDate: '2027-01-31',
    rentExcl: euros(410),
    provisions: euros(40),
    deposit: euros(820),
    nextRevision: null,
    balance: 0,
  },
};
