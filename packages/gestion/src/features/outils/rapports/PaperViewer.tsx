'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Download, Minus, Plus, Printer } from 'lucide-react';
import { Button, IconButton } from '@eguardimmo/ui';
import { PRINT_CSS } from './printCss';
import { PAPER_HEIGHT, PAPER_WIDTH } from './ReportPaper';

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

const print = () => { window.print(); };

export interface PaperViewerProps {
  pages: number;
  current: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}

export function PaperViewer({ pages, current, onPageChange, children }: PaperViewerProps) {
  const [zoom, setZoom] = useState(100);
  const stage = useRef<HTMLDivElement>(null);

  const fit = () => {
    const width = stage.current?.clientWidth ?? 0;
    setZoom(width > 0 ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(((width - 32) / PAPER_WIDTH) * 100))) : 100);
  };

  return (
    <section aria-label="Aperçu du PDF" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <style>{PRINT_CSS}</style>
      <div role="toolbar" aria-label="Outils de l’aperçu" className="flex h-11 items-center gap-1 overflow-x-auto border-b border-line px-2 text-caption font-medium whitespace-nowrap text-fg-muted">
        <IconButton label="Page précédente" icon={ChevronLeft} disabled={current <= 1} onClick={() => { onPageChange(current - 1); }} />
        <span aria-live="polite">{`Page ${String(current)} / ${String(pages)}`}</span>
        <IconButton label="Page suivante" icon={ChevronRight} disabled={current >= pages} onClick={() => { onPageChange(current + 1); }} />
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
        <IconButton label="Réduire" icon={Minus} disabled={zoom <= ZOOM_MIN} onClick={() => { setZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP)); }} />
        <span className="min-w-11 text-center tabular-nums">{`${String(zoom)} %`}</span>
        <IconButton label="Agrandir" icon={Plus} disabled={zoom >= ZOOM_MAX} onClick={() => { setZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP)); }} />
        <Button variant="ghost" size="sm" onClick={fit}>Ajuster</Button>
        <span className="flex-1" />
        <IconButton label="Imprimer" icon={Printer} onClick={print} />
        <IconButton label="Télécharger le PDF" icon={Download} onClick={print} />
      </div>
      <div ref={stage} className="flex justify-start overflow-auto bg-muted p-4 sm:justify-center">
        <div style={{ width: PAPER_WIDTH * (zoom / 100), height: PAPER_HEIGHT * (zoom / 100) }} className="shrink-0">
          <div data-print-root="" style={{ transform: `scale(${String(zoom / 100)})`, transformOrigin: 'top left', width: PAPER_WIDTH }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export const printDocument = print;
