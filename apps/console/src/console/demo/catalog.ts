import type { ModuleGroup } from '../schemas/modules';

export interface ModuleSeed {
  id: string;
  name: string;
  description: string;
  group: ModuleGroup;
  version: string;
  active: number;
  mandatory?: boolean;
  requires?: string[];
  responsible: string;
}

export const ORGANISATIONS_TOTAL = 128;

export const MODULE_SEEDS: readonly ModuleSeed[] = [
  { id: 'authentification', name: 'Authentification', description: 'Comptes, profils et 2FA', group: 'socle', version: 'v4.2.1', active: 128, mandatory: true, responsible: 'Théo Marchand' },
  { id: 'organisations', name: 'Organisations', description: 'Cloisonnement et rôles', group: 'socle', version: 'v3.7.0', active: 128, mandatory: true, responsible: 'Théo Marchand' },
  { id: 'journal-d-audit', name: "Journal d'audit", description: 'Traces non modifiables', group: 'socle', version: 'v3.1.4', active: 128, mandatory: true, responsible: 'Karim Haddad' },
  { id: 'biens', name: 'Biens', description: 'Biens, lots et équipements', group: 'gestion', version: 'v3.4.2', active: 105, responsible: 'Théo Marchand' },
  { id: 'locataires', name: 'Locataires', description: 'Fiches et dossiers', group: 'gestion', version: 'v3.3.0', active: 105, responsible: 'Théo Marchand' },
  { id: 'baux', name: 'Baux', description: 'Baux, échéances, révisions', group: 'gestion', version: 'v3.9.1', active: 105, responsible: 'Théo Marchand' },
  { id: 'quittances', name: 'Quittances', description: "Avis d'échéance et quittances", group: 'gestion', version: 'v3.5.3', active: 103, requires: ['baux'], responsible: 'Théo Marchand' },
  { id: 'encaissements', name: 'Encaissements', description: 'Paiements et rapprochement', group: 'gestion', version: 'v3.6.0', active: 99, responsible: 'Julie Fontaine' },
  { id: 'impayes', name: 'Impayés', description: 'Relances et recouvrement', group: 'gestion', version: 'v2.8.2', active: 97, requires: ['baux'], responsible: 'Julie Fontaine' },
  { id: 'mandats', name: 'Mandats', description: 'Mandats et mandants', group: 'gestion', version: 'v3.2.0', active: 54, responsible: 'Théo Marchand' },
  { id: 'reversements', name: 'Reversements', description: 'Comptes rendus et honoraires', group: 'gestion', version: 'v3.4.0', active: 54, requires: ['mandats'], responsible: 'Julie Fontaine' },
  { id: 'interventions', name: 'Interventions', description: 'Incidents, devis, artisans', group: 'suivi', version: 'v2.9.5', active: 98, responsible: 'Théo Marchand' },
  { id: 'etats-des-lieux', name: 'États des lieux', description: 'Entrée, sortie, photos', group: 'suivi', version: 'v2.6.1', active: 91, responsible: 'Théo Marchand' },
  { id: 'documents', name: 'Documents', description: 'Stockage et modèles', group: 'suivi', version: 'v3.8.0', active: 128, responsible: 'Théo Marchand' },
  { id: 'messagerie', name: 'Messagerie', description: 'Messages et campagnes e-mail', group: 'suivi', version: 'v3.18.2', active: 118, responsible: 'Théo Marchand' },
  { id: 'notifications', name: 'Notifications', description: 'Push, e-mail et SMS', group: 'suivi', version: 'v3.2.2', active: 126, responsible: 'Théo Marchand' },
  { id: 'fiscalite', name: 'Fiscalité', description: 'Déclarations et justificatifs', group: 'pilotage', version: 'v1.5.0', active: 67, responsible: 'Julie Fontaine' },
  { id: 'conformite', name: 'Conformité', description: 'Cartes, assurances, garanties', group: 'pilotage', version: 'v1.9.3', active: 31, responsible: 'Karim Haddad' },
  { id: 'rapports', name: 'Rapports', description: 'Tableaux de bord et exports', group: 'pilotage', version: 'v2.3.0', active: 88, responsible: 'Julie Fontaine' },
  { id: 'abonnements', name: 'Abonnements', description: 'Plans et facturation', group: 'pilotage', version: 'v3.0.6', active: 105, responsible: 'Julie Fontaine' },
  { id: 'support', name: 'Support', description: 'Tickets et assistance', group: 'pilotage', version: 'v2.1.1', active: 128, responsible: 'Inès Garnier' },
];

export interface DependencySeed {
  dependsOn: { id: string; detail: string }[];
  usedBy: { id: string; detail: string; impacted: boolean }[];
}

export const MODULE_LINKS: Record<string, DependencySeed> = {
  messagerie: {
    dependsOn: [
      { id: 'authentification', detail: "Identité de l'expéditeur" },
      { id: 'documents', detail: 'Pièces jointes' },
      { id: 'notifications', detail: 'Push et alertes' },
    ],
    usedBy: [
      { id: 'impayes', detail: 'Relances retardées', impacted: true },
      { id: 'quittances', detail: 'Envoi des avis retardé', impacted: true },
      { id: 'support', detail: 'Réponses aux tickets', impacted: false },
    ],
  },
  baux: {
    dependsOn: [
      { id: 'biens', detail: 'Lots loués' },
      { id: 'locataires', detail: 'Parties au bail' },
    ],
    usedBy: [
      { id: 'quittances', detail: 'Échéances à quittancer', impacted: false },
      { id: 'impayes', detail: 'Échéances impayées', impacted: false },
    ],
  },
  documents: {
    dependsOn: [{ id: 'authentification', detail: 'Droits de lecture' }],
    usedBy: [
      { id: 'messagerie', detail: 'Pièces jointes', impacted: false },
      { id: 'quittances', detail: 'Stockage des quittances', impacted: false },
    ],
  },
  quittances: {
    dependsOn: [
      { id: 'baux', detail: 'Échéances' },
      { id: 'messagerie', detail: 'Envoi des avis' },
    ],
    usedBy: [{ id: 'encaissements', detail: 'Rapprochement des paiements', impacted: false }],
  },
  impayes: {
    dependsOn: [
      { id: 'baux', detail: 'Échéances impayées' },
      { id: 'messagerie', detail: 'Relances par e-mail' },
    ],
    usedBy: [],
  },
};

export const MESSAGERIE_FLAGS = [
  { key: 'messagerie.envoi_email', label: 'Envoi des e-mails', detail: 'messagerie.envoi_email', enabled: true, badge: null },
  { key: 'messagerie.campagnes', label: 'Campagnes aux locataires', detail: 'messagerie.campagnes', enabled: true, badge: { label: 'Décalées', tone: 'warning' as const } },
  {
    key: 'messagerie.limitation_debit',
    label: "Limitation du débit d'envoi",
    detail: 'messagerie.limitation_debit · 200 messages par minute',
    enabled: true,
    badge: { label: 'Activé à 20:55', tone: 'info' as const },
  },
  { key: 'messagerie.scan_pieces_jointes', label: 'Analyse des pièces jointes', detail: 'messagerie.scan_pieces_jointes', enabled: true, badge: null },
  { key: 'messagerie.sms', label: 'Envoi par SMS', detail: 'messagerie.sms · non déployé', enabled: false, badge: null },
];
