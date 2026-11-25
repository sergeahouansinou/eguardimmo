import type { BadgeTone } from '@eguardimmo/ui';
import type { CampaignCategory, CampaignChannel, CampaignStatus } from '@/platform/marketing/marketing';
import { describeProblem } from '@/platform/errors';
import { formatDecimal, formatInteger } from '@/lib/format';

export const CHANNEL_LABELS: Record<CampaignChannel, string> = { email: 'E-mail', push: 'Notification push' };
export const CATEGORY_LABELS: Record<CampaignCategory, string> = { marketing: 'Marketing', service: 'Information de service' };
export const STATUS_LABELS: Record<CampaignStatus, string> = { draft: 'Brouillon', sending: 'Envoi en cours', sent: 'Envoyée' };
export const STATUS_TONES: Record<CampaignStatus, BadgeTone> = { draft: 'neutral', sending: 'info', sent: 'success' };

export const CONSENT_NOTES: Record<CampaignCategory, string> = {
  marketing: 'Envoyée uniquement aux comptes qui ont accepté ce type de message dans leurs préférences. Aucun canal n’est activé par défaut.',
  service: 'Réservée à une information liée au service. Elle est activée par défaut et chaque compte peut la désactiver.',
};

const KILOBYTE = 1024;

export function formatBytes(bytes: number): string {
  if (bytes < KILOBYTE) return `${formatInteger(bytes)} o`;
  if (bytes < KILOBYTE * KILOBYTE) return `${formatInteger(Math.round(bytes / KILOBYTE))} Ko`;
  return `${formatDecimal(bytes / (KILOBYTE * KILOBYTE))} Mo`;
}

const MESSAGES: Readonly<Record<string, string>> = {
  platform_campaign_not_found: 'Cette campagne n’existe plus.',
  platform_campaign_not_editable: 'Cette campagne n’est plus un brouillon : elle ne peut plus être modifiée.',
  platform_campaign_stale: 'Cette campagne a été modifiée ailleurs. La recharger remplace vos modifications non enregistrées.',
  platform_campaign_no_recipient: 'Aucun destinataire éligible pour cette campagne.',
  platform_campaign_no_device: 'Aucun appareil ne peut recevoir cette notification. Ouvrez l’application mobile avec le compte destinataire, puis réessayez.',
  platform_campaign_too_large: 'Cette campagne dépasse le nombre maximal de destinataires. Choisissez un groupe plus restreint.',
  campaign_sending_disabled: 'L’envoi des campagnes par e-mail est désactivé sur le serveur.',
  push_sending_disabled: 'L’envoi des notifications push est désactivé sur le serveur.',
};

const RELOADABLE = new Set(['platform_campaign_stale', 'platform_campaign_not_editable']);

export interface CampaignProblem {
  message: string;
  reloadable: boolean;
}

export function campaignProblem(error: unknown): CampaignProblem {
  const problem = describeProblem(error);
  const known = problem.code !== null && Object.hasOwn(MESSAGES, problem.code) ? MESSAGES[problem.code] : undefined;
  return { message: known ?? problem.message, reloadable: problem.code !== null && RELOADABLE.has(problem.code) };
}
