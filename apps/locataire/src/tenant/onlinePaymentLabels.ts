import type { Tone } from '@eguardimmo/shell';
import type { FailureWording } from './errors';
import type { OnlineMethod, OnlineStatus } from './onlinePaymentSchemas';

export const ONLINE_METHOD_LABEL: Record<OnlineMethod, { label: string; detail: string }> = {
  card: { label: 'Carte bancaire', detail: 'Vous réglez sur la page sécurisée de notre prestataire de paiement.' },
  direct_debit: { label: 'Prélèvement SEPA', detail: 'Le prélèvement est autorisé sur la page sécurisée de notre prestataire de paiement.' },
};

export const ONLINE_STATUS_VIEW: Record<OnlineStatus, { label: string; tone: Tone }> = {
  pending: { label: 'En attente de votre paiement', tone: 'info' },
  processing: { label: 'Paiement en cours de traitement', tone: 'warning' },
  succeeded: { label: 'Paiement confirmé', tone: 'success' },
  failed: { label: 'Paiement échoué', tone: 'danger' },
  cancelled: { label: 'Paiement annulé', tone: 'neutral' },
  expired: { label: 'Paiement expiré', tone: 'neutral' },
};

export const UNAVAILABLE_REASON: Readonly<Record<string, string>> = {
  provider_unavailable: 'Le paiement en ligne n’est pas encore ouvert. Réglez votre loyer par les moyens habituels indiqués par votre agence.',
  account_not_ready: 'Votre agence n’a pas encore activé le paiement en ligne. Réglez votre loyer par les moyens habituels.',
  nothing_due: 'Aucune échéance n’est à régler pour ce bail : tout est soldé.',
  payment_in_progress: 'Un paiement en ligne est déjà en cours pour ce bail : attendez son résultat ou annulez-le avant d’en lancer un autre.',
};

export const FAILURE_LABEL: Readonly<Record<string, string>> = {
  card_declined: 'Votre carte a été refusée. Essayez une autre carte ou un autre moyen de paiement.',
  authentication_failed: 'L’authentification de votre banque a échoué. Aucun montant n’a été débité.',
  insufficient_funds: 'Les fonds sont insuffisants sur le moyen de paiement choisi.',
};

export const ONLINE_PAYMENT_CODES: Readonly<Record<string, string>> = {
  lease_not_found: 'Ce bail n’existe pas ou n’est plus accessible depuis votre espace.',
  online_payment_not_found: 'Ce paiement n’existe pas ou ne vous appartient pas.',
  payment_nothing_due: 'Aucune des échéances choisies n’a de reste dû : actualisez la page.',
  payment_account_not_ready: 'Votre agence n’a pas encore activé le paiement en ligne.',
  payment_provider_unavailable: 'Le service de paiement ne répond pas : rien n’a été débité. Réessayez dans quelques minutes.',
  payment_not_cancellable: 'Ce paiement n’est plus en attente : il ne peut plus être annulé ici.',
  payment_installments_in_progress: 'Un paiement est déjà en cours pour l’une de ces échéances : attendez son résultat ou annulez-le avant d’en lancer un autre.',
  payment_method_unsupported: 'Ce moyen de paiement n’est pas encore proposé.',
  idempotency_key_reused: 'Cette demande a déjà été enregistrée avec un contenu différent. Rechargez la page pour recommencer.',
  validation_failed: 'Certains champs sont invalides : vérifiez votre sélection.',
};

export const ONLINE_PAYMENT_WORDING: FailureWording = {
  notFound: ONLINE_PAYMENT_CODES.online_payment_not_found,
  codes: ONLINE_PAYMENT_CODES,
  unavailable: ONLINE_PAYMENT_CODES.payment_provider_unavailable,
};
