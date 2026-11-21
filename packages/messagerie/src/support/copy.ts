import type { SupportCategory, SupportRequestSpace, SupportTicketStatus } from './model';

export const SUPPORT_LABEL = 'Support eGuardImmo';

export const SUPPORT_PRIVACY_TEXT =
  'Le support ne lit jamais vos conversations avec vos locataires, vos mandants ou votre agence : il ne voit que ce que vous écrivez dans votre demande.';

export const statusLabel: Record<SupportTicketStatus, string> = {
  open: 'Ouverte',
  waiting: 'Réponse du support',
  resolved: 'Résolue',
};

export const categoryLabel: Record<SupportCategory, string> = {
  messaging: 'Messagerie',
  billing: 'Facturation',
  account: 'Compte',
  documents: 'Documents',
  other: 'Autre',
};

export const spaceLabel: Record<SupportRequestSpace, string> = {
  tenant: 'Espace locataire',
  owner: 'Espace propriétaire',
  organization: 'Organisation',
  marketplace: 'SeBook',
};

export interface SupportCopy {
  boardSubtitle: string;
  bodyPlaceholder: string;
  subjectPlaceholder: string;
}

const organization: SupportCopy = {
  boardSubtitle: 'Vos demandes d’assistance auprès de l’équipe eGuardImmo.',
  bodyPlaceholder: 'Décrivez votre demande : ce que vous faisiez, ce que vous attendiez, ce qui s’est passé.',
  subjectPlaceholder: 'Ex. Je ne retrouve pas un reversement',
};

export const supportCopy: Record<SupportRequestSpace, SupportCopy> = {
  organization,
  owner: { ...organization, subjectPlaceholder: 'Ex. Je ne vois pas mon dernier compte rendu' },
  tenant: { ...organization, subjectPlaceholder: 'Ex. Je ne retrouve pas ma quittance de novembre' },
  marketplace: organization,
};
