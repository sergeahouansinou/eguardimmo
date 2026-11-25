import { z } from 'zod';
import { SELECTED_AUDIENCE } from '@/platform/marketing/campaignBody';
import type { CampaignInput } from '@/platform/marketing/campaignBody';
import type { CampaignCategory, CampaignChannel, CampaignDetail, CampaignImage, MarketingOptions } from '@/platform/marketing/marketing';
import { parseHtml } from './html/cid';
import { formatBytes } from './labels';

export const INACTIVITY_PRESETS = [7, 14, 30] as const;
export const INACTIVITY_MIN = 7;
export const INACTIVITY_MAX = 365;

const DEFAULT_INACTIVITY = '30';
const RELATIVE_LINK = /^\/(?!\/)[^\\\s]*$/;

export interface NewImage {
  ref: string;
  file: File;
}

export interface CampaignDraft {
  channel: CampaignChannel;
  category: CampaignCategory;
  audience: string;
  inactivityDays: string;
  recipients: string[];
  subject: string;
  html: string;
  pushTitle: string;
  pushBody: string;
  link: string;
  newImages: NewImage[];
  removedImageIds: string[];
}

export type DraftField = 'audience' | 'inactivityDays' | 'recipients' | 'subject' | 'html' | 'images' | 'pushTitle' | 'pushBody' | 'link';
export type DraftErrors = Partial<Record<DraftField, string>>;

export const textLength = (value: string): number => Array.from(value).length;
export const byteLength = (value: string): number => new TextEncoder().encode(value).length;
export const isEmailAddress = (value: string): boolean => z.email().safeParse(value).success;

export function emptyDraft(options: MarketingOptions): CampaignDraft {
  return {
    channel: options.channels.find((entry) => entry.enabled)?.channel ?? 'email',
    category: options.categories[0]?.code ?? 'service',
    audience: options.audiences[0]?.code ?? '',
    inactivityDays: DEFAULT_INACTIVITY,
    recipients: [],
    subject: '',
    html: '',
    pushTitle: '',
    pushBody: '',
    link: '',
    newImages: [],
    removedImageIds: [],
  };
}

export function draftOf(campaign: CampaignDetail): CampaignDraft {
  return {
    channel: campaign.channel,
    category: campaign.category,
    audience: campaign.audience,
    inactivityDays: campaign.inactivity_days === null ? DEFAULT_INACTIVITY : String(campaign.inactivity_days),
    recipients: campaign.recipient_emails,
    subject: campaign.subject ?? '',
    html: campaign.html ?? '',
    pushTitle: campaign.push_title ?? '',
    pushBody: campaign.push_body ?? '',
    link: campaign.link ?? '',
    newImages: [],
    removedImageIds: [],
  };
}

const snapshot = (draft: CampaignDraft): string => JSON.stringify({ ...draft, newImages: draft.newImages.map((image) => image.ref) });

export const isDirty = (draft: CampaignDraft, baseline: CampaignDraft): boolean => snapshot(draft) !== snapshot(baseline);

export const acceptsInactivity = (draft: CampaignDraft, options: MarketingOptions): boolean =>
  options.audiences.some((audience) => audience.code === draft.audience && audience.accepts_inactivity_days);

export const keptImages = (draft: CampaignDraft, saved: readonly CampaignImage[]): CampaignImage[] =>
  saved.filter((image) => !draft.removedImageIds.includes(image.id));

function isBlankContent(html: string): boolean {
  const { body } = parseHtml(html);
  return body.textContent.trim() === '' && body.querySelector('img, hr, table') === null;
}

function limited(value: string, max: number, missing: string): string | undefined {
  if (value.trim() === '') return missing;
  return textLength(value) > max ? `${String(max)} caractères au maximum.` : undefined;
}

function audienceErrors(draft: CampaignDraft, options: MarketingOptions): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.audience === '') errors.audience = 'Choisissez les destinataires.';
  if (acceptsInactivity(draft, options)) {
    const days = Number(draft.inactivityDays);
    if (!/^\d+$/.test(draft.inactivityDays) || days < INACTIVITY_MIN || days > INACTIVITY_MAX) {
      errors.inactivityDays = `Saisissez un nombre de jours entre ${String(INACTIVITY_MIN)} et ${String(INACTIVITY_MAX)}.`;
    }
  }
  if (draft.audience === SELECTED_AUDIENCE) {
    const max = options.limits.selected_recipients;
    if (draft.recipients.length === 0) errors.recipients = 'Ajoutez au moins une adresse.';
    else if (draft.recipients.length > max) errors.recipients = `${String(max)} adresses au maximum.`;
  }
  return errors;
}

function emailErrors(draft: CampaignDraft, options: MarketingOptions, saved: readonly CampaignImage[]): DraftErrors {
  const { limits } = options;
  const errors: DraftErrors = {};
  const subject = limited(draft.subject, limits.subject, 'Saisissez l’objet de l’e-mail.');
  if (subject) errors.subject = subject;
  if (isBlankContent(draft.html)) errors.html = 'Écrivez le contenu de l’e-mail.';
  else if (byteLength(draft.html) > limits.html_bytes) errors.html = `Le contenu dépasse ${formatBytes(limits.html_bytes)}.`;
  const sizes = [...keptImages(draft, saved).map((image) => image.size), ...draft.newImages.map((image) => image.file.size)];
  if (sizes.length > limits.images) errors.images = `${String(limits.images)} images au maximum.`;
  else if (sizes.reduce((total, size) => total + size, 0) > limits.total_image_bytes) {
    errors.images = `Les images dépassent ${formatBytes(limits.total_image_bytes)} au total.`;
  }
  return errors;
}

function pushErrors(draft: CampaignDraft, options: MarketingOptions): DraftErrors {
  const errors: DraftErrors = {};
  const title = limited(draft.pushTitle, options.limits.push_title, 'Saisissez le titre de la notification.');
  const body = limited(draft.pushBody, options.limits.push_body, 'Saisissez le message de la notification.');
  if (title) errors.pushTitle = title;
  if (body) errors.pushBody = body;
  if (draft.link !== '' && !RELATIVE_LINK.test(draft.link)) errors.link = 'Saisissez un chemin commençant par un seul « / », par exemple /loyers.';
  return errors;
}

export function validateDraft(draft: CampaignDraft, options: MarketingOptions, saved: readonly CampaignImage[]): DraftErrors {
  return {
    ...audienceErrors(draft, options),
    ...(draft.channel === 'email' ? emailErrors(draft, options, saved) : pushErrors(draft, options)),
  };
}

export function inputOf(draft: CampaignDraft, options: MarketingOptions): CampaignInput {
  const email = draft.channel === 'email';
  return {
    channel: draft.channel,
    category: draft.category,
    audience: draft.audience,
    inactivityDays: acceptsInactivity(draft, options) ? Number(draft.inactivityDays) : null,
    recipientEmails: draft.recipients,
    subject: draft.subject.trim(),
    html: draft.html,
    pushTitle: draft.pushTitle.trim(),
    pushBody: draft.pushBody.trim(),
    link: draft.link,
    images: email ? draft.newImages : [],
    removedImageIds: email ? draft.removedImageIds : [],
  };
}
