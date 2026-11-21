import { createErrorTranslator } from '../../orgapi/errors';

export const PLANNING_MESSAGES: Readonly<Record<string, string>> = {
  planning_event_not_found: 'Cet événement n’existe pas dans votre organisation.',
  planning_task_not_found: 'Cette tâche n’existe pas dans votre organisation.',
  planning_link_invalid: 'Le bien, le lot ou le bail indiqué n’existe pas dans votre organisation, ou ne correspond pas aux autres liens.',
  planning_assignee_invalid: 'Le responsable doit être un membre actif de votre organisation.',
  planning_range_too_wide: 'La période demandée dépasse 62 jours ou contient plus de 500 occurrences : réduisez-la.',
  planning_bulk_too_large: 'Une action groupée porte sur 100 tâches au plus.',
  planning_task_not_open: 'Cette tâche est déjà terminée ou annulée : rechargez la liste pour voir son état.',
  planning_version_conflict: 'Cet élément a été modifié par quelqu’un d’autre depuis votre lecture. Il vient d’être rechargé : relisez-le avant de renvoyer vos changements.',
  planning_event_cancelled: 'Un événement annulé ne se modifie plus.',
  planning_series_limit_reached: 'Le nombre de séries récurrentes actives de l’organisation est atteint : annulez ou terminez une série avant d’en ajouter une.',
};

export const translatePlanningError = createErrorTranslator({
  messages: PLANNING_MESSAGES,
  staleCodes: ['planning_version_conflict', 'planning_task_not_open'],
  unavailableMessage: 'L’agenda est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.',
});
