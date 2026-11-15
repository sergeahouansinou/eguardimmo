import { demoLeaseTerms } from '../locataires/demo';
import { euros } from '../locataires/kit/money';
import type { Attestation, Edl, EdlTemplate, Installment, Lease, LeaseExit, LeaseExtras, Reservation } from './schemas';

export const DEMO_ANCHOR_MONTH = '2026-11';

export const demoLeaseOrder = ['apt-a1', 'studio-b3', 'apt-a3', 'apt-b2', 'studio-c2', 'apt-b1', 'studio-2e', 'villa-rdc', 'apt-a2'] as const;

const monthsBetween = (start: string, end: string): number => {
  const [sy = 0, sm = 0] = start.split('-').map(Number);
  const [ey = 0, em = 0] = end.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
};

function activeLease(unitId: string, reference: string, overrides: Partial<Lease> = {}): Lease {
  const terms = demoLeaseTerms[unitId];
  if (!terms) throw new Error(`Conditions de démo manquantes : ${unitId}`);
  return {
    id: unitId,
    reference,
    unitId,
    tenantIds: [terms.tenantId],
    furnished: terms.furnished,
    durationMonths: monthsBetween(terms.start, terms.end),
    legalNote: terms.furnished ? 'Location meublée, loi de 1989' : 'Location vide, loi de 1989',
    start: terms.start,
    end: terms.end,
    rent: terms.rent,
    charges: terms.charges,
    deposit: terms.deposit,
    depositReceivedOn: terms.start,
    dueDay: 1,
    paymentMethod: 'virement',
    revisionIndex: 'IRL',
    nextRevision: `2027-${terms.start.slice(5, 7)}-01`,
    revisionNote: 'Indice IRL, à la date anniversaire',
    rentControl: 'Paris, loyer conforme',
    guarantor: null,
    tacitNote: terms.furnished ? 'Reconduction tacite, 1 an' : 'Reconduction tacite, 3 ans',
    status: 'en_cours',
    balance: 0,
    note: '',
    archived: false,
    ...overrides,
  };
}

export const demoLeases: readonly Lease[] = [
  activeLease('apt-a1', 'BL-2023-0007', { balance: -euros(850), nextRevision: '2027-04-01', revisionNote: 'Indice IRL du 4e trimestre', tacitNote: 'Reconduction tacite, 6 ans' }),
  activeLease('studio-2e', 'BL-2025-0002', { status: 'preavis', balance: -euros(60) }),
  activeLease('villa-rdc', 'BL-2024-0009'),
  activeLease('apt-a2', 'BL-2024-0011'),
  activeLease('apt-b1', 'BL-2025-0014', { balance: -euros(210) }),
  activeLease('studio-b3', 'BL-2024-0013', { status: 'preavis', note: 'Préavis reçu, départ le 31/01/2027.' }),
  activeLease('apt-a3', 'BL-2024-0003'),
  activeLease('apt-b2', 'BL-2025-0005'),
  activeLease('studio-c2', 'BL-2025-0008'),
  {
    ...activeLease('apt-a2', 'BL-2026-0017'),
    id: 'apt-b3',
    unitId: 'apt-b3',
    tenantIds: ['mariam-sy'],
    furnished: false,
    durationMonths: 12,
    start: '2026-12-01',
    end: '2027-11-30',
    rent: euros(780),
    charges: euros(70),
    deposit: euros(780),
    depositReceivedOn: null,
    nextRevision: '2027-12-01',
    status: 'a_venir',
  },
  {
    ...activeLease('apt-a3', 'BL-2026-0018'),
    id: 'apt-a3-2',
    start: '2027-02-01',
    end: '2030-01-31',
    durationMonths: 36,
    status: 'brouillon',
    depositReceivedOn: null,
    note: 'Renouvellement à finaliser.',
  },
  {
    ...activeLease('apt-a1', 'BL-2020-0003'),
    id: 'apt-a1-2020',
    tenantIds: ['sarah-mensah'],
    start: '2020-01-15',
    end: '2023-03-15',
    durationMonths: 38,
    rent: euros(640),
    charges: euros(50),
    deposit: euros(690),
    status: 'termine',
    nextRevision: null,
  },
  {
    ...activeLease('apt-b1', 'BL-2021-0006'),
    id: 'apt-b1-2021',
    tenantIds: ['paul-houngbo'],
    start: '2021-03-01',
    end: '2025-08-31',
    durationMonths: 54,
    status: 'termine',
    nextRevision: null,
  },
];

export const demoLeaseIds: readonly string[] = demoLeases.map((lease) => lease.id);

const ACTIVE = new Set(['en_cours', 'preavis']);
const MONTH_RECEIPT_BASE: Record<string, number> = { '2026-07': 318, '2026-08': 344, '2026-09': 371 };
const OCTOBER_RECEIPTS: Record<string, number> = {
  'apt-a1': 398, 'studio-b3': 405, 'apt-a3': 406, 'apt-b2': 407, 'studio-c2': 408, 'apt-b1': 409, 'studio-2e': 410, 'villa-rdc': 411, 'apt-a2': 412,
};

export function receiptNumberFor(leaseId: string, month: string): string | null {
  const index = demoLeaseOrder.indexOf(leaseId as (typeof demoLeaseOrder)[number]);
  if (index < 0) return null;
  if (month === '2026-10') return `QT-2026-${String(OCTOBER_RECEIPTS[leaseId] ?? 0).padStart(4, '0')}`;
  const base = MONTH_RECEIPT_BASE[month];
  return base === undefined ? null : `QT-2026-${String(base + index).padStart(4, '0')}`;
}

export const RECEIPT_MONTHS = ['2026-07', '2026-08', '2026-09', '2026-10'] as const;

function nextMonth(month: string): string {
  const [year = 0, mon = 0] = month.split('-').map(Number);
  return mon === 12 ? `${String(year + 1)}-01` : `${String(year)}-${String(mon + 1).padStart(2, '0')}`;
}

export function buildInstallments(lease: Lease): Installment[] {
  if (lease.status === 'brouillon' || lease.status === 'a_venir') return [];
  const called = lease.rent + lease.charges;
  const last = lease.status === 'termine' ? lease.end.slice(0, 7) : '2026-10';
  const rows: Installment[] = [];
  for (let month = lease.start.slice(0, 7); month <= last; month = nextMonth(month)) {
    rows.push({
      id: `${lease.id}-${month}`,
      leaseId: lease.id,
      month,
      due: `${month}-01`,
      called,
      received: called,
      paidOn: `${month}-03`,
      state: 'paye',
      lateSettled: month.endsWith('-02') && month < '2026-01',
      receiptNumber: receiptNumberFor(lease.id, month),
    });
  }
  if (lease.status === 'termine') return rows;
  const received = lease.balance < 0 ? called + lease.balance : called;
  rows.push({
    id: `${lease.id}-2026-11`,
    leaseId: lease.id,
    month: '2026-11',
    due: '2026-11-01',
    called,
    received,
    paidOn: received >= called ? '2026-11-03' : null,
    state: received >= called ? 'paye' : received === 0 ? 'impaye' : 'partiel',
    lateSettled: false,
    receiptNumber: null,
  });
  if (ACTIVE.has(lease.status) && lease.end >= '2026-12-01') {
    const arrears = lease.balance < 0 ? -lease.balance : 0;
    rows.push({ id: `${lease.id}-2026-12`, leaseId: lease.id, month: '2026-12', due: '2026-12-01', called: called + arrears, received: 0, paidOn: null, state: 'a_emettre', lateSettled: false, receiptNumber: null });
  }
  return rows;
}

export function buildExtras(lease: Lease): LeaseExtras {
  if (lease.id === 'apt-a1') {
    return {
      leaseId: lease.id,
      documents: [
        { id: 'bail-signe', title: 'Bail signé', detail: 'PDF · signé électroniquement le 24/03/2023', tone: 'neutral', badge: { label: 'Partagé', tone: 'info' } },
        { id: 'edl-entree', title: 'État des lieux d’entrée', detail: 'PDF · 01/04/2023 · 42 photos', tone: 'neutral', badge: { label: 'Partagé', tone: 'info' } },
        { id: 'assurance', title: 'Attestation d’assurance', detail: 'Valable jusqu’au 31/03/2027', tone: 'warning', badge: { label: 'À renouveler', tone: 'warning' } },
      ],
      history: [
        { id: 'relance', title: 'Relance envoyée par e-mail', detail: '08/11/2026 · Équipe', tone: 'neutral', date: '2026-11-08' },
        { id: 'revision', title: 'Révision du loyer appliquée', detail: '01/04/2026 · 762 € → 770 €, IRL +1,05 %', tone: 'neutral', date: '2026-04-01' },
        { id: 'regularisation', title: 'Régularisation des charges 2025', detail: '12/03/2026 · 22 € remboursés', tone: 'neutral', date: '2026-03-12' },
      ],
      actions: [
        { id: 'relancer', title: 'Relancer l’impayé de novembre', detail: 'Deuxième relance à envoyer', tone: 'danger', badge: { label: 'Urgent', tone: 'danger' } },
        { id: 'avis-decembre', title: 'Émettre l’avis de décembre', detail: 'Avant le 25/11/2026', tone: 'neutral', badge: { label: 'Dans 12 j', tone: 'neutral' } },
        { id: 'regul-2026', title: 'Régulariser les charges 2026', detail: 'Avant le 15/03/2027 · +16 € à rembourser', tone: 'neutral', badge: { label: 'Mars', tone: 'neutral' } },
      ],
    };
  }
  return {
    leaseId: lease.id,
    documents: [
      { id: 'bail', title: lease.status === 'brouillon' ? 'Projet de bail' : 'Bail signé', detail: `PDF · début le ${lease.start.split('-').reverse().join('/')}`, tone: 'neutral', badge: { label: lease.status === 'brouillon' ? 'Brouillon' : 'Partagé', tone: 'info' } },
    ],
    history: [{ id: 'creation', title: 'Bail créé', detail: lease.start.split('-').reverse().join('/'), tone: 'neutral', date: lease.start }],
    actions: lease.balance < 0
      ? [{ id: 'relancer', title: 'Relancer l’impayé de novembre', detail: 'Relance à envoyer', tone: 'danger', badge: { label: 'Urgent', tone: 'danger' } }]
      : [],
  };
}

export const demoExits: Readonly<Record<string, LeaseExit>> = {
  'studio-b3': {
    leaseId: 'studio-b3',
    noticeReceivedOn: '2026-11-09',
    noticeKind: 'lettre recommandée',
    noticeDuration: '1 mois, meublé',
    departure: '2027-01-31',
    lastInstallment: '2027-01',
    reason: 'Mutation professionnelle',
    steps: [
      { id: 'preavis', title: 'Préavis reçu', detail: '09/11/2026, lettre recommandée', status: 'fait' },
      { id: 'pre-visite', title: 'Visite de pré-sortie', detail: 'Proposée le 12/01/2027', status: 'a_planifier' },
      { id: 'edl-sortie', title: 'État des lieux de sortie', detail: '31/01/2027, contradictoire', status: 'prevu' },
      { id: 'chiffrage', title: 'Chiffrage des réparations', detail: 'Comparé à l’état des lieux d’entrée', status: 'a_faire' },
      { id: 'decompte', title: 'Décompte du dépôt', detail: 'Dans le mois si l’état des lieux est conforme', status: 'a_faire' },
      { id: 'restitution', title: 'Restitution et attestation', detail: 'Attestation générée automatiquement', status: 'a_faire' },
      { id: 'cloture', title: 'Clôture du bail', detail: 'Archivage et fin des échéances', status: 'a_faire' },
    ],
    repairs: [
      { id: 'murs-salon', element: 'Murs du salon', entryState: 'Bon état', preVisit: 'Taches', imputation: 'degradation', estimate: euros(90) },
      { id: 'plaque-cuisson', element: 'Plaque de cuisson', entryState: 'Neuf', preVisit: 'Usure normale', imputation: 'proprietaire', estimate: 0 },
      { id: 'joint-douche', element: 'Joint de douche', entryState: 'Bon état', preVisit: 'Noirci', imputation: 'degradation', estimate: euros(32) },
    ],
    unpaid: 0,
    chargesRegularisation: 0,
    depositReturned: false,
    attestationId: null,
  },
  'studio-2e': {
    leaseId: 'studio-2e',
    noticeReceivedOn: '2026-10-30',
    noticeKind: 'lettre recommandée',
    noticeDuration: '1 mois, meublé',
    departure: '2026-12-31',
    lastInstallment: '2026-12',
    reason: 'Retour à l’étranger',
    steps: [
      { id: 'preavis', title: 'Préavis reçu', detail: '30/10/2026, lettre recommandée', status: 'fait' },
      { id: 'pre-visite', title: 'Visite de pré-sortie', detail: 'À proposer au locataire', status: 'a_planifier' },
      { id: 'edl-sortie', title: 'État des lieux de sortie', detail: '31/12/2026, contradictoire', status: 'prevu' },
      { id: 'chiffrage', title: 'Chiffrage des réparations', detail: 'Comparé à l’état des lieux d’entrée', status: 'a_faire' },
      { id: 'decompte', title: 'Décompte du dépôt', detail: 'Dans le mois si l’état des lieux est conforme', status: 'a_faire' },
      { id: 'restitution', title: 'Restitution et attestation', detail: 'Attestation générée automatiquement', status: 'a_faire' },
      { id: 'cloture', title: 'Clôture du bail', detail: 'Archivage et fin des échéances', status: 'a_faire' },
    ],
    repairs: [],
    unpaid: euros(60),
    chargesRegularisation: 0,
    depositReturned: false,
    attestationId: null,
  },
};

export const demoEdlTemplates: readonly EdlTemplate[] = [
  { id: 'appartement-standard', label: 'Appartement, standard' },
  { id: 'maison-avec-jardin', label: 'Maison, avec jardin' },
  { id: 'studio-meuble', label: 'Studio meublé' },
];

const allRooms = ['Entrée', 'Séjour', 'Cuisine', 'Chambre 1', 'Salle de bains'];

export const demoEdls: readonly Edl[] = [
  { id: 'edl-2026-004', reference: 'EDL-2026-004', type: 'entree', unitId: 'apt-a1', tenantId: 'koffi-adjovi', date: '2026-04-01', createdOn: '2026-04-01', templateId: 'appartement-standard', status: 'signe', rooms: allRooms, archived: false },
  { id: 'edl-2026-005', reference: 'EDL-2026-005', type: 'sortie', unitId: 'studio-2e', tenantId: 'ibrahim-yao', date: null, createdOn: null, templateId: 'appartement-standard', status: 'a_planifier', rooms: allRooms, archived: false },
  { id: 'edl-2026-006', reference: 'EDL-2026-006', type: 'intermediaire', unitId: 'villa-rdc', tenantId: 'marc-dossou', date: '2026-10-05', createdOn: '2026-10-05', templateId: 'maison-avec-jardin', status: 'brouillon', rooms: allRooms, archived: false },
  { id: 'edl-2025-011', reference: 'EDL-2025-011', type: 'entree', unitId: 'apt-b1', tenantId: 'clarisse-hounkpatin', date: '2025-09-01', createdOn: '2025-09-01', templateId: 'appartement-standard', status: 'signe', rooms: allRooms, archived: false },
  { id: 'edl-2026-007', reference: 'EDL-2026-007', type: 'sortie', unitId: 'studio-b3', tenantId: 'yann-le-gall', date: '2027-01-31', createdOn: '2026-11-09', templateId: 'studio-meuble', status: 'prevu', rooms: ['Séjour', 'Cuisine', 'Salle de bains'], archived: false },
  { id: 'edl-2023-001', reference: 'EDL-2023-001', type: 'sortie', unitId: 'apt-a1', tenantId: 'sarah-mensah', date: '2023-03-15', createdOn: '2023-03-15', templateId: 'appartement-standard', status: 'signe', rooms: allRooms, archived: true },
];

export const demoReservations: readonly Reservation[] = [
  { id: 'rs-2026-031', reference: 'RS-2026-031', unitId: 'studio-plage', guest: 'Anna Kowalski', arrival: '2026-11-18', departure: '2026-11-25', amount: euros(630), deposit: euros(300), paid: euros(189), status: 'acompte_recu', optionUntil: null },
  { id: 'rs-2026-032', reference: 'RS-2026-032', unitId: 'gite-du-lac', guest: 'Famille Mensah', arrival: '2026-12-20', departure: '2027-01-03', amount: euros(2380), deposit: euros(600), paid: euros(714), status: 'solde_a_percevoir', optionUntil: null },
  { id: 'rs-2026-033', reference: 'RS-2026-033', unitId: 'gite-du-lac', guest: 'Julien Morel', arrival: '2027-01-10', departure: '2027-01-14', amount: euros(720), deposit: euros(600), paid: 0, status: 'option', optionUntil: '2026-11-16' },
  { id: 'rs-2026-029', reference: 'RS-2026-029', unitId: 'studio-plage', guest: 'Léo Fabre', arrival: '2026-11-10', departure: '2026-11-16', amount: euros(540), deposit: euros(300), paid: euros(540), status: 'confirmee', optionUntil: null },
  { id: 'rs-2026-024', reference: 'RS-2026-024', unitId: 'gite-du-lac', guest: 'Sophie Aubry', arrival: '2026-10-02', departure: '2026-10-09', amount: euros(1190), deposit: euros(600), paid: euros(1190), status: 'confirmee', optionUntil: null },
  { id: 'rs-2026-021', reference: 'RS-2026-021', unitId: 'studio-plage', guest: 'Mehdi Benali', arrival: '2026-09-12', departure: '2026-09-19', amount: euros(630), deposit: euros(300), paid: euros(630), status: 'confirmee', optionUntil: null },
  { id: 'rs-2026-018', reference: 'RS-2026-018', unitId: 'gite-du-lac', guest: 'Famille Roux', arrival: '2026-08-01', departure: '2026-08-15', amount: euros(2520), deposit: euros(600), paid: euros(2520), status: 'confirmee', optionUntil: null },
  { id: 'rs-2026-025', reference: 'RS-2026-025', unitId: 'studio-plage', guest: 'Clara Weiss', arrival: '2026-10-20', departure: '2026-10-24', amount: euros(360), deposit: euros(300), paid: 0, status: 'annulee', optionUntil: null },
];

export const demoAttestations: readonly Attestation[] = [
  {
    id: 'at-2023-0018',
    number: 'AT-2023-0018',
    leaseId: 'apt-a1-2020',
    leaseReference: 'BL-2020-0003',
    tenantName: 'Sarah Mensah',
    tenantCivility: 'Mme',
    unitId: 'apt-a1',
    leaseStart: '2020-01-15',
    leaseEnd: '2023-03-15',
    exitDate: '2023-03-15',
    issuedOn: '2023-04-12',
    issuedAt: '2023-04-12T11:20:00+02:00',
    deposit: euros(690),
    depositReceivedOn: '2020-01-15',
    deductions: [
      { id: 'peinture-salon', label: 'Peinture du salon, dégradation hors usure normale', reference: 'EDL sortie · D-2023-014', amount: euros(90) },
      { id: 'regul-2022', label: 'Solde de la régularisation des charges 2022', reference: 'RG-2022-0007', amount: euros(24) },
    ],
    unpaid: 0,
    returned: euros(576),
    fingerprint: '9e51…7b30',
    paymentMethod: 'virement',
  },
];

export const demoEdlIds: readonly string[] = demoEdls.map((edl) => edl.id);
export const demoReservationIds: readonly string[] = demoReservations.map((reservation) => reservation.id);
export const demoAttestationIds: readonly string[] = demoAttestations.map((attestation) => attestation.id);
