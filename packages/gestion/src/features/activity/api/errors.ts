import { createErrorTranslator } from '../../orgapi/errors';

export const translateActivityError = createErrorTranslator({
  messages: {
    activity_not_found: 'Cette entrée n’existe pas dans le journal de votre organisation.',
    activity_range_too_wide: 'La période ne peut pas dépasser 366 jours.',
    activity_export_too_large: 'Cette période contient trop d’entrées pour un export : réduisez-la.',
  },
  serverDetailCodes: ['validation_failed'],
});
