import { createErrorTranslator } from '../../orgapi/errors';

export const translateAnalyticsError = createErrorTranslator({
  messages: {
    reporting_landlord_only: 'Cet écran est réservé aux bailleurs autonomes : il ne concerne pas une agence.',
    forecast_assumptions_stale: 'Les hypothèses ont été modifiées depuis votre lecture. Elles viennent d’être rechargées : relisez-les avant de recommencer.',
    profitability_period_invalid: 'L’année demandée n’est pas valide : choisissez une année entre 2000 et l’année en cours.',
    finance_too_large: 'Votre patrimoine compte trop de lots pour cet écran. Réduisez la période ou contactez le support.',
    export_type_unknown: 'Ce type d’export n’existe pas.',
    export_too_large: 'Cet export est trop volumineux : réduisez la période.',
    unit_not_found: 'Un des lots indiqués n’existe pas dans votre organisation.',
  },
  staleCodes: ['forecast_assumptions_stale'],
  serverDetailCodes: ['validation_failed'],
});
