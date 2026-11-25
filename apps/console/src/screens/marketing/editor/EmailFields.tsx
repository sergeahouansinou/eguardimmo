'use client';

import { Skeleton, TextField } from '@eguardimmo/ui';
import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import type { CampaignImage, MarketingOptions } from '@/platform/marketing/marketing';
import { keptImages, textLength } from '../campaignDraft';
import type { CampaignDraft, DraftErrors } from '../campaignDraft';
import { citedImageKeys, removeImageTags } from '../html/cid';
import { IMAGE_TYPES, selectImages } from '../imageRules';
import { useImageSources } from '../useImageSources';
import { EmailPreview } from './EmailPreview';
import { ImagesField } from './ImagesField';
import type { ImageItem } from './ImagesField';
import type { InsertImage } from './RichTextEditor';

const HtmlContentField = dynamic(() => import('./HtmlContentField').then((module) => module.HtmlContentField), {
  ssr: false,
  loading: () => <Skeleton shape="block" className="h-64" />,
});

export interface EmailFieldsProps {
  draft: CampaignDraft;
  savedImages: readonly CampaignImage[];
  options: MarketingOptions;
  errors: DraftErrors;
  onChange: (changes: Partial<CampaignDraft>) => void;
}

export function EmailFields({ draft, savedImages, options, errors, onChange }: EmailFieldsProps) {
  const { limits } = options;
  const kept = keptImages(draft, savedImages);
  const sources = useImageSources(kept, draft.newImages);
  const cited = citedImageKeys(draft.html);
  const items: ImageItem[] = [
    ...kept.map((image) => ({ key: image.id, name: image.name, size: image.size, inline: cited.has(image.id) })),
    ...draft.newImages.map(({ ref, file }) => ({ key: ref, name: file.name, size: file.size, inline: cited.has(ref) })),
  ];
  const insert = useRef<InsertImage | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const insertPicked = useRef(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const ready = useCallback((next: InsertImage | null) => { insert.current = next; }, []);
  const changeHtml = useCallback((html: string) => { onChange({ html }); }, [onChange]);

  const pick = (thenInsert: boolean) => {
    insertPicked.current = thenInsert;
    picker.current?.click();
  };

  const add = (files: File[]) => {
    const used = { count: items.length, bytes: items.reduce((total, item) => total + item.size, 0) };
    const selection = selectImages(files, used, limits);
    setRejected(selection.rejected);
    if (selection.accepted.length === 0) return;
    onChange({ newImages: [...draft.newImages, ...selection.accepted] });
    if (insertPicked.current) for (const image of selection.accepted) insert.current?.(image.ref, image.file.name);
  };

  const remove = ({ key }: ImageItem) => {
    const saved = savedImages.some((image) => image.id === key);
    onChange({
      html: removeImageTags(draft.html, key),
      ...(saved ? { removedImageIds: [...draft.removedImageIds, key] } : { newImages: draft.newImages.filter((image) => image.ref !== key) }),
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 py-2">
      <TextField
        label="Objet"
        placeholder="Objet de l’e-mail"
        hint={`${String(textLength(draft.subject))} sur ${String(limits.subject)} caractères`}
        error={errors.subject}
        value={draft.subject}
        onChange={(event) => { onChange({ subject: event.target.value }); }}
      />
      <HtmlContentField
        value={draft.html}
        onChange={changeHtml}
        sources={sources}
        maxBytes={limits.html_bytes}
        error={errors.html}
        onReady={ready}
        onPickImage={() => { pick(true); }}
      />
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept={IMAGE_TYPES.join(',')}
        aria-label="Choisir des images"
        onChange={(event) => {
          add(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <ImagesField
        items={items}
        sources={sources}
        limits={limits}
        rejected={rejected}
        error={errors.images}
        onPick={() => { pick(false); }}
        onInsert={(item) => { insert.current?.(item.key, item.name); }}
        onRemove={remove}
      />
      <EmailPreview subject={draft.subject} html={draft.html} sources={sources} />
    </div>
  );
}
