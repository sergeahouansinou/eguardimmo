import type { StaffKind, StaffTab } from './model';

export interface StaffKindCopy {
  section: string;
  party: string;
  readBy: string;
  counterpartBadge: string;
  referenceLabel: string;
  emptyTitle: string;
  emptyHint: string;
  composeSubject: string;
}

export const staffKindCopy: Record<StaffKind, StaffKindCopy> = {
  tenant: {
    section: 'Locataires',
    party: 'le locataire',
    readBy: 'Lu par le locataire',
    counterpartBadge: 'Locataire',
    referenceLabel: 'Bail',
    emptyTitle: 'Aucune conversation avec un locataire',
    emptyHint: 'Ouvrez la fiche d’un locataire ou d’un bail et utilisez « Écrire ». La personne doit avoir un compte rattaché à sa fiche.',
    composeSubject: 'Ex. Votre quittance de novembre',
  },
  owner: {
    section: 'Mandants',
    party: 'le mandant',
    readBy: 'Lu par le mandant',
    counterpartBadge: 'Mandant',
    referenceLabel: 'Mandat',
    emptyTitle: 'Aucune conversation avec un mandant',
    emptyHint: 'Ouvrez la fiche d’un mandant ou d’un mandat et utilisez « Écrire ». Le mandant doit avoir un accès actif à son espace.',
    composeSubject: 'Ex. Votre reversement de décembre',
  },
};

export const staffTabLabels: Record<StaffTab, string> = {
  all: 'Tous',
  awaiting: 'À répondre',
  unread: 'Non lus',
  sent: 'Envoyés',
  archived: 'Archivés',
};

export const TEAM_SECTION_LABEL = 'Équipe';
export const STAFF_INBOX_TITLE = 'Messages';
export const STAFF_INBOX_SUBTITLE = 'Échanges avec les locataires et les mandants, et conversations de l’équipe.';
