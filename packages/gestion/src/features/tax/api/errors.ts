import { createErrorTranslator } from '../../orgapi/errors';

export const translateTaxError = createErrorTranslator({
  messages: {
    tax_landlord_only: 'Les synthèses fiscales personnelles sont réservées aux bailleurs autonomes.',
    tax_agency_only: 'Les relevés fiscaux par mandant sont réservés aux agences.',
    tax_summary_not_found: 'Cette synthèse n’existe pas dans votre organisation.',
    tax_mandant_not_found: 'Ce mandant n’existe pas dans votre organisation.',
    tax_year_unsupported: 'Seule la déclaration des revenus 2025 est prise en charge pour l’instant.',
    tax_jurisdiction_unsupported: 'La fiscalité de votre pays n’est pas encore prise en charge.',
    tax_taxpayer_unsupported: 'Ce type de contribuable n’est pas encore pris en charge.',
    tax_interest_source_conflict: 'Un bien a un prêt suivi et une dépense « intérêts d’emprunt » pour cette année : gardez une seule source avant de figer la synthèse.',
    tax_batch_too_large: 'Au plus 10 mandants par demande : la génération se fait par lots.',
    tax_batch_time_exceeded: 'La génération a pris trop de temps pour ce mandant : réessayez, les relevés déjà créés sont conservés.',
    tax_period_not_closed: 'Une période comptable de l’année n’est pas clôturée : clôturez-la avant de figer la synthèse.',
    tax_owner_funds_not_ready: 'Les fonds propriétaires de l’année ne sont pas prêts : terminez les opérations en cours.',
    tax_summary_stale_version: 'Cette synthèse a été modifiée depuis votre lecture. Elle vient d’être rechargée : relisez-la avant de recommencer.',
    tax_summary_exists: 'Une synthèse figée existe déjà pour cette année : rectifiez-la plutôt que d’en créer une autre.',
    tax_summary_not_rectifiable: 'Cette synthèse a déjà été remplacée par une rectification.',
    tax_summary_not_publishable: 'Ce relevé ne peut plus être publié : il est déjà publié ou remplacé.',
    tax_idempotency_key_required: 'La saisie n’a pas pu être sécurisée. Rechargez la page puis recommencez.',
    tax_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
    tax_pdf_unavailable: 'Le PDF n’est pas disponible pour le moment. Réessayez dans quelques minutes.',
    tax_export_too_large: 'Cet export est trop volumineux pour être produit.',
  },
  staleCodes: ['tax_summary_stale_version'],
  serverDetailCodes: ['validation_failed'],
});
