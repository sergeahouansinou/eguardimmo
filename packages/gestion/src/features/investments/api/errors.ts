import { createErrorTranslator } from '../../orgapi/errors';

export const translateInvestmentsError = createErrorTranslator({
  messages: {
    investments_landlord_only: 'Les prêts et le coût de revient sont réservés aux bailleurs autonomes : ils ne sont pas ouverts à une agence.',
    loan_not_found: 'Ce prêt n’existe pas dans votre organisation.',
    acquisition_not_found: 'Ce coût de revient n’existe pas dans votre organisation.',
    investments_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
    loan_in_use: 'Une synthèse fiscale figée s’appuie sur ce prêt ou sur les échéances de cette période : l’opération est refusée. Rectifiez d’abord la synthèse.',
    loan_version_conflict: 'Cet élément a été modifié depuis votre lecture. Il vient d’être rechargé : relisez-le avant de recommencer.',
    loan_state_invalid: 'Cette opération n’est pas possible dans l’état actuel du prêt (annulé, soldé ou tableau importé).',
    acquisition_exists: 'Le coût de revient de ce bien ou de ce lot existe déjà : modifiez-le.',
    acquisition_scope_mixed: 'Un bien se renseigne en entier ou lot par lot, pas les deux.',
    loan_attestation_exists: 'Une attestation existe déjà pour cette année.',
    investments_idempotency_key_required: 'La saisie n’a pas pu être sécurisée. Rechargez la page puis recommencez.',
  },
  staleCodes: ['loan_version_conflict'],
  serverDetailCodes: ['validation_failed', 'loan_terms_invalid', 'loan_schedule_inconsistent', 'investments_file_invalid', 'investments_target_invalid'],
});
