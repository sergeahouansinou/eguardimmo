import type { MessagerieSpace } from './data/demo';
import type { ConversationTab } from './data/schemas';

export interface InboxTabConfig {
  id: ConversationTab;
  label: string;
}

export interface MessagerieProfile {
  space: MessagerieSpace;
  inbox: {
    title: string;
    subtitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    tabs: InboxTabConfig[];
    listTitle: 'subject' | 'counterpart';
    showStats: boolean;
    pageSize: number;
    emptyHint: string;
  };
  conversation: {
    contextTitle: string;
    subtitle: (counterpartName: string, tag: string | undefined) => string;
    showThreadStats: boolean;
    replyPlaceholder: string;
  };
  compose: {
    subtitle: string;
    recipientLabel: string;
    recipientPlaceholder: string;
    linkLabel: string | null;
    linkPlaceholder: string;
    subjectPlaceholder: string;
    bodyPlaceholder: string;
    lockSingleRecipient: boolean;
  };
  campaigns: {
    enabled: boolean;
    subtitle: string;
    searchPlaceholder: string;
    audienceNoun: string;
    senderName: string;
    mergeTags: string[];
    testSend: boolean;
    filters: { building: boolean; period: boolean };
    sendLabels: {
      now: { name: string; detail: (count: number) => string };
      scheduled: (count: number) => string;
    } | null;
  } | null;
  help: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    writeLabel: string | null;
    supportTicket: boolean;
  };
}

const ordinaryTabs = (extra: InboxTabConfig[]): InboxTabConfig[] => [
  { id: 'all', label: 'Toutes' },
  ...extra,
  { id: 'archived', label: 'Archivées' },
];

export const locataireProfile: MessagerieProfile = {
  space: 'locataire',
  inbox: {
    title: 'Messages',
    subtitle: 'Vos échanges avec Gestion Les Tilleuls, rattachés à votre bail.',
    searchLabel: 'Rechercher un message',
    searchPlaceholder: 'Ex. loyer, fuite, attestation',
    tabs: ordinaryTabs([
      { id: 'awaiting', label: 'À répondre' },
      { id: 'sent', label: 'Envoyées' },
    ]),
    listTitle: 'subject',
    showStats: false,
    pageSize: 10,
    emptyHint: 'Écrivez à votre gestionnaire depuis « Nouveau message ».',
  },
  conversation: {
    contextTitle: 'Conversation',
    subtitle: (name, tag) => `Avec ${name}${tag ? ` · ${tag}` : ''}`,
    showThreadStats: true,
    replyPlaceholder: 'Ex. Bonjour, le virement est programmé pour le 15/11.',
  },
  compose: {
    subtitle: 'Le message est rattaché à votre bail et reste dans votre historique.',
    recipientLabel: 'Destinataire',
    recipientPlaceholder: 'Choisir un destinataire',
    linkLabel: null,
    linkPlaceholder: '',
    subjectPlaceholder: 'Ex. Virement du loyer de novembre',
    bodyPlaceholder: 'Ex. Bonjour, le virement de 850 € est programmé pour le 15/11.',
    lockSingleRecipient: true,
  },
  campaigns: null,
  help: {
    title: 'Aide',
    subtitle: 'Les réponses aux questions fréquentes et le contact de votre gestionnaire.',
    searchPlaceholder: 'Ex. quittance, fuite, congé',
    writeLabel: 'Écrire un message',
    supportTicket: true,
  },
};

export const proprietaireProfile: MessagerieProfile = {
  space: 'proprietaire',
  inbox: {
    title: 'Messages',
    subtitle: 'Vos échanges avec Cabinet Delmas Immobilier, rattachés à votre mandat.',
    searchLabel: 'Rechercher un message',
    searchPlaceholder: 'Ex. devis, reversement, mandat',
    tabs: ordinaryTabs([{ id: 'unread', label: 'Non lues' }]),
    listTitle: 'subject',
    showStats: false,
    pageSize: 10,
    emptyHint: 'Écrivez à votre gestionnaire depuis « Nouveau message ».',
  },
  conversation: {
    contextTitle: 'Conversation',
    subtitle: (name, tag) => `Conversation avec ${name}${tag ? ` · ${tag}` : ''}`,
    showThreadStats: false,
    replyPlaceholder: 'Ex. Merci Sophie, je valide le devis.',
  },
  compose: {
    subtitle: 'Le message est adressé à votre gestionnaire et reste dans l’historique de votre mandat.',
    recipientLabel: 'Destinataire',
    recipientPlaceholder: 'Choisir un destinataire',
    linkLabel: 'Lot concerné',
    linkPlaceholder: 'Choisir un lot',
    subjectPlaceholder: 'Ex. Question sur le reversement de décembre',
    bodyPlaceholder: 'Ex. Bonjour Sophie, pouvez-vous me confirmer le montant du reversement ?',
    lockSingleRecipient: true,
  },
  campaigns: null,
  help: {
    title: 'Aide',
    subtitle: 'Réponses aux questions fréquentes sur votre mandat, vos loyers et votre fiscalité.',
    searchPlaceholder: 'Ex. honoraires, reversement, devis',
    writeLabel: 'Écrire à l’agence',
    supportTicket: true,
  },
};

export const agenceProfile: MessagerieProfile = {
  space: 'agence',
  inbox: {
    title: 'Messages',
    subtitle: 'Échanges avec les mandants et les locataires, rattachés au mandat ou au bail.',
    searchLabel: 'Rechercher un message',
    searchPlaceholder: 'Ex. Anaïs Roux, fuite, reversement',
    tabs: [
      { id: 'all', label: 'Tous' },
      { id: 'unread', label: 'Non lus' },
      { id: 'mandant', label: 'Mandants' },
      { id: 'locataire', label: 'Locataires' },
      { id: 'archived', label: 'Archivés' },
    ],
    listTitle: 'counterpart',
    showStats: true,
    pageSize: 10,
    emptyHint: 'Écrivez à un mandant ou à un locataire depuis « Nouveau message ».',
  },
  conversation: {
    contextTitle: 'Contexte',
    subtitle: (name, tag) => (tag ?? name),
    showThreadStats: false,
    replyPlaceholder: 'Ex. Le plombier passe lundi 16 novembre.',
  },
  compose: {
    subtitle: 'Le message est rattaché au mandat ou au bail du destinataire et reste dans son historique.',
    recipientLabel: 'Destinataire',
    recipientPlaceholder: 'Rechercher un mandant ou un locataire',
    linkLabel: 'Rattaché à',
    linkPlaceholder: 'Choisir un mandat ou un bail',
    subjectPlaceholder: 'Ex. Devis plomberie, Studio 4',
    bodyPlaceholder: 'Ex. Bonjour Marc, le devis de 380 € TTC est joint pour votre accord.',
    lockSingleRecipient: false,
  },
  campaigns: {
    enabled: true,
    subtitle: 'Un même e-mail envoyé à plusieurs locataires ou mandants, avec le suivi de lecture.',
    searchPlaceholder: 'Ex. Coupure d’eau, reversements',
    audienceNoun: 'personnes',
    senderName: 'Cabinet Delmas Immobilier',
    mergeTags: ['Prénom', 'Mandat', 'Mois'],
    testSend: false,
    filters: { building: false, period: false },
    sendLabels: null,
  },
  help: {
    title: 'Aide',
    subtitle: 'Réponses aux questions fréquentes et contact du support eGuardImmo.',
    searchPlaceholder: 'Ex. mandat, honoraires, équipe',
    writeLabel: null,
    supportTicket: true,
  },
};

export const agenceApiProfile: MessagerieProfile = {
  ...agenceProfile,
  inbox: {
    ...agenceProfile.inbox,
    subtitle: 'Conversations internes de l’équipe de gestion.',
    searchPlaceholder: 'Ex. Camille Martin, reversement',
    tabs: [
      { id: 'all', label: 'Toutes' },
      { id: 'unread', label: 'Non lues' },
      { id: 'archived', label: 'Archivées' },
    ],
    listTitle: 'counterpart',
    emptyHint: 'Écrivez à un membre de l’équipe depuis « Nouveau message ».',
  },
  conversation: { ...agenceProfile.conversation, subtitle: (name) => `Avec ${name}`, replyPlaceholder: 'Ex. Je m’en occupe lundi.' },
  compose: {
    ...agenceProfile.compose,
    subtitle: 'Le message est adressé à un membre de votre équipe.',
    recipientPlaceholder: 'Rechercher un membre de l’équipe',
    linkLabel: null,
    linkPlaceholder: '',
    subjectPlaceholder: 'Ex. Dossier Studio 4',
    bodyPlaceholder: 'Ex. Bonjour, peux-tu relancer le plombier ?',
  },
};

export const bailleurProfile: MessagerieProfile = {
  space: 'bailleur',
  inbox: {
    title: 'Messages',
    subtitle: 'Échanges avec les locataires, rattachés au bail.',
    searchLabel: 'Rechercher un message',
    searchPlaceholder: 'Ex. Koffi Adjovi, loyer, chauffe-eau',
    tabs: [
      { id: 'all', label: 'Reçus' },
      { id: 'unread', label: 'Non lus' },
      { id: 'sent', label: 'Envoyés' },
      { id: 'archived', label: 'Archivés' },
    ],
    listTitle: 'counterpart',
    showStats: false,
    pageSize: 10,
    emptyHint: 'Écrivez à un locataire depuis « Nouveau message ».',
  },
  conversation: {
    contextTitle: 'Contexte',
    subtitle: (name, tag) => (tag ? `${tag}, bail en cours` : name),
    showThreadStats: false,
    replyPlaceholder: 'Ex. Bonjour, merci de confirmer le virement avant le 20 novembre.',
  },
  compose: {
    subtitle: 'Le message est rattaché au bail du destinataire et reste visible dans son historique.',
    recipientLabel: 'Destinataire',
    recipientPlaceholder: 'Rechercher un locataire',
    linkLabel: 'Rattaché à',
    linkPlaceholder: 'Choisir un bail',
    subjectPlaceholder: 'Ex. Travaux dans l’immeuble, lundi 16 novembre',
    bodyPlaceholder: 'Ex. Bonjour, une coupure d’eau est prévue lundi 16 novembre de 9 h à 12 h.',
    lockSingleRecipient: false,
  },
  campaigns: {
    enabled: true,
    subtitle: 'Un même message envoyé par e-mail à plusieurs locataires, avec le suivi de lecture.',
    searchPlaceholder: 'Ex. Coupure d’eau, assurance',
    audienceNoun: 'locataires',
    senderName: 'Gestion Les Tilleuls',
    mergeTags: ['Prénom', 'Bien', 'Loyer', 'Échéance'],
    testSend: true,
    filters: { building: true, period: true },
    sendLabels: {
      now: { name: 'Envoyer', detail: (count) => ` à ${String(count)} locataire${count > 1 ? 's' : ''}` },
      scheduled: (count) => `Programmer pour ${String(count)} locataire${count > 1 ? 's' : ''}`,
    },
  },
  help: {
    title: 'Aide',
    subtitle: 'Réponses aux questions fréquentes et contact du support eGuardImmo.',
    searchPlaceholder: 'Ex. loyer, relance, campagne',
    writeLabel: null,
    supportTicket: true,
  },
};

export const consoleProfile: MessagerieProfile = {
  space: 'console',
  inbox: {
    title: 'Support',
    subtitle: 'Tickets des organisations.',
    searchLabel: 'Rechercher un ticket',
    searchPlaceholder: 'Sujet, référence, organisation',
    tabs: [],
    listTitle: 'subject',
    showStats: false,
    pageSize: 10,
    emptyHint: '',
  },
  conversation: {
    contextTitle: 'Informations',
    subtitle: (name) => name,
    showThreadStats: false,
    replyPlaceholder: 'Ex. Bonjour, nous avons identifié le problème.',
  },
  compose: {
    subtitle: '',
    recipientLabel: 'Destinataire',
    recipientPlaceholder: 'Choisir un destinataire',
    linkLabel: null,
    linkPlaceholder: '',
    subjectPlaceholder: 'Ex. Sujet',
    bodyPlaceholder: 'Ex. Message',
    lockSingleRecipient: true,
  },
  campaigns: null,
  help: {
    title: 'Aide',
    subtitle: 'Procédures d’exploitation et contacts d’astreinte.',
    searchPlaceholder: 'Ex. sauvegarde, 2FA, incident',
    writeLabel: null,
    supportTicket: false,
  },
};

export const messagerieProfiles: Record<MessagerieSpace, MessagerieProfile> = {
  locataire: locataireProfile,
  proprietaire: proprietaireProfile,
  agence: agenceProfile,
  bailleur: bailleurProfile,
  console: consoleProfile,
};
