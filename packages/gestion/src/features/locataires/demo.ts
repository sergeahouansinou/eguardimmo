import type { Candidate, Tenant, TenantDetail, Unit } from './schemas';
import { euros } from './kit/money';

export const demoUnits: readonly Unit[] = [
  { id: 'apt-a1', label: 'Apt A1', building: 'Les Tilleuls', vacant: false },
  { id: 'apt-a2', label: 'Apt A2', building: 'Les Tilleuls', vacant: false },
  { id: 'apt-a3', label: 'Apt A3', building: 'Les Tilleuls', vacant: false },
  { id: 'apt-b1', label: 'Apt B1', building: 'Les Tilleuls', vacant: false },
  { id: 'apt-b2', label: 'Apt B2', building: 'Les Tilleuls', vacant: false },
  { id: 'apt-b3', label: 'Apt B3', building: 'Les Tilleuls', vacant: true },
  { id: 'studio-b3', label: 'Studio B3', building: 'Les Tilleuls', vacant: false },
  { id: 'studio-2e', label: 'Studio 2e', building: 'Résidence du Parc', vacant: false },
  { id: 'studio-c2', label: 'Studio C2', building: 'Résidence du Parc', vacant: false },
  { id: 'villa-rdc', label: 'Villa RDC', building: 'Maison Rivière', vacant: false },
  { id: 'studio-plage', label: 'Studio Plage', building: 'Résidence de la Plage', vacant: false },
  { id: 'gite-du-lac', label: 'Gîte du Lac', building: 'Domaine du Lac', vacant: false },
];

export interface DemoLeaseTerms {
  tenantId: string;
  rent: number;
  charges: number;
  deposit: number;
  start: string;
  end: string;
  furnished: boolean;
}

export const demoLeaseTerms: Readonly<Record<string, DemoLeaseTerms>> = {
  'apt-a1': { tenantId: 'koffi-adjovi', rent: euros(770), charges: euros(80), deposit: euros(770), start: '2023-04-01', end: '2029-03-31', furnished: false },
  'studio-2e': { tenantId: 'ibrahim-yao', rent: euros(720), charges: euros(60), deposit: euros(1440), start: '2025-01-01', end: '2026-12-31', furnished: true },
  'villa-rdc': { tenantId: 'marc-dossou', rent: euros(1900), charges: euros(150), deposit: euros(1900), start: '2024-07-01', end: '2027-06-30', furnished: false },
  'apt-a2': { tenantId: 'nadege-sossou', rent: euros(900), charges: euros(90), deposit: euros(900), start: '2024-09-01', end: '2027-08-31', furnished: false },
  'apt-b1': { tenantId: 'clarisse-hounkpatin', rent: euros(930), charges: euros(90), deposit: euros(930), start: '2025-09-01', end: '2027-08-31', furnished: false },
  'studio-b3': { tenantId: 'yann-le-gall', rent: euros(650), charges: euros(50), deposit: euros(1000), start: '2024-11-01', end: '2027-01-31', furnished: true },
  'apt-a3': { tenantId: 'awa-traore', rent: euros(820), charges: euros(70), deposit: euros(820), start: '2024-02-01', end: '2027-01-31', furnished: false },
  'apt-b2': { tenantId: 'fatou-bamba', rent: euros(880), charges: euros(80), deposit: euros(880), start: '2025-03-01', end: '2028-02-29', furnished: false },
  'studio-c2': { tenantId: 'moussa-diallo', rent: euros(600), charges: euros(50), deposit: euros(1200), start: '2025-06-01', end: '2027-05-31', furnished: true },
};

const base: Omit<Tenant, 'id' | 'firstName' | 'lastName' | 'phone' | 'email' | 'since' | 'unitId'> = {
  kind: 'particulier',
  civility: 'M.',
  companyName: '',
  address: '',
  profession: '',
  birthDate: null,
  idDocType: null,
  idExpiry: null,
  idFileName: null,
  ibanLast4: null,
  status: 'actif',
  state: 'a_jour',
  balance: 0,
  portalActive: true,
  portalInvitedOn: null,
  lateSince: null,
};

export const demoTenants: readonly Tenant[] = [
  { ...base, id: 'koffi-adjovi', firstName: 'Koffi', lastName: 'Adjovi', phone: '+33 6 00 00 00 01', email: 'koffi.adjovi@example.com', address: 'Apt A1, 12 rue des Lilas', profession: 'Ingénieur, CDI', birthDate: '1988-03-14', idDocType: 'passeport', idExpiry: '2031-09-30', ibanLast4: '4417', since: '2023-04-01', unitId: 'apt-a1', state: 'retard', balance: -euros(850), lateSince: '2026-11-01' },
  { ...base, id: 'ibrahim-yao', firstName: 'Ibrahim', lastName: 'Yao', phone: '+33 6 00 00 00 03', email: 'ibrahim.yao@example.com', address: 'Studio 2e, 4 avenue du Parc', profession: 'Consultant', since: '2025-01-01', unitId: 'studio-2e', state: 'preavis', balance: -euros(60), lateSince: '2026-11-05' },
  { ...base, id: 'clarisse-hounkpatin', civility: 'Mme', firstName: 'Clarisse', lastName: 'Hounkpatin', phone: '+33 6 00 00 00 04', email: 'clarisse.hounkpatin@example.com', address: 'Apt B1, 12 rue des Lilas', profession: 'Infirmière', since: '2025-09-01', unitId: 'apt-b1', state: 'retard', balance: -euros(210), lateSince: '2026-11-01' },
  { ...base, id: 'marc-dossou', firstName: 'Marc', lastName: 'Dossou', phone: '+33 6 00 00 00 05', email: 'marc.dossou@example.com', address: 'Villa RDC, 8 chemin de la Rivière', profession: 'Architecte', since: '2024-07-01', unitId: 'villa-rdc' },
  { ...base, id: 'nadege-sossou', civility: 'Mme', firstName: 'Nadège', lastName: 'Sossou', phone: '+33 6 00 00 00 06', email: 'nadege.sossou@example.com', address: 'Apt A2, 12 rue des Lilas', profession: 'Enseignante', since: '2024-09-01', unitId: 'apt-a2' },
  { ...base, id: 'yann-le-gall', firstName: 'Yann', lastName: 'Le Gall', phone: '+33 6 00 00 00 07', email: 'yann.legall@example.com', address: 'Studio B3, 12 rue des Lilas', profession: 'Étudiant en master', since: '2024-11-01', unitId: 'studio-b3', state: 'preavis' },
  { ...base, id: 'awa-traore', civility: 'Mme', firstName: 'Awa', lastName: 'Traoré', phone: '+33 6 00 00 00 08', email: 'awa.traore@example.com', address: 'Apt A3, 12 rue des Lilas', profession: 'Comptable', since: '2024-02-01', unitId: 'apt-a3' },
  { ...base, id: 'fatou-bamba', civility: 'Mme', firstName: 'Fatou', lastName: 'Bamba', phone: '+33 6 00 00 00 09', email: 'fatou.bamba@example.com', address: 'Apt B2, 12 rue des Lilas', profession: 'Pharmacienne', since: '2025-03-01', unitId: 'apt-b2' },
  { ...base, id: 'moussa-diallo', firstName: 'Moussa', lastName: 'Diallo', phone: '+33 6 00 00 00 10', email: 'moussa.diallo@example.com', address: 'Studio C2, 4 avenue du Parc', profession: 'Technicien', since: '2025-06-01', unitId: 'studio-c2' },
  { ...base, id: 'mariam-sy', civility: 'Mme', firstName: 'Mariam', lastName: 'Sy', phone: '+33 6 00 00 00 11', email: 'mariam.sy@example.com', since: '2026-11-10', unitId: null, status: 'invite', state: 'invitation', portalActive: false },
  { ...base, id: 'sarah-mensah', civility: 'Mme', firstName: 'Sarah', lastName: 'Mensah', phone: '+33 6 00 00 00 12', email: 'sarah.mensah@example.com', since: '2020-01-15', unitId: null, status: 'archive', portalActive: false },
  { ...base, id: 'paul-houngbo', firstName: 'Paul', lastName: 'Houngbo', phone: '+33 6 00 00 00 13', email: 'paul.houngbo@example.com', since: '2021-03-01', unitId: null, status: 'archive', portalActive: false },
  { ...base, id: 'chantal-agbo', civility: 'Mme', firstName: 'Chantal', lastName: 'Agbo', phone: '+33 6 00 00 00 14', email: 'chantal.agbo@example.com', since: '2019-09-01', unitId: null, status: 'archive', portalActive: false },
];

export const demoCandidates: readonly Candidate[] = [
  { id: 'lea-martin', firstName: 'Léa', lastName: 'Martin', email: 'lea.martin@example.com', phone: '+33 6 11 22 33 44', unitId: 'apt-b3', monthlyIncome: euros(3200), receivedOn: '2026-11-12', status: 'en_attente', message: 'Bonjour Léa, voici le lien pour déposer votre dossier.', requestedDocuments: ['Pièce d’identité', 'Trois derniers bulletins de salaire'], tenantId: null },
  { id: 'jonas-berg', firstName: 'Jonas', lastName: 'Berg', email: 'jonas.berg@example.com', phone: '+33 6 22 33 44 55', unitId: 'apt-b3', monthlyIncome: euros(2900), receivedOn: '2026-11-10', status: 'preselection', message: '', requestedDocuments: ['Pièce d’identité', 'Trois derniers bulletins de salaire'], tenantId: null },
  { id: 'anna-schmidt', firstName: 'Anna', lastName: 'Schmidt', email: 'anna.schmidt@example.com', phone: '+33 6 33 44 55 66', unitId: 'studio-2e', monthlyIncome: euros(2450), receivedOn: '2026-11-08', status: 'confirme', message: '', requestedDocuments: ['Pièce d’identité', 'Avis d’imposition'], tenantId: null },
  { id: 'paul-lefevre', firstName: 'Paul', lastName: 'Lefèvre', email: 'paul.lefevre@example.com', phone: '+33 6 44 55 66 77', unitId: 'apt-b3', monthlyIncome: euros(1800), receivedOn: '2026-11-05', status: 'refuse', message: '', requestedDocuments: ['Pièce d’identité'], tenantId: null },
  { id: 'camille-roy', firstName: 'Camille', lastName: 'Roy', email: 'camille.roy@example.com', phone: '+33 6 55 66 77 88', unitId: 'apt-b3', monthlyIncome: euros(3050), receivedOn: '2026-11-11', status: 'en_attente', message: '', requestedDocuments: ['Pièce d’identité', 'Trois derniers bulletins de salaire'], tenantId: null },
  { id: 'samir-haddad', firstName: 'Samir', lastName: 'Haddad', email: 'samir.haddad@example.com', phone: '+33 6 66 77 88 99', unitId: 'studio-2e', monthlyIncome: euros(2200), receivedOn: '2026-11-09', status: 'preselection', message: '', requestedDocuments: ['Pièce d’identité', 'Avis d’imposition'], tenantId: null },
];

const koffiDetail: TenantDetail = {
  tenantId: 'koffi-adjovi',
  rent: euros(850),
  nextNoticeOn: '2026-11-25',
  leaseEnd: '2029-03-31',
  onTime: { onTime: 41, total: 43 },
  dueSince: '2026-11-01',
  lateSettled: 2,
  payments: [
    { id: 'echeance-2026-11', date: '2026-11-01', label: 'Échéance de novembre', amount: null, status: 'impaye' },
    { id: 'echeance-2026-10', date: '2026-10-03', label: 'Échéance d’octobre', amount: euros(850), status: 'paye' },
    { id: 'echeance-2026-09', date: '2026-09-02', label: 'Échéance de septembre', amount: euros(850), status: 'paye' },
  ],
  paymentsCount: 43,
  activities: [
    { id: 'relance-mail', tone: 'neutral', title: 'Relance envoyée par e-mail', detail: '08/11/2026 · Équipe' },
    { id: 'fuite-evier', tone: 'warning', title: 'Intervention, fuite sous l’évier', detail: '03/11/2026 · en cours', badge: { label: 'En cours', tone: 'warning' } },
    { id: 'impaye-novembre', tone: 'danger', title: 'Échéance de novembre non réglée', detail: '850 € dus depuis le 01/11/2026', badge: { label: 'Impayé', tone: 'danger' } },
  ],
  activitiesCount: 14,
  documents: [
    { id: 'piece-identite', tone: 'success', title: 'Pièce d’identité', detail: 'Vérifiée le 01/04/2023' },
    { id: 'justificatifs-revenus', tone: 'success', title: 'Justificatifs de revenus', detail: '3 bulletins de salaire, 2023' },
    { id: 'attestation-assurance', tone: 'warning', title: 'Attestation d’assurance', detail: 'À renouveler le 31/03/2027' },
  ],
  documentsCount: 7,
  leases: [
    { id: 'apt-a1', tone: 'success', title: 'Apt A1, Les Tilleuls', detail: 'Location vide · 01/04/2023 → 31/03/2029 · 850 € CC', badge: { label: 'En cours', tone: 'success' }, href: '/baux/apt-a1' },
  ],
  messages: [
    { id: 'je-regle-novembre', tone: 'warning', title: 'Je règle novembre le 15/11', detail: '09/11/2026 · Koffi Adjovi', badge: { label: 'À répondre', tone: 'warning' } },
    { id: 'fuite-photos', tone: 'neutral', title: 'Fuite sous l’évier, photos jointes', detail: '03/11/2026 · Koffi Adjovi', badge: { label: 'Répondu', tone: 'neutral' } },
    { id: 'assurance-2026', tone: 'neutral', title: 'Attestation d’assurance 2026', detail: '28/03/2026 · pièce jointe classée', badge: { label: 'Classé', tone: 'neutral' } },
  ],
  messagesCount: 12,
};

export const demoTenantDetails: Readonly<Record<string, TenantDetail>> = { 'koffi-adjovi': koffiDetail };

export const demoTenantIds: readonly string[] = demoTenants.map((tenant) => tenant.id);
export const demoCandidateIds: readonly string[] = demoCandidates.map((candidate) => candidate.id);
