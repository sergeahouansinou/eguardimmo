import type { EventKind, Recurrence, ReminderOffset } from '../model';

export const KIND_LABELS: Readonly<Record<EventKind, string>> = {
  visit: 'Visite',
  appointment: 'Rendez-vous',
  deadline: 'Échéance',
  reminder: 'Rappel',
};

export const RECURRENCE_LABELS: Readonly<Record<Recurrence, string>> = {
  none: 'Ne se répète pas',
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
};

export const REMINDER_LABELS: Readonly<Record<ReminderOffset, string>> = {
  60: '1 heure avant',
  1440: '1 jour avant',
};

export const SOURCE_LABELS = {
  event: 'Événements',
  task: 'Tâches',
  intervention: 'Interventions',
  certificate: 'Conformité',
} as const;

export type AgendaSource = keyof typeof SOURCE_LABELS;
