import type { ExternalSpace } from './model';

export const NOT_A_NOTICE_TEXT =
  'Un message n’est ni un congé, ni une mise en demeure, ni une décision : ces actes gardent leur forme légale ou leur parcours dédié.';

export interface ExternalCopy {
  inboxTitle: string;
  inboxSubtitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  scopeLabel: string;
  scopeAll: string;
  emptyInbox: { title: string; hint: string };
  newThread: {
    subtitle: string;
    optionLabel: string;
    optionPlaceholder: string;
    subjectPlaceholder: string;
    bodyPlaceholder: string;
    noOptions: { title: string; hint: string };
  };
  thread: {
    replyPlaceholder: string;
    referenceLabel: string;
    readOnly: string;
  };
}

const tenant: ExternalCopy = {
  inboxTitle: 'Messages',
  inboxSubtitle: 'Vos échanges avec votre agence, rattachés à votre bail.',
  searchLabel: 'Rechercher un message',
  searchPlaceholder: 'Objet de la conversation',
  scopeLabel: 'Bail',
  scopeAll: 'Tous mes baux',
  emptyInbox: { title: 'Aucune conversation', hint: 'Écrivez à votre agence depuis « Nouveau message ».' },
  newThread: {
    subtitle: 'Le message est adressé à l’agence qui gère votre bail et reste dans votre historique.',
    optionLabel: 'Bail concerné',
    optionPlaceholder: 'Choisir un bail',
    subjectPlaceholder: 'Ex. Question sur ma quittance de novembre',
    bodyPlaceholder: 'Écrivez votre message à l’agence',
    noOptions: {
      title: 'Aucun bail ne permet d’écrire pour le moment',
      hint: 'Vous pouvez écrire à l’agence tant qu’un de vos baux est visible dans votre espace.',
    },
  },
  thread: {
    replyPlaceholder: 'Écrivez votre réponse',
    referenceLabel: 'Bail',
    readOnly: 'Cette conversation est en lecture seule : vous pouvez la relire, sans y répondre.',
  },
};

const owner: ExternalCopy = {
  inboxTitle: 'Messages',
  inboxSubtitle: 'Vos échanges avec vos agences, rattachés à vos mandats.',
  searchLabel: 'Rechercher un message',
  searchPlaceholder: 'Objet de la conversation',
  scopeLabel: 'Agence',
  scopeAll: 'Toutes mes agences',
  emptyInbox: { title: 'Aucune conversation', hint: 'Écrivez à votre agence depuis « Nouveau message ».' },
  newThread: {
    subtitle: 'Le message est adressé à l’agence qui gère votre mandat et reste dans l’historique de votre accès.',
    optionLabel: 'Agence et mandant',
    optionPlaceholder: 'Choisir une agence',
    subjectPlaceholder: 'Ex. Question sur le reversement de décembre',
    bodyPlaceholder: 'Écrivez votre message à l’agence',
    noOptions: {
      title: 'Aucun accès ne permet d’écrire pour le moment',
      hint: 'Seuls le titulaire et son représentant écrivent à l’agence, tant que le mandat est en cours. Un accès en lecture seule relit les conversations existantes.',
    },
  },
  thread: {
    replyPlaceholder: 'Écrivez votre réponse',
    referenceLabel: 'Mandat',
    readOnly: 'Votre accès est en lecture seule : vous pouvez relire cette conversation, sans y répondre.',
  },
};

export const externalCopy: Record<ExternalSpace, ExternalCopy> = { tenant, owner };
