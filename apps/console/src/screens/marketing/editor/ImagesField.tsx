'use client';

import { Alert, Badge, Button } from '@eguardimmo/ui';
import Image from 'next/image';
import type { CampaignLimits } from '@/platform/marketing/marketing';
import { formatBytes } from '../labels';
import type { ImageSources } from '../useImageSources';

export interface ImageItem {
  key: string;
  name: string;
  size: number;
  inline: boolean;
}

export interface ImagesFieldProps {
  items: readonly ImageItem[];
  sources: ImageSources;
  limits: CampaignLimits;
  rejected: readonly string[];
  error?: string;
  onPick: () => void;
  onInsert: (item: ImageItem) => void;
  onRemove: (item: ImageItem) => void;
}

function Thumbnail({ source }: { source?: string }) {
  return source ? <Image src={source} alt="" width={48} height={48} unoptimized className="size-full object-contain" /> : null;
}

export function ImagesField({ items, sources, limits, rejected, error, onPick, onInsert, onRemove }: ImagesFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body-strong">Images</p>
          <p className="text-caption text-fg-subtle">
            JPEG, PNG ou GIF. {limits.images} images au maximum, {formatBytes(limits.image_bytes)} chacune, {formatBytes(limits.total_image_bytes)} au total.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={items.length >= limits.images} onClick={onPick}>
          Ajouter des images
        </Button>
      </div>
      {rejected.length > 0 ? (
        <Alert tone="danger" title="Images refusées">
          {rejected.map((reason) => <span key={reason} className="block break-words">{reason}</span>)}
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {items.length === 0 ? null : (
        <ul aria-label="Images de la campagne" className="flex flex-col">
          {items.map((item) => (
            <li key={item.key} aria-label={item.name} className="flex flex-wrap items-center gap-3 border-t border-line py-2 first:border-t-0">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
                <Thumbnail source={sources[item.key]} />
              </span>
              <span className="flex min-w-40 flex-1 flex-col items-start gap-1">
                <span className="max-w-full text-body break-all">{item.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-caption text-fg-subtle">
                  {formatBytes(item.size)}
                  <Badge tone={item.inline ? 'info' : 'neutral'}>{item.inline ? 'Insérée dans le texte' : 'En pièce jointe'}</Badge>
                </span>
              </span>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" aria-label={`Insérer ${item.name} dans le texte`} onClick={() => { onInsert(item); }}>
                  Insérer
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Retirer ${item.name}`} onClick={() => { onRemove(item); }}>
                  Retirer
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
