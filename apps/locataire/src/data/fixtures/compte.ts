import type { ShellNotification } from '@eguardimmo/shell';
import type { HomeExtras, Preference, Profile, Security } from '../schemas/compte';
import type { Intervention } from '../schemas/interventions';

export const profileFixture: Profile = {
  firstName: 'Koffi',
  lastName: 'Adjovi',
  profession: 'Ingénieur, CDI',
  mobile: '+33 6 00 00 00 01',
  email: 'koffi.adjovi@example.com',
  tenantSince: '2023-04-01',
  bankHolder: 'Koffi Adjovi',
  bankLast4: '4417',
  photoName: null,
  dataExportRequestedOn: null,
};

export const securityFixture: Security = {
  passwordChangedOn: '2026-09-14',
  passwordStrength: 'Forte',
  twoFactor: { enabled: true, method: "Application d'authentification", backupCodesLeft: 6, backupCodesTotal: 8 },
  google: true,
  apple: false,
  devices: 3,
};

export const preferencesFixture: Preference[] = [
  { id: 'avis-echeance', label: "Avis d'échéance", detail: 'Chaque mois, avant le 1er', email: true, push: true },
  { id: 'quittance', label: 'Quittance disponible', detail: 'Après chaque loyer soldé', email: true, push: true },
  { id: 'impaye', label: 'Rappel de loyer impayé', detail: 'En cas de retard de paiement', email: true, push: true },
  { id: 'message', label: 'Message du gestionnaire', detail: 'À chaque nouveau message', email: true, push: true },
  { id: 'intervention', label: "Mise à jour d'une intervention", detail: 'Rendez-vous, avancement', email: true, push: false },
  { id: 'assurance', label: 'Assurance à renouveler', detail: "30 jours avant l'échéance", email: true, push: false },
  { id: 'charges', label: 'Régularisation des charges', detail: 'Une fois par an', email: true, push: false },
  { id: 'actualites', label: 'Actualités eGuardImmo', detail: 'Nouveautés du service', email: false, push: false },
];

export const homeFixture: HomeExtras = {
  today: '2026-11-13',
  arrearsNote: 'Votre bailleur a été informé de votre message du 09/11.',
  messages: [
    { id: 'c-virement', title: 'Merci de confirmer le virement avant le 20 novembre', date: '2026-11-11', sender: 'Gestion Les Tilleuls', state: 'a_repondre' },
    { id: 'c-relance', title: 'Relance, loyer de novembre', date: '2026-11-08', sender: 'Gestion Les Tilleuls', state: 'lu' },
    { id: 'c-regularisation', title: 'Régularisation des charges 2025', date: '2026-03-12', sender: 'Gestion Les Tilleuls', state: 'lu' },
  ],
};

export const notificationsFixture: ShellNotification[] = [
  { id: 'n-loyer', tone: 'danger', title: 'Loyer de novembre à régler', detail: '850 € · échéance du 01/11/2026', unread: true, href: '/loyers/payer' },
  { id: 'n-rdv', tone: 'info', title: 'Rendez-vous plombier le 17/11', detail: "Fuite sous l'évier · 9 h à 12 h", unread: true, href: '/interventions/INT-2026-0147' },
  { id: 'n-assurance', tone: 'warning', title: "Attestation d'assurance à renouveler", detail: "Avant le 31/03/2027", unread: false, href: '/assurance' },
  { id: 'n-quittance', tone: 'success', title: "Quittance d'octobre disponible", detail: '03/10/2026', unread: false, href: '/loyers/quittances/QT-2026-0398' },
];

export const interventionsFixture: Intervention[] = [
  {
    id: 'INT-2026-0147',
    title: "Fuite sous l'évier",
    typeLabel: 'Plomberie, fuite',
    room: 'Cuisine',
    description: 'Fuite au niveau du siphon',
    urgency: 'rapide',
    status: 'en_cours',
    reportedAt: '2026-11-03T19:20:00',
    photos: ["Sous l'évier", 'Siphon'],
    availability: 'En semaine, de 9 h à 12 h',
    appointment: { date: '2026-11-17', slot: '9 h à 12 h', contractor: 'Plomberie Garnier', phone: '+33 1 00 00 00 12', presenceRequired: true },
    mandatedOn: '2026-11-05',
    timeline: [
      { label: 'Signalement envoyé', detail: '03/11/2026, 19:20 · photos jointes', state: 'done' },
      { label: 'Pris en compte par Gestion Les Tilleuls', detail: '04/11/2026, 09:05', state: 'done' },
      { label: 'Plombier mandaté', detail: '05/11/2026 · Plomberie Garnier', state: 'done' },
      { label: 'Rendez-vous prévu', detail: 'Mardi 17/11/2026, de 9 h à 12 h', state: 'next' },
      { label: 'Intervention terminée', detail: 'En attente du passage du plombier', state: 'todo' },
    ],
  },
  {
    id: 'INT-2026-0061',
    title: 'Porte du hall qui ne ferme pas',
    typeLabel: 'Serrurerie, porte',
    room: 'Parties communes',
    description: 'La porte du hall ne se verrouille plus.',
    urgency: 'rapide',
    status: 'terminee',
    reportedAt: '2026-05-12T08:40:00',
    photos: [],
    availability: '',
    appointment: null,
    mandatedOn: '2026-05-13',
    timeline: [
      { label: 'Signalement envoyé', detail: '12/05/2026, 08:40', state: 'done' },
      { label: 'Intervention terminée', detail: '20/05/2026', state: 'done' },
    ],
  },
];
