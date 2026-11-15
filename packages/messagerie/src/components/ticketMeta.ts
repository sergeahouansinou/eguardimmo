import type { BadgeTone } from '@eguardimmo/ui';
import { ticketCategorySchema } from '../data/schemas';
import type { TicketCategory, TicketPriority, TicketStatus } from '../data/schemas';

export const statusLabels: Record<TicketStatus, string> = {
  ouvert: 'Ouvert',
  en_attente: 'En attente',
  resolu: 'Résolu',
};

export const statusTones: Record<TicketStatus, BadgeTone> = {
  ouvert: 'info',
  en_attente: 'warning',
  resolu: 'success',
};

export const priorityLabels: Record<TicketPriority, string> = {
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
};

export const priorityTones: Record<TicketPriority, BadgeTone> = {
  haute: 'danger',
  normale: 'neutral',
  basse: 'neutral',
};

export const categoryLabels: Record<TicketCategory, string> = {
  messagerie: 'Messagerie',
  facturation: 'Facturation',
  compte: 'Compte',
  documents: 'Documents',
  autre: 'Autre',
};

export const categoryOptions = ticketCategorySchema.options.map((value) => ({
  value,
  label: categoryLabels[value],
}));
