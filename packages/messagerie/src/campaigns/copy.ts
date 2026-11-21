import type { CampaignStatus, CampaignTab } from './model';

export const CAMPAIGNS_TITLE = 'Campagnes';
export const CAMPAIGNS_SUBTITLE = 'Informez vos locataires ou vos mandants par e-mail : travaux, coupures, assemblées, changement de coordonnées.';
export const NO_PROSPECTING_TEXT = 'Les campagnes servent à l’information de gestion. La prospection commerciale est interdite.';
export const PLAIN_TEXT_NOTICE = 'Le message part en texte brut, sans mise en forme. Aucun pixel d’ouverture ni lien de suivi n’est ajouté.';
export const READ_NOTICE = '« Lu » ne compte que les destinataires qui ouvrent le message dans leur espace : l’e-mail n’est pas suivi.';
export const ACCESS_DENIED_TEXT = 'Votre rôle ne donne pas accès aux campagnes : elles sont réservées au titulaire, aux administrateurs et aux gestionnaires.';

export const statusLabels: Record<CampaignStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmée',
  sending: 'Envoi en cours',
  sent: 'Envoyée',
  cancelled: 'Annulée',
};

export const tabLabels: Record<CampaignTab, string> = {
  all: 'Toutes',
  draft: 'Brouillons',
  scheduled: 'Programmées',
  sending: 'En cours',
  sent: 'Envoyées',
  cancelled: 'Annulées',
};

export const periodLabels = {
  all: 'Toutes les périodes',
  month: 'Ce mois-ci',
  quarter: '3 derniers mois',
  year: 'Cette année',
} as const;

export const metricLabels = {
  sent: 'Envoyés',
  queued: 'En attente',
  sending: 'En cours d’envoi',
  read: 'Lus dans l’espace',
  unsubscribed: 'Désinscrits',
  bounced: 'Rebonds',
  failed: 'Échecs',
  unknown: 'Issue inconnue',
  suppressed: 'Adresses exclues',
  skippedNoEmail: 'Sans adresse e-mail',
} as const;
