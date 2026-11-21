import { createErrorTranslator } from '../../orgapi/errors';

export const STALE_CODES: readonly string[] = ['party_version_conflict'];

export const DIRECTORY_MESSAGES: Readonly<Record<string, string>> = {
  party_not_found: 'Ce contact n’existe pas dans votre organisation.',
  contact_point_not_found: 'Cette coordonnée n’existe pas dans votre organisation.',
  party_version_conflict: 'Cette fiche a été modifiée depuis votre lecture : rechargez-la avant de renvoyer vos changements.',
  party_anonymized: 'Un contact anonymisé ne se modifie plus.',
  contact_point_exists: 'Ce contact porte déjà cette coordonnée.',
  party_possible_duplicate: 'Un contact de votre organisation ressemble à celui-ci.',
  party_import_invalid: 'Aucun contact n’a été importé : corrigez les lignes signalées.',
  idempotency_key_reused: 'Ce fichier a déjà été envoyé avec un contenu différent. Fermez la fenêtre puis rechargez le fichier.',
  property_not_found: 'Ce bien n’existe pas dans votre organisation.',
  unit_not_found: 'Ce lot n’existe pas dans votre organisation.',
  property_contact_not_found: 'Ce lien n’existe plus : rechargez la fiche.',
  property_contact_exists: 'Ce contact est déjà rattaché à ce bien ou à ce lot.',
  property_contact_party_anonymized: 'Un contact anonymisé ne peut plus être rattaché à un bien.',
};

export const translateDirectoryError = createErrorTranslator({
  messages: DIRECTORY_MESSAGES,
  staleCodes: STALE_CODES,
});
