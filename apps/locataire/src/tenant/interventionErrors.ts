import type { FailureWording } from './errors';

export const INTERVENTION_CODES: Readonly<Record<string, string>> = {
  intervention_not_found: 'Cette demande n’existe pas ou n’est plus accessible depuis votre espace.',
  intervention_lease_not_found: 'Ce bail n’existe pas ou n’est plus accessible depuis votre espace.',
  intervention_visit_not_found: 'Ce rendez-vous n’existe plus.',
  intervention_file_not_found: 'Cette photo n’existe plus ou ne vous est pas destinée.',
  intervention_stale_version: 'Cette demande a changé entre-temps : rechargez la page.',
  intervention_transition_invalid: 'Cette demande a déjà avancé : cette action n’est plus possible. Rechargez la page.',
  visit_status_invalid: 'Ce rendez-vous a déjà évolué : rechargez la page pour voir son état actuel.',
  maintenance_idempotency_key_reused: 'Ce signalement a déjà été enregistré avec un contenu différent. Rechargez le formulaire pour en saisir un nouveau.',
  idempotency_key_required: 'La clé de saisie est invalide : rechargez le formulaire.',
  intervention_lease_not_active: 'Votre bail n’est pas en cours : vous ne pouvez plus signaler de problème depuis cet espace.',
  intervention_too_many_open: 'Vous avez déjà beaucoup de demandes ouvertes pour ce bail. Attendez qu’elles avancent avant d’en signaler une nouvelle.',
  intervention_unit_invalid: 'Le lieu choisi ne fait pas partie de votre bail.',
  intervention_files_limit: 'Le nombre maximal de photos pour cette demande est atteint.',
  intervention_file_invalid: 'Cette photo n’est pas acceptée : utilisez une image JPG ou PNG de 10 Mo au plus, sur une demande encore ouverte.',
  maintenance_jurisdiction_unsupported: 'Cette action n’est pas encore disponible pour votre bail.',
  validation_failed: 'Certains champs sont invalides : vérifiez votre saisie.',
};

export const INTERVENTION_WORDING: FailureWording = {
  notFound: INTERVENTION_CODES.intervention_not_found,
  codes: INTERVENTION_CODES,
  unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
};
