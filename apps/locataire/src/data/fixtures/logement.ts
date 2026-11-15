import type { Attestation, DemoDocument, Inspection, Lease } from '../schemas/logement';

export const leaseFixture: Lease = {
  id: 'BL-2023-0007',
  status: 'en_cours',
  usage: 'Location vide, résidence principale',
  regime: 'Location vide, loi de 1989',
  duration: '6 ans, bailleur personne morale',
  startOn: '2023-04-01',
  endOn: '2029-03-31',
  signedOn: '2023-03-24',
  noticeLabel: '1 mois',
  noticeMonths: 1,
  noticeZoneLabel: '1 mois, zone tendue',
  rentCents: 77000,
  provisionsCents: 8000,
  depositCents: 77000,
  depositPaidOn: '2023-04-01',
  dueLabel: 'Le 1er du mois, à échoir',
  revision: { nextOn: '2027-04-01', note: 'Indice IRL, +1,05 % en 2026', rentLabel: '762 € → 770 €' },
  renewal: 'Reconduction tacite, 6 ans',
  landlord: { name: 'Gestion Les Tilleuls', address: '12 rue des Lilas, 75011 Paris' },
  tenantName: 'Koffi Adjovi',
  tenantInitials: 'KA',
  property: {
    unit: 'Apt A1',
    label: 'Apt A1, Les Tilleuls',
    street: '12 rue des Lilas',
    postalCode: '75011',
    city: 'Paris',
    type: 'T3',
    surface: '64,2 m²',
    floor: '2e étage',
    floorShort: '2e sur 5, ascenseur',
  },
  documentIds: ['bail-signe', 'etat-des-lieux-d-entree', 'avis-de-revision-du-loyer'],
  notice: null,
};

export const documentsFixture: DemoDocument[] = [
  { id: 'bail-signe', name: 'Bail signé', category: 'Contrat', group: 'contrat', issuedOn: '2023-03-24', sizeBytes: 1_200_000, detail: 'PDF · signé le 24/03/2023', homeDetail: 'PDF · signé électroniquement le 24/03/2023', href: null },
  { id: 'diagnostic-de-performance-energetique', name: 'Diagnostic de performance énergétique', category: 'Contrat', group: 'contrat', issuedOn: '2023-03-24', sizeBytes: 800_000, detail: 'PDF · 24/03/2023', homeDetail: null, href: null },
  { id: 'etat-des-lieux-d-entree', name: "État des lieux d'entrée", category: 'État des lieux', group: 'autres', issuedOn: '2023-04-01', sizeBytes: 3_800_000, detail: 'PDF · 01/04/2023', homeDetail: 'PDF · 01/04/2023 · 42 photos', href: '/etats-des-lieux/entree-2023-04-01' },
  { id: 'avis-de-revision-du-loyer', name: 'Avis de révision du loyer', category: 'Courrier', group: 'autres', issuedOn: '2026-04-01', sizeBytes: 100_000, detail: 'PDF · 01/04/2026, 762 € → 770 €', homeDetail: null, href: null },
  { id: 'attestation-d-assurance', name: "Attestation d'assurance", category: 'Assurance', group: 'autres', issuedOn: '2026-03-28', sizeBytes: 200_000, detail: 'PDF · 28/03/2026', homeDetail: null, href: '/assurance' },
  { id: 'decompte-de-charges-2025', name: 'Décompte de charges 2025', category: 'Charges', group: 'autres', issuedOn: '2026-03-12', sizeBytes: 200_000, detail: 'PDF · 12/03/2026', homeDetail: null, href: '/loyers/regularisation' },
  { id: 'quittance-d-octobre-2026', name: "Quittance d'octobre 2026", category: 'Quittance', group: 'quittances', issuedOn: '2026-10-03', sizeBytes: 100_000, detail: 'PDF · 03/10/2026', homeDetail: null, href: '/loyers/quittances/QT-2026-0398' },
];

export const inspectionsFixture: Inspection[] = [
  {
    id: 'entree-2023-04-01',
    kind: 'entree',
    status: 'signe',
    date: '2023-04-01',
    address: 'Apt A1, 12 rue des Lilas, 75011 Paris',
    caption: 'Apt A1, 12 rue des Lilas',
    photosCount: 42,
    surfaceLabel: 'T3, 64,2 m²',
    reservesNote: 'Séjour et chambre 1',
    rooms: [
      { name: 'Entrée', condition: 'bon_etat', notes: "Peinture propre, interphone en état de marche", photos: 2, reserve: false },
      { name: 'Séjour', condition: 'etat_usage', notes: 'Trace légère sur le parquet, devant la fenêtre', photos: 8, reserve: true },
      { name: 'Cuisine', condition: 'bon_etat', notes: 'Plaque, hotte et évier en état de marche', photos: 9, reserve: false },
      { name: 'Chambre 1', condition: 'etat_usage', notes: 'Rayure sur la porte du placard', photos: 7, reserve: true },
      { name: 'Chambre 2', condition: 'bon_etat', notes: 'Rien à signaler', photos: 6, reserve: false },
      { name: 'Salle de bains et WC', condition: 'bon_etat', notes: 'Joint de baignoire légèrement noirci', photos: 10, reserve: false },
    ],
    signatures: [
      { name: 'Koffi Adjovi', role: 'Locataire', signedAt: '2023-04-01T14:12:00' },
      { name: 'Gestion Les Tilleuls', role: 'Bailleur', signedAt: '2023-04-01T14:15:00' },
    ],
    meters: [
      { label: 'Électricité', value: '12 480 kWh' },
      { label: 'Eau froide', value: '214 m³' },
      { label: 'Gaz', value: '1 930 m³' },
    ],
  },
  {
    id: 'sortie',
    kind: 'sortie',
    status: 'a_planifier',
    date: null,
    address: 'Apt A1, 12 rue des Lilas, 75011 Paris',
    caption: 'À réaliser à votre départ',
    photosCount: 0,
    surfaceLabel: 'T3, 64,2 m²',
    reservesNote: '',
    rooms: [],
    signatures: [],
    meters: [],
  },
];

export const attestationsFixture: Attestation[] = [
  { id: 'attestation-2026-2027', label: 'Attestation 2026-2027', insurer: 'Mutuelle Horizon', contractNumber: 'HAB-2026-48213', startOn: '2026-04-01', endOn: '2027-03-31', guarantees: 'Risques locatifs inclus', depositedOn: '2026-03-28', fileName: 'attestation-habitation-2026.pdf' },
  { id: 'attestation-2025-2026', label: 'Attestation 2025-2026', insurer: 'Mutuelle Horizon', contractNumber: 'HAB-2025-48213', startOn: '2025-04-01', endOn: '2026-03-31', guarantees: 'Risques locatifs inclus', depositedOn: '2025-03-29', fileName: 'attestation-habitation-2025.pdf' },
  { id: 'attestation-2024-2025', label: 'Attestation 2024-2025', insurer: 'Mutuelle Horizon', contractNumber: 'HAB-2024-48213', startOn: '2024-04-01', endOn: '2025-03-31', guarantees: 'Risques locatifs inclus', depositedOn: '2024-03-30', fileName: 'attestation-habitation-2024.pdf' },
];
