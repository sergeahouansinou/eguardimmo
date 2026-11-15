import type { ImmeubleExtras } from './records';

const euros = (value: number) => value * 100;

export const tilleulsExtras: ImmeubleExtras = {
  badges: [{ label: 'Copropriété', tone: 'info' }],
  coproSummary: [
    { label: 'Prochaine assemblée générale', value: '12/03/2027' },
    { label: 'Budget 2026, votre part', value: '4 860 €' },
    { label: 'Fonds de travaux, 5 %', value: '243 € par an' },
    { label: 'Plan pluriannuel de travaux', value: 'Adopté en 2025' },
    { label: 'Ravalement voté pour 2027', value: '3 480 €' },
    { label: 'Assurance PNO', value: 'Jusqu’au 31/12/2026' },
  ],
  keys: [
    { id: 'generales', label: 'Charges générales', detail: 'Tantièmes, 824 / 1 000', pill: null },
    { id: 'ascenseur', label: 'Ascenseur', detail: 'Tantièmes ascenseur, 814 / 1 000', pill: null },
    { id: 'eau-froide', label: 'Eau froide', detail: 'Compteurs individuels', pill: null },
  ],
  charges: {
    year: 2026,
    sharePerMille: 824,
    fundPercent: 5,
    lines: [
      { id: 'syndic', label: 'Honoraires du syndic', key: 'Générales', share: euros(980), recoverablePercent: 0 },
      { id: 'entretien', label: 'Entretien et nettoyage', key: 'Générales', share: euros(1150), recoverablePercent: 100 },
      { id: 'ascenseur', label: 'Ascenseur, contrat et électricité', key: 'Ascenseur', share: euros(720), recoverablePercent: 100 },
      { id: 'gardiennage', label: 'Gardiennage', key: 'Générales', share: euros(800), recoverablePercent: 75 },
      { id: 'assurance', label: 'Assurance de l’immeuble', key: 'Générales', share: euros(640), recoverablePercent: 0 },
      { id: 'electricite', label: 'Électricité des parties communes', key: 'Générales', share: euros(310), recoverablePercent: 100 },
      { id: 'eau', label: 'Eau froide des parties communes', key: 'Générales', share: euros(260), recoverablePercent: 100 },
    ],
    keys: [
      { id: 'generales', label: 'Charges générales', detail: 'Tantièmes, 824 / 1 000', pill: { label: 'Tous les lots', tone: 'neutral' } },
      { id: 'ascenseur', label: 'Ascenseur', detail: 'Tantièmes ascenseur, 814 / 1 000', pill: { label: 'Sans le parking', tone: 'neutral' } },
      { id: 'gardiennage', label: 'Gardiennage', detail: 'Tantièmes généraux', pill: { label: '75 % récupérable', tone: 'info' } },
      { id: 'eau', label: 'Eau froide des lots', detail: 'Compteurs divisionnaires', pill: { label: 'Au relevé', tone: 'neutral' } },
    ],
    regularisation: [
      { lotId: 'apt-a1', lotName: 'Apt A1', tenant: 'Koffi Adjovi', tantiemes: 128, provisions: euros(960), recoverable: euros(472) },
      { lotId: 'apt-a2', lotName: 'Apt A2', tenant: 'Nadège Sossou', tantiemes: 140, provisions: euros(1080), recoverable: euros(517) },
      { lotId: 'apt-a3', lotName: 'Apt A3', tenant: 'Awa Traoré', tantiemes: 130, provisions: euros(840), recoverable: euros(480) },
      { lotId: 'apt-b1', lotName: 'Apt B1', tenant: 'Clarisse Hounkpatin', tantiemes: 104, provisions: euros(1080), recoverable: euros(384) },
      { lotId: 'apt-b2', lotName: 'Apt B2', tenant: 'Fatou Bamba', tantiemes: 142, provisions: euros(960), recoverable: euros(524) },
      { lotId: 'studio-b3', lotName: 'Studio B3', tenant: 'Yann Le Gall', tantiemes: 30, provisions: euros(600), recoverable: euros(111) },
      { lotId: 'parking-p4', lotName: 'Parking P4', tenant: 'Awa Traoré', tantiemes: 10, provisions: euros(60), recoverable: euros(37) },
    ],
  },
  copro: {
    year: 2026,
    meetings: [
      { id: 'ag-2027', date: '2027-03-12', type: 'Ordinaire', decisions: 'Comptes 2026, budget 2027, renouvellement du syndic', vote: null, held: false },
      { id: 'ag-2026', date: '2026-03-14', type: 'Ordinaire', decisions: 'Ravalement des façades voté, budget 2026', vote: 'Pour', held: true },
      { id: 'ag-2025', date: '2025-03-22', type: 'Ordinaire', decisions: 'Adoption du plan pluriannuel de travaux', vote: 'Pour', held: true },
      { id: 'ag-2024', date: '2024-03-09', type: 'Ordinaire', decisions: 'Contrat d’entretien de la porte du parking', vote: 'Abstention', held: true },
      { id: 'ag-2023', date: '2023-03-18', type: 'Ordinaire', decisions: 'Budget 2023, remplacement de la chaudière collective', vote: 'Pour', held: true },
      { id: 'ag-2022', date: '2022-03-12', type: 'Ordinaire', decisions: 'Comptes 2021, budget 2022', vote: 'Pour', held: true },
    ],
    syndic: [
      { label: 'Syndic', value: 'Cabinet Lemoine' },
      { label: 'Gestionnaire', value: 'Hélène Marchal' },
      { label: 'Mandat jusqu’au', value: '31/03/2027' },
      { label: 'Conseil syndical', value: '3 membres, dont vous' },
      { label: 'Gardienne', value: 'Mme Duval, loge au RDC' },
    ],
    plan: {
      adoptedOn: '2025-03-22',
      years: 10,
      items: [
        { id: 'ravalement', label: 'Ravalement des façades', year: 2027, share: euros(3480), financing: 'Appels en 4 fois', status: { label: 'Voté', tone: 'success' } },
        { id: 'porte-parking', label: 'Remplacement de la porte du parking', year: 2028, share: euros(280), financing: 'Fonds de travaux', status: { label: 'Au plan', tone: 'neutral' } },
        { id: 'toiture', label: 'Réfection de la toiture-terrasse', year: 2029, share: euros(2100), financing: 'Fonds de travaux', status: { label: 'Au plan', tone: 'neutral' } },
        { id: 'colonnes', label: 'Remplacement des colonnes d’eau', year: 2031, share: euros(1650), financing: 'À voter', status: { label: 'Au plan', tone: 'neutral' } },
      ],
    },
    calls: [
      { id: 't1', label: '1er trimestre, 01/01', amount: euros(1215), paid: true },
      { id: 't2', label: '2e trimestre, 01/04', amount: euros(1215), paid: true },
      { id: 't3', label: '3e trimestre, 01/07', amount: euros(1215), paid: true },
      { id: 't4', label: '4e trimestre, 01/10', amount: euros(1215), paid: true },
    ],
    fundBalance: euros(1120),
    obligations: [
      { id: 'immatriculation', label: 'Immatriculation au registre', detail: 'AB1-234-567 · mise à jour 04/2026', pill: { label: 'À jour', tone: 'success' } },
      { id: 'ppt', label: 'Plan pluriannuel de travaux', detail: 'Obligatoire, immeuble de plus de 15 ans', pill: { label: 'Adopté', tone: 'success' } },
      { id: 'dpe-collectif', label: 'DPE collectif', detail: 'Obligatoire depuis 2026, moins de 50 lots', pill: { label: 'Classe D', tone: 'success' } },
    ],
  },
  interventions: {
    year: 2026,
    averageCloseDays: 4,
    items: [
      { id: 'fuite-evier', date: '2026-11-03', title: 'Fuite sous l’évier', place: 'Apt A1', provider: 'Plomberie Martin', paidBy: 'Bailleur', cost: null, costNote: 'Devis 320 €', status: { label: 'En cours', tone: 'warning' } },
      { id: 'groom-porte', date: '2026-09-14', title: 'Groom de la porte d’entrée', place: 'Parties communes', provider: 'Syndic', paidBy: 'Copropriété', cost: null, costNote: null, status: { label: 'Terminée', tone: 'neutral' } },
      { id: 'mitigeur', date: '2026-07-02', title: 'Remplacement du mitigeur de douche', place: 'Apt A2', provider: 'Plomberie Martin', paidBy: 'Bailleur', cost: euros(145), costNote: null, status: { label: 'Terminée', tone: 'neutral' } },
      { id: 'clim-annuel', date: '2026-05-20', title: 'Entretien annuel du climatiseur', place: 'Apt A1', provider: 'Clim Services 75', paidBy: 'Bailleur', cost: euros(95), costNote: null, status: { label: 'Terminée', tone: 'neutral' } },
      { id: 'toiture', date: '2026-03-11', title: 'Infiltration par la toiture', place: 'Studio B3', provider: 'Syndic, assurance', paidBy: 'Copropriété', cost: null, costNote: 'Sinistre', status: { label: 'Terminée', tone: 'neutral' } },
      { id: 'prise', date: '2026-02-18', title: 'Prise électrique arrachée', place: 'Apt B1', provider: 'Élec Services', paidBy: 'Locataire', cost: euros(60), costNote: null, status: { label: 'Terminée', tone: 'neutral' } },
    ],
    claims: [
      { id: 'sinistre-toiture', title: 'Infiltration par la toiture, Studio B3', detail: '11/03/2026 · assurance de l’immeuble, 860 € versés', pill: { label: 'Clos', tone: 'neutral' }, warn: false },
      { id: 'pno', title: 'Assurance propriétaire non occupant', detail: 'Vos 8 lots · échéance 31/12/2026', pill: { label: 'À renouveler', tone: 'warning' }, warn: true },
    ],
    providers: [
      { id: 'plomberie-martin', name: 'Plomberie Martin', detail: '2 interventions en 2026', trade: 'Plomberie' },
      { id: 'clim-services', name: 'Clim Services 75', detail: 'Contrat annuel, climatiseur Apt A1', trade: 'Climatisation' },
    ],
  },
};
