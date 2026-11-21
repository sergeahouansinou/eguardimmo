import type { ShellData } from '@eguardimmo/shell';
import type { BureauData } from './schemas';
import type { GestionSource } from './source';

const euros = (value: number) => value * 100;

export const demoShell: ShellData = {
  user: {
    firstName: 'Marc',
    fullName: 'Marc Chevalier',
    initials: 'MC',
    email: 'marc.chevalier@example.com',
  },
  workspace: { name: 'Gestion Les Tilleuls', ownerName: 'Awa Diallo', role: 'admin', plan: 'Silver', members: 2 },
  counts: { lots: 14, tenants: 10, unreadMessages: 2, openInterventions: 3 },
  notifications: [
    { id: 'n1', tone: 'danger', title: 'Loyer de novembre impayé', detail: 'Koffi Adjovi · 850 € · il y a 2 j', unread: true, href: '/finances/impayes' },
    { id: 'n2', tone: 'warning', title: 'Nouvelle intervention', detail: 'Fuite sous l’évier, Apt A1 · il y a 5 h', unread: true, href: '/interventions' },
    { id: 'n3', tone: 'success', title: 'Bail signé', detail: 'Mariam Sy, Apt B3 · hier', unread: true, href: '/baux' },
    { id: 'n4', tone: 'neutral', title: 'Fin de bail dans 48 jours', detail: 'Ibrahim Yao, Studio 2e · 31/12/2026', unread: false, href: '/baux' },
  ],
};

export const demoBureau: BureauData = {
  generatedAt: '2026-11-13T08:00:00+01:00',
  currency: 'EUR',
  collection: { called: euros(8890), collected: euros(7770) },
  arrears: { amount: euros(1120), tenants: 3, beyond30Days: 0 },
  occupancy: { rented: 11, total: 14 },
  cashflow: { net: euros(2640), previousNet: euros(2316) },
  todos: [
    { id: 't1', category: 'finances', kind: 'impaye', tone: 'danger', urgent: true, title: 'Loyer impayé, Koffi Adjovi', detail: 'Apt A1, Les Tilleuls · 850 €', badge: { label: '12 jours', tone: 'danger' }, action: { label: 'Relancer', href: '/finances/impayes' } },
    { id: 't2', category: 'finances', kind: 'retard', tone: 'warning', urgent: false, title: '2 loyers en retard', detail: 'Clarisse Hounkpatin, Ibrahim Yao · 270 €', badge: { label: '12 jours', tone: 'warning' }, action: { label: 'Voir', href: '/finances/impayes' } },
    { id: 't3', category: 'baux', kind: 'fin_de_bail', tone: 'warning', urgent: false, title: 'Bail sans renouvellement', detail: 'Studio 2e, Résidence du Parc · fin le 31/12/2026', badge: { label: '48 jours', tone: 'warning' }, action: { label: 'Ouvrir le bail', href: '/baux' } },
    { id: 't4', category: 'baux', kind: 'revision', tone: 'info', urgent: false, title: 'Révision de loyer possible', detail: 'Apt A2 · IRL T3 2026, +3,26 %', badge: { label: 'Ce mois', tone: 'neutral' }, action: { label: 'Appliquer', href: '/baux' } },
    { id: 't5', category: 'suivi', kind: 'intervention', tone: 'warning', urgent: false, title: 'Chauffe-eau à remplacer', detail: 'Villa RDC, Maison Rivière', badge: { label: '17 jours', tone: 'neutral' }, action: { label: 'Planifier', href: '/interventions' } },
    { id: 't6', category: 'suivi', kind: 'assurance', tone: 'danger', urgent: true, title: "Attestation d'assurance expirée", detail: 'Studio 2e, Résidence du Parc', badge: { label: 'Depuis 3 j', tone: 'danger' }, action: { label: 'Demander', href: '/documents' } },
    { id: 't7', category: 'compte', kind: 'profil', tone: 'neutral', urgent: false, title: 'Profil complété à 50 %', detail: 'Identifiant fiscal et adresse de la société', action: { label: 'Compléter', href: '/compte' } },
  ],
  today: [
    { id: 'a1', time: '08:30', title: 'Relancer Koffi Adjovi', detail: 'Apt A1, Les Tilleuls' },
    { id: 'a2', time: '11:00', title: "Appel de l'assureur", detail: 'Résidence du Parc' },
    { id: 'a3', time: '15:30', title: 'Visite avec un candidat', detail: 'Apt B3, Les Tilleuls' },
  ],
  deadlines: [
    { id: 'e1', date: '2026-11-16', title: 'Assurance multirisque', detail: 'Résidence du Parc, à renouveler' },
    { id: 'e2', date: '2026-12-01', title: "Avis d'échéance de décembre", detail: '9 avis, 8 890 € appelés' },
    { id: 'e3', date: '2026-12-31', title: 'Régularisation des charges 2026', detail: '3 immeubles à clôturer' },
  ],
  rentHistory: [
    { month: '2026-06', called: euros(8890), collected: euros(8890) },
    { month: '2026-07', called: euros(8890), collected: euros(8890) },
    { month: '2026-08', called: euros(8890), collected: euros(8890) },
    { month: '2026-09', called: euros(8890), collected: euros(8890) },
    { month: '2026-10', called: euros(8890), collected: euros(8890) },
    { month: '2026-11', called: euros(8890), collected: euros(7770) },
  ],
  recentPayments: [
    { id: 'p1', date: '2026-11-12', tenant: 'Nadège Sossou', unit: 'Apt A2', method: 'virement', partial: false, amount: euros(990) },
    { id: 'p3', date: '2026-11-12', tenant: 'Ibrahim Yao', unit: 'Studio 2e', method: 'virement', partial: true, amount: euros(720) },
    { id: 'p2', date: '2026-11-10', tenant: 'Marc Dossou', unit: 'Villa RDC', method: 'virement', partial: false, amount: euros(2100) },
    { id: 'p4', date: '2026-11-05', tenant: 'Clarisse Hounkpatin', unit: 'Apt B1', method: 'prelevement', partial: false, amount: euros(810) },
  ],
};

export function createDemoSource(): GestionSource {
  let shell = structuredClone(demoShell);
  return {
    shell: () => Promise.resolve(structuredClone(shell)),
    bureau: () => Promise.resolve(structuredClone(demoBureau)),
    markAllNotificationsRead: () => {
      shell = { ...shell, notifications: shell.notifications.map((item) => ({ ...item, unread: false })) };
      return Promise.resolve();
    },
    markNotificationRead: (id) => {
      if (!shell.notifications.some((item) => item.id === id)) return Promise.reject(new Error('Notification inconnue.'));
      shell = { ...shell, notifications: shell.notifications.map((item) => (item.id === id ? { ...item, unread: false } : item)) };
      return Promise.resolve();
    },
  };
}
