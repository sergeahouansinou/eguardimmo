import type { CampaignLimits } from '@/platform/marketing/marketing';
import type { NewImage } from './campaignDraft';
import { formatBytes } from './labels';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;
const ACCEPTED = new Set<string>(IMAGE_TYPES);

export function imageRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `img-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export interface Selection {
  accepted: NewImage[];
  rejected: string[];
}

export function selectImages(files: readonly File[], used: { count: number; bytes: number }, limits: CampaignLimits): Selection {
  const accepted: NewImage[] = [];
  const rejected: string[] = [];
  let { count, bytes } = used;
  for (const file of files) {
    if (!ACCEPTED.has(file.type)) rejected.push(`${file.name} : seuls les formats JPEG, PNG et GIF sont acceptés.`);
    else if (file.size > limits.image_bytes) rejected.push(`${file.name} : ${formatBytes(limits.image_bytes)} au maximum par image.`);
    else if (count >= limits.images) rejected.push(`${file.name} : ${String(limits.images)} images au maximum.`);
    else if (bytes + file.size > limits.total_image_bytes) rejected.push(`${file.name} : le total dépasserait ${formatBytes(limits.total_image_bytes)}.`);
    else {
      accepted.push({ ref: imageRef(), file });
      count += 1;
      bytes += file.size;
    }
  }
  return { accepted, rejected };
}
