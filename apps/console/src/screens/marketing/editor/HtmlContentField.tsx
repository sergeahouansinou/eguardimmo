'use client';

import { SegmentedControl, Textarea } from '@eguardimmo/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { byteLength } from '../campaignDraft';
import { imageTag } from '../html/cid';
import { losesFormatting } from '../html/formattingLoss';
import { formatBytes } from '../labels';
import type { ImageSources } from '../useImageSources';
import { normalizeHtml } from './editorSchema';
import { RichTextEditor } from './RichTextEditor';
import type { InsertImage } from './RichTextEditor';

export interface HtmlContentFieldProps {
  value: string;
  onChange: (html: string) => void;
  sources: ImageSources;
  maxBytes: number;
  error?: string;
  onReady: (insert: InsertImage | null) => void;
  onPickImage: () => void;
}

type Mode = 'visual' | 'code';

const MODES = [
  { value: 'visual', label: 'Éditeur' },
  { value: 'code', label: 'Code HTML' },
];

export function HtmlContentField({ value, onChange, sources, maxBytes, error, onReady, onPickImage }: HtmlContentFieldProps) {
  const [choice, setChoice] = useState<Mode>(() => (losesFormatting(value) ? 'code' : 'visual'));
  const [confirming, setConfirming] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const visualInsert = useRef<InsertImage | null>(null);
  const mode: Mode = choice === 'visual' && losesFormatting(value) ? 'code' : choice;
  const latest = useRef({ value, mode });

  useEffect(() => {
    latest.current = { value, mode };
  }, [value, mode]);

  const ready = useCallback((insert: InsertImage | null) => { visualInsert.current = insert; }, []);

  useEffect(() => {
    onReady((key, alt) => {
      if (latest.current.mode === 'visual') {
        visualInsert.current?.(key, alt);
        return;
      }
      const source = latest.current.value;
      const at = area.current?.selectionStart ?? source.length;
      const next = `${source.slice(0, at)}${imageTag(key, alt)}${source.slice(at)}`;
      latest.current = { value: next, mode: 'code' };
      onChange(next);
    });
    return () => { onReady(null); };
  }, [onReady, onChange]);

  const select = (next: string) => {
    if (next === 'code') setChoice('code');
    else if (losesFormatting(value)) setConfirming(true);
    else setChoice('visual');
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-fg-muted">Contenu de l’e-mail</span>
        <SegmentedControl label="Mode de saisie" options={MODES} value={mode} onValueChange={select} />
      </div>
      {mode === 'visual' ? (
        <RichTextEditor value={value} onChange={onChange} sources={sources} invalid={error !== undefined} onReady={ready} onPickImage={onPickImage} />
      ) : (
        <Textarea
          ref={area}
          label="Code HTML de l’e-mail"
          hideLabel
          placeholder="<p>Bonjour,</p>"
          rows={14}
          spellCheck={false}
          className="font-mono"
          error={error}
          value={value}
          onChange={(event) => { onChange(event.target.value); }}
        />
      )}
      <p className="text-caption text-fg-subtle">
        {formatBytes(byteLength(value))} sur {formatBytes(maxBytes)}. Seules les images ajoutées ici s’affichent : aucune image distante.
      </p>
      {error && mode === 'visual' ? <p role="alert" className="text-caption text-fg-danger">{error}</p> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Revenir à l’éditeur ?"
        description="Ce code contient une mise en forme que l’éditeur ne sait pas conserver (tableaux, styles, images distantes…). Elle sera définitivement retirée."
        confirmLabel="Convertir et perdre la mise en forme"
        tone="danger"
        onConfirm={() => {
          onChange(normalizeHtml(value));
          setChoice('visual');
          return Promise.resolve();
        }}
      />
    </div>
  );
}
