'use client';

import { useMemo } from 'react';
import { previewDocument } from '../html/cid';
import type { ImageSources } from '../useImageSources';

export function EmailPreview({ subject, html, sources }: { subject: string; html: string; sources: ImageSources }) {
  const page = useMemo(() => previewDocument(html, sources), [html, sources]);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-body-strong">Aperçu</p>
      <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface">
        <p className="border-b border-line px-3 py-2 text-body break-words">
          <span className="text-fg-subtle">Objet : </span>
          {subject === '' ? 'sans objet' : subject}
        </p>
        <iframe title="Aperçu de l’e-mail" sandbox="" referrerPolicy="no-referrer" srcDoc={page} data-paper="" className="block h-96 w-full" />
      </div>
    </div>
  );
}
