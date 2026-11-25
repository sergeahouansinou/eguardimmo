import type { Body } from '@eguardimmo/api';
import type { CampaignCategory, CampaignChannel } from './marketing';

export const SELECTED_AUDIENCE = 'selected';

export interface CampaignInput {
  channel: CampaignChannel;
  category: CampaignCategory;
  audience: string;
  inactivityDays: number | null;
  recipientEmails: string[];
  subject: string;
  html: string;
  pushTitle: string;
  pushBody: string;
  link: string;
  images: { ref: string; file: File }[];
  removedImageIds: string[];
}

type Field = string | number | null | string[];

function contentFields(input: CampaignInput, updating: boolean): Record<string, Field> {
  if (input.channel === 'email') return { subject: input.subject, html: input.html };
  const fields: Record<string, Field> = { push_title: input.pushTitle, push_body: input.pushBody };
  if (input.link !== '') fields.link = input.link;
  else if (updating) fields.link = null;
  return fields;
}

function fieldsOf(input: CampaignInput, lockVersion: number | undefined): Record<string, Field> {
  const updating = lockVersion !== undefined;
  return {
    channel: input.channel,
    category: input.category,
    audience: input.audience,
    ...(input.inactivityDays === null ? {} : { inactivity_days: input.inactivityDays }),
    ...(input.audience === SELECTED_AUDIENCE ? { recipient_emails: input.recipientEmails } : {}),
    ...contentFields(input, updating),
    ...(updating ? { lock_version: lockVersion } : {}),
    ...(updating && input.removedImageIds.length > 0 ? { removed_image_ids: input.removedImageIds } : {}),
  };
}

export function campaignBody(input: CampaignInput, lockVersion?: number): Body {
  const fields = fieldsOf(input, lockVersion);
  const images = input.channel === 'email' ? input.images : [];
  if (images.length === 0) return fields;
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const item of value) form.append(`${name}[]`, item);
    else form.append(name, value === null ? '' : String(value));
  }
  for (const { ref, file } of images) form.append(`images[${ref}]`, file);
  return form;
}
