'use client';

import { useQueries } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { CAMPAIGN_IMAGE_PATH } from '@/platform/marketing/marketing';
import type { CampaignImage } from '@/platform/marketing/marketing';
import type { NewImage } from './campaignDraft';

export type ImageSources = Readonly<Record<string, string>>;

interface Loaded {
  key: string;
  source: string;
}

const CHUNK = 0x8000;

function dataUrl(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let start = 0; start < bytes.length; start += CHUNK) binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  return `data:${mime};base64,${btoa(binary)}`;
}

async function storedImage(image: CampaignImage): Promise<Loaded> {
  if (!CAMPAIGN_IMAGE_PATH.test(image.url)) throw new Error('Adresse d’image refusée.');
  const response = await fetch(image.url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Image indisponible.');
  return { key: image.id, source: dataUrl(await response.arrayBuffer(), image.mime) };
}

async function newImage({ ref, file }: NewImage): Promise<Loaded> {
  return { key: ref, source: dataUrl(await file.arrayBuffer(), file.type) };
}

function combine(results: UseQueryResult<Loaded>[]): ImageSources {
  return Object.fromEntries(results.flatMap((result) => (result.data ? [[result.data.key, result.data.source]] : [])));
}

/** Les images deviennent des URL « data: » : l’aperçu isolé n’a ni session ni accès au réseau. */
export function useImageSources(saved: readonly CampaignImage[], added: readonly NewImage[] = []): ImageSources {
  return useQueries({
    queries: [
      ...saved.map((image) => ({ queryKey: ['campaign-image', image.id], queryFn: () => storedImage(image), staleTime: Infinity, retry: false })),
      ...added.map((image) => ({ queryKey: ['campaign-image', image.ref], queryFn: () => newImage(image), staleTime: Infinity, retry: false })),
    ],
    combine,
  });
}
